# SiteTalk

A Chrome extension that turns any website into a live chat room for whoever's on that page right now. Anonymous by default — sign in only if you want a name that follows you around.

```
SiteTalk/
├── manifest.json        # Chrome extension config (Manifest V3)
├── background.js        # Service worker: settings, badge, tab state
├── content.js            # Injected into every page — builds the floating widget, owns the WebSocket
├── popup.html/js/css     # Toolbar popup — status, guest name, sign in
├── icons/                # Extension icons
├── server/               # Realtime backend (Node + Express + ws)
│   ├── index.js
│   ├── package.json
│   └── .env.example
└── website/              # Static marketing site (index.html/styles.css/script.js)
```

## How it works

- **Rooms are hostnames.** Everyone on `example.com` is in the same room — no setup, no invite links.
- **Anonymous by default.** Each browser gets a randomly generated guest name (e.g. "Quiet Otter"), stored locally via `chrome.storage.local`. No account required.
- **Optional accounts.** The popup has a sign-in tab that talks to the backend's `/api/signup` and `/api/login` routes (email + password, JWT). Signing in keeps your display name consistent across sites.
- **Text + voice.** Messages are plain WebSocket JSON frames; voice notes are recorded with `MediaRecorder`, base64-encoded, and relayed live (not persisted, to keep storage small).
- **History.** The server keeps the last 50 text messages per room in a small JSON file (`server/data.json`) so new visitors have context. Swap this for Postgres/Redis before running this for real traffic.
- **Isolated UI.** The widget renders inside a Shadow DOM, so its styles can never leak into — or be broken by — the host page's CSS.

## Running the backend

```bash
cd server
cp .env.example .env   # edit JWT_SECRET before deploying anywhere public
npm install
npm start
```

The server listens on `ws://localhost:8080` for chat and exposes `POST /api/signup` / `POST /api/login` for accounts.

## Loading the extension

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked**, select this folder (the one with `manifest.json`).
3. Click the SiteTalk toolbar icon, and under the ⚙ settings, point **Server address** at your backend, e.g. `ws://localhost:8080`.
4. Browse to any site — the chat bubble appears in the bottom-right corner.

## Deploying for real use

- Host `server/` anywhere that runs Node (Render, Fly.io, a small VPS) and give it a `wss://` domain — browsers require secure WebSockets from extensions running on `https://` pages.
- Replace the JSON-file store in `server/index.js` with a real database once you expect meaningful traffic.
- Publish the extension to the Chrome Web Store, then hardcode that production `wss://` URL as the default in `background.js`'s `DEFAULT_SETTINGS.serverUrl`.
- `website/` is a static site — drop it on GitHub Pages, Vercel, or Netlify as-is.

## License

MIT
