# FPV Drone Arena

Fly an FPV drone through a city and fire homing missiles at other drones. Last drone flying wins.

**Play:** https://danielmaximus08.github.io/fpv-drone-arena/

## Playing with friends
1. Open the game, type your name and press **Create game & get invite link**.
2. Press **Copy** and send the link to your friends. When they open it, they join your lobby automatically. They can also type the 4-letter code.
3. Pick how many bots to add and press **Start match**.

Your browser hosts the game, so keep your tab open while you play. If you close it, the game ends for everyone. Nobody needs an account or a download.

## Controls
Mouse/trackpad to look · WASD to fly · Space/Shift to go up/down · **E to boost** · click or F to fire · Esc to pause

## How it works
- `index.html` is the whole game. It's hosted free on GitHub Pages.
- Multiplayer is peer-to-peer (WebRTC via PeerJS). The host's browser runs the bots and relays everyone's moves.
- Some strict school or work networks block peer-to-peer connections. If a friend can't connect, try a different network, such as a home Wi-Fi or a phone hotspot.
- `server/` holds an optional Node.js server version, which isn't needed for the GitHub Pages version.
