# FPV Drone Arena (multiplayer)

Fly an FPV drone through a city and fire homing missiles. One player creates a game and gets a 4-letter code, and friends join with that code. Bots can fill the empty slots. Last drone flying wins.

Controls: mouse/trackpad to look · WASD to fly · Space/Shift to go up/down · **E to boost** · click or F to fire · Esc to pause.

You need **Node.js 18 or newer**: download it from https://nodejs.org (pick "LTS"). No other installs are needed.

---

## Option 1: Friend on the same Wi-Fi (easiest)

1. Unzip this folder.
2. Open a terminal in the folder (Windows: open the folder, click the address bar, type `cmd`, press Enter. Mac: right-click the folder → "New Terminal at Folder").
3. Run:
   ```
   node server.js
   ```
4. It prints two links:
   - `http://localhost:3000` is for you.
   - `http://192.168.x.x:3000` is the one to send your friend.
5. You press **Create game & get a code** and tell your friend the code. They press **Join with code**.

If your friend can't connect, your firewall may be blocking it. Allow Node.js when Windows or Mac asks.

## Option 2: Friend anywhere, over the internet (free, using Render)

1. Make a free account at https://github.com and create a new repository, for example `fpv-drone-arena`.
2. Upload everything in this folder to it (use "Add file → Upload files"). Keep the `public` folder with `index.html` inside.
3. Make a free account at https://render.com and click **New → Web Service**, then pick your repository.
4. Use these settings:
   - Build command: *(leave empty)*
   - Start command: `node server.js`
   - Instance type: **Free**
5. Click Deploy. After a minute you get a link like `https://fpv-drone-arena.onrender.com`. Send that link to your friend.

Note: Render's free tier goes to sleep after about 15 minutes with no players. The first visit after that can take up to a minute to wake it up.

---

## How multiplayer works
- `server.js` serves the game page and relays messages between players who share a code (up to 8 per game).
- Each player's browser flies its own drone. The host's browser runs the bots.
- If the host leaves, the next player automatically becomes host and takes over the bots.
