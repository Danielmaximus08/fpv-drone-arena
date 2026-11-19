// FPV Drone Arena — game server (no dependencies, Node 18+)
// Serves the game page and relays multiplayer messages between players in the same room.
// Run:  node server.js      then open http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PAGE = path.join(__dirname, 'public', 'index.html');
const MAX_PLAYERS = 8;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const rooms = new Map();   // code -> { code, clients:Set, host }
let nextId = 1;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/index.html') {
    fs.readFile(PAGE, (err, data) => {
      if (err) { res.writeHead(500); res.end('index.html missing'); return; }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      res.end(data);
    });
  } else if (url === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok');
  } else {
    res.writeHead(404); res.end('not found');
  }
});

// ---------- minimal WebSocket implementation ----------
class Client {
  constructor(sock) {
    this.sock = sock; this.id = 'p' + (nextId++); this.name = 'Pilot'; this.room = null;
    this.buf = Buffer.alloc(0); this.frag = []; this.alive = true;
    sock.on('data', d => this.onData(d));
    sock.on('close', () => this.onClose());
    sock.on('error', () => this.onClose());
  }
  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) { this.sock.destroy(); return; }
      const need = off + (masked ? 4 : 0) + len;
      if (this.buf.length < need) return;
      let payload = this.buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) {
        const mask = this.buf.subarray(off, off + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      this.buf = this.buf.subarray(need);
      if (op === 8) { this.sock.end(); return; }
      if (op === 9) { this.raw(0x8a, payload); continue; }
      if (op === 10) { this.alive = true; continue; }
      if (op === 1 || op === 0) {
        this.frag.push(payload);
        if (fin) { const txt = Buffer.concat(this.frag).toString('utf8'); this.frag = []; this.onText(txt); }
      }
    }
  }
  raw(first, payload) {
    if (this.sock.destroyed) return;
    const len = payload.length;
    let head;
    if (len < 126) { head = Buffer.from([first, len]); }
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = first; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = first; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    this.sock.write(Buffer.concat([head, payload]));
  }
  send(obj) { this.raw(0x81, Buffer.from(JSON.stringify(obj))); }
  onText(txt) {
    let m; try { m = JSON.parse(txt); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'create') {
      if (this.room) leave(this);
      this.name = cleanName(m.name);
      let code; do { code = Array.from({ length: 4 }, () => CODE_CHARS[Math.random() * CODE_CHARS.length | 0]).join(''); } while (rooms.has(code));
      const room = { code, clients: new Set(), host: this };
      rooms.set(code, room); join(this, room);
    } else if (m.t === 'join') {
      const room = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!room) return this.send({ t: 'error', msg: 'No game found with that code.' });
      if (room.clients.size >= MAX_PLAYERS) return this.send({ t: 'error', msg: 'That game is full.' });
      if (this.room) leave(this);
      this.name = cleanName(m.name); join(this, room);
    } else if (m.t === 'leave') {
      leave(this);
    } else if (this.room) {
      if (m.t === 'start' && this.room.host !== this) return;   // only the host starts rounds
      m.from = this.id;
      const out = JSON.stringify(m);
      for (const c of this.room.clients) if (c !== this) c.raw(0x81, Buffer.from(out));
    }
  }
  onClose() { if (this.closed) return; this.closed = true; leave(this); }
}

function cleanName(n) { return String(n || 'Pilot').replace(/[^\w \-]/g, '').trim().slice(0, 16) || 'Pilot'; }
function roster(room) { return [...room.clients].map(c => ({ id: c.id, name: c.name })); }
function broadcastPlayers(room) {
  const msg = { t: 'players', players: roster(room), hostId: room.host.id };
  for (const c of room.clients) c.send(msg);
}
function join(c, room) {
  room.clients.add(c); c.room = room;
  c.send({ t: 'joined', id: c.id, code: room.code, hostId: room.host.id, players: roster(room) });
  broadcastPlayers(room);
}
function leave(c) {
  const room = c.room; if (!room) return;
  room.clients.delete(c); c.room = null;
  if (room.clients.size === 0) { rooms.delete(room.code); return; }
  if (room.host === c) room.host = room.clients.values().next().value;
  broadcastPlayers(room);
}

server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || String(req.headers.upgrade).toLowerCase() !== 'websocket') { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const c = new Client(sock);
  clients.add(c); sock.on('close', () => clients.delete(c));
});

// keep connections alive (hosting services drop idle sockets)
const clients = new Set();
setInterval(() => { for (const c of clients) c.raw(0x89, Buffer.alloc(0)); }, 25000);

server.listen(PORT, () => {
  console.log('FPV Drone Arena running on http://localhost:' + PORT);
  const nets = require('os').networkInterfaces();
  for (const list of Object.values(nets)) for (const n of list || [])
    if (n.family === 'IPv4' && !n.internal) console.log('  Friends on your Wi-Fi can open: http://' + n.address + ':' + PORT);
});
