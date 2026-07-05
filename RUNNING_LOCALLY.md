# Running SiteTalk locally

This gets SiteTalk working on your own machine, for testing — the extension and server both running on `localhost`, only visible to you.

## What you need

- [Node.js](https://nodejs.org) 18 or newer (`node -v` to check)
- Google Chrome (or any Chromium browser — Edge, Brave, etc.)
- The SiteTalk project folder, unzipped somewhere on your computer

## 1. Start the backend server

The server is what actually relays chat messages between browsers. It has to be running before the extension will connect.

```bash
cd SiteTalk/server
cp .env.example .env
npm install
npm start
```

You should see:

```
SiteTalk server listening on :8080
```

Leave this terminal window open — closing it stops the server. If you want it to restart automatically while you edit code, use `npm run dev` instead of `npm start`.

**Quick sanity check**, in a second terminal:

```bash
curl http://localhost:8080/health
```

You should get back `{"ok":true}`.

## 2. Load the extension into Chrome

1. Open a new tab and go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the `SiteTalk` folder — the one that has `manifest.json` directly inside it (not the `server` or `website` subfolders).
5. SiteTalk should now show up in your extensions list with its icon. Pin it to the toolbar so it's easy to reach.

## 3. Point the extension at your local server

1. Click the SiteTalk icon in the toolbar.
2. Click the ⚙ icon (top-right of the popup) to open **Advanced settings**.
3. In **Server address**, enter:
   ```
   ws://localhost:8080
   ```
4. Click **Save server address**.

## 4. Try it out

1. Visit any website — e.g. `https://example.com`.
2. You should see a small round chat bubble appear in the bottom-right corner of the page.
3. Click it, type a message, and hit Enter.
4. Open the **same page in a second tab or window** — you'll see the message there too, and both tabs will show each other in the "online" count.

## Testing the account / sign-in flow

The **Account** tab in the popup calls your local server directly:

1. Open the SiteTalk popup → **Account** tab.
2. Enter any email and an 8+ character password, click **Create account**.
3. You're now signed in — your display name will be used instead of a random guest name, and it'll be remembered by the extension.

Accounts created this way only exist in `server/data.json` on your machine — deleting that file wipes all accounts and message history and starts fresh.

## Common issues

| Problem | Likely cause |
|---|---|
| Bubble never appears | Reload the extension (`chrome://extensions` → refresh icon) and reload the page — content scripts only inject into *new* page loads after the extension is installed. |
| Popup says "Not connected on this tab" | The server isn't running, or the server address in Advanced settings is wrong. Re-check step 1 and step 3. |
| Sign in / sign up fails with a network error | Double check the server address doesn't have a trailing slash, and that `npm start` is still running in its terminal. |
| Messages don't sync between tabs | Make sure both tabs are on the exact same hostname (rooms are per-domain, so `example.com` and `www.example.com` are treated as the same room, but `blog.example.com` is a different one). |

Once this all works locally, see **`DEPLOYING_GLOBALLY.md`** for putting it online so anyone, anywhere, can use it — not just you on `localhost`.
