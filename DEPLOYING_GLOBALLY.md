# Deploying SiteTalk globally

"Locally" gets SiteTalk working for you, on your machine. This guide takes it from there to something anyone, anywhere, can install and actually use with each other. There are three separate pieces to put online: the **server**, the **extension**, and the **marketing site**.

---

## 1. Deploy the server somewhere with a real address

Chrome will not let an installed extension talk to a plain `ws://localhost:8080` — it needs a real domain over **secure WebSockets (`wss://`)**. Any host that runs Node.js works; below are two easy options.

### Option A — Render.com (simplest, free tier available)

1. Push the `SiteTalk` repo to GitHub if it isn't already there.
2. On [render.com](https://render.com), click **New → Web Service** and connect the repo.
3. Set:
   - **Root directory:** `server`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Add environment variables (Render's dashboard → Environment):
   ```
   JWT_SECRET=<generate a long random string, e.g. `openssl rand -hex 32`>
   MAX_MESSAGES_PER_ROOM=50
   DATA_FILE=/opt/render/project/data.json
   ```
   Leave `PORT` unset — Render sets it automatically and the server already reads `process.env.PORT`.
5. Deploy. Render gives you a URL like `sitetalk-server.onrender.com`, reachable at `wss://sitetalk-server.onrender.com`.

> Free-tier services on Render/Railway/Fly sleep after inactivity and take a few seconds to wake up on the first message — fine for a side project, worth upgrading to an always-on plan if usage grows.

### Option B — A small VPS (DigitalOcean, Hetzner, etc.), full control

```bash
# on the server
git clone https://github.com/yashahuja31/SiteTalk.git
cd SiteTalk/server
npm install
cp .env.example .env
nano .env   # set a real JWT_SECRET

# keep it running after you disconnect
npm install -g pm2
pm2 start index.js --name sitetalk-server
pm2 save
pm2 startup   # follow the printed instructions so it survives reboots
```

Then put a reverse proxy in front of it so you get HTTPS/WSS on a real domain:

```nginx
# /etc/nginx/sites-available/sitetalk
server {
    listen 80;
    server_name chat.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/sitetalk /etc/nginx/sites-enabled/
sudo certbot --nginx -d chat.yourdomain.com   # free HTTPS cert, handles the wss:// upgrade too
sudo systemctl reload nginx
```

Either way, once it's live, confirm it from your own machine:

```bash
curl https://chat.yourdomain.com/health
# {"ok":true}
```

### Before real users touch it

- **Set a real `JWT_SECRET`** — never ship the default `dev-secret-change-me`.
- **Swap the JSON-file store for a real database** (Postgres, MongoDB, Redis) once you expect more than a handful of concurrent rooms — `server/index.js` is intentionally simple so this swap is contained to `loadData`, `pushMessage`, and the `/api/*` routes.
- **Add basic rate limiting** (e.g. `express-rate-limit` on `/api/signup` and `/api/login`, and a per-socket message-per-second cap in the `ws` `message` handler) so one person can't flood a room.
- **Add a profanity/abuse filter or report button** if this is going public — there's currently no moderation layer.
- **Back up `data.json`** (or your database) regularly if message history / accounts matter to you.

---

## 2. Point the extension at your live server

Open `background.js` and update the default so anyone who installs the extension connects to your real server out of the box, instead of the placeholder:

```js
const DEFAULT_SETTINGS = {
  serverUrl: "wss://chat.yourdomain.com",   // <- your real address from step 1
  ...
};
```

Anyone who already has it installed can also just set this manually in the popup's ⚙ **Advanced settings** without you pushing an update.

---

## 3. Publish the extension so others can install it

You have two options, depending on how public you want this to be.

### Option A — Chrome Web Store (anyone can install with one click)

1. Create a [Chrome Web Store developer account](https://chrome.google.com/webstore/devconsole) — one-time $5 registration fee.
2. Zip the extension folder (**not** `server/` or `website/` — just `manifest.json`, `background.js`, `content.js`, `popup.*`, `icons/`):
   ```bash
   cd SiteTalk
   zip -r ../sitetalk-extension.zip manifest.json background.js content.js popup.html popup.js popup.css icons
   ```
3. In the developer dashboard, click **New Item**, upload the zip.
4. Fill in the store listing: description, screenshots (you can screenshot the widget open on a real site), and privacy practices — since SiteTalk requests `<all_urls>`, be upfront in the listing about why (it needs to know which page you're on to put you in the right room) and link to a privacy note (the `#privacy` section of the marketing site works well for this).
5. Submit for review. Google's review typically takes anywhere from a few hours to a few days.
6. Once approved, it's live at a public `chrome.google.com/webstore/detail/...` URL — link to that from your website's "Add to Chrome" button instead of the GitHub repo.

### Option B — Share it as "load unpacked" (no store, no review wait)

Good for a smaller audience, a beta, or if you'd rather not go through Web Store review yet.

1. Keep the GitHub repo public (or share the zip directly).
2. People follow the same steps as `RUNNING_LOCALLY.md` section 2 — `chrome://extensions` → Developer mode → Load unpacked.
3. Since your `background.js` already points at your live server (step 2 above), they connect to everyone else using it — no local server needed on their end.

---

## 4. Put the marketing site online

`website/` is a plain static site — no build step, no server required.

**GitHub Pages** (free, simplest if the code's already on GitHub):

```bash
cd SiteTalk
git subtree push --prefix website origin gh-pages
```

Then in the repo's Settings → Pages, set the source branch to `gh-pages`. It'll be live at `https://<username>.github.io/SiteTalk/`.

**Vercel / Netlify** (free, gives you a nicer URL and easy custom domains):

1. Import the GitHub repo.
2. Set **Root directory** to `website`.
3. Leave build command empty (it's static HTML/CSS/JS).
4. Deploy — you'll get a URL immediately, and can attach a custom domain like `sitetalk.app` for free.

Once deployed, update the site's **Add to Chrome** button (`website/index.html`) to point at your Chrome Web Store listing instead of the GitHub link, once Option A above is approved.

---

## Checklist before calling it "live"

- [ ] Server deployed, reachable over `wss://`, with a real `JWT_SECRET`
- [ ] `/health` returns `{"ok":true}` from the public internet
- [ ] `background.js` default `serverUrl` updated to the production address
- [ ] Extension either published on the Chrome Web Store or shared as a zip/repo with clear "load unpacked" instructions
- [ ] Marketing site deployed, links pointing at the real extension install location
- [ ] Basic rate limiting / abuse handling in place if this is open to the public
- [ ] A plan for backing up or migrating off the JSON file store
