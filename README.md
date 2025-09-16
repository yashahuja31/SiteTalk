
# 🚀 SiteChat – Real-time Chat Anywhere on the Web

**SiteChat** is a Chrome browser extension that allows users on the same website to chat with each other in real time.

* 🔥 Floating chat popup (draggable & resizable)
* 💬 Text messaging + 🎤 voice message support
* ⏱ Messages are timestamped and synced for all users
* 🗂 Last **50 messages are stored** per site (new users see existing conversation history)

With SiteChat, every website becomes a community!

---

## 📂 Project Structure

```bash
sitechat/
├── manifest.json        # Chrome extension config file
├── popup.html           # Popup chat UI
├── popup.js             # Popup logic (text, voice messages, UI handling)
├── content.js           # Injected into the website (handles floating chat)
├── background.js        # Handles connections, storage, sync
├── styles.css           # Styles for popup
├── icons/               # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── server/              # (Optional) Node.js backend for message sync
│   ├── index.js
│   └── package.json
└── README.md            # This file
```

---

## ⚙️ Installation

### 🔹 Method 1: Manual Install via Chrome Extensions Page

1. Clone or download this repository:

   ```bash
   git clone https://github.com/yourusername/sitechat.git
   cd sitechat
   ```

2. Open Chrome and go to:

   ```
   chrome://extensions/
   ```

3. Enable **Developer Mode** (toggle in top-right).

4. Click **"Load unpacked"**.

5. Select the `sitechat/` folder.

6. You’ll see the **SiteChat icon** appear in your Chrome toolbar ✅.

---

### 🔹 Method 2: Install via `.zip`

1. Download the repo as `.zip` → [Download ZIP](https://github.com/yourusername/sitechat/archive/refs/heads/main.zip)
2. Extract it locally.
3. Follow the same steps as above (`chrome://extensions/ → Load unpacked`).

---

### 🔹 Method 3: CLI Development Setup

For devs who want to contribute:

```bash
# Clone repo
git clone https://github.com/yourusername/sitechat.git
cd sitechat

# Install optional server deps (if using Node backend)
cd server
npm install

# Run server
node index.js
```

Now you can reload the extension from `chrome://extensions/`.

---

## 🛠️ Features

* ✅ Floating draggable popup
* ✅ Real-time text chat
* ✅ Voice message support
* ✅ Per-website chat rooms
* ✅ Last 50 messages stored (with timestamps)
* ✅ Works across all websites
* ✅ Minimal permissions for privacy

---

## 🔐 Permissions

The extension uses the following permissions:

```json
"permissions": [
  "storage", 
  "tabs", 
  "activeTab"
],
"host_permissions": [
  "*://*/*"
]
```

* `storage` → Store last 50 messages per website
* `tabs/activeTab` → Identify which site you’re on
* `host_permissions` → To inject floating chat on any site

---

## 🧑‍💻 Development

1. Edit `popup.html`, `popup.js`, or `content.js`.
2. Reload from `chrome://extensions/ → Reload`.
3. Test changes immediately in your browser.

---

## 🤝 Contributing

We welcome contributions!

1. Fork the repository
2. Create a feature branch:

   ```bash
   git checkout -b feature/my-feature
   ```
3. Commit changes:

   ```bash
   git commit -m "Added my feature"
   ```
4. Push to your branch:

   ```bash
   git push origin feature/my-feature
   ```
5. Open a Pull Request 🎉

---

## ⚡ Troubleshooting

* ❌ Extension not loading?
  → Make sure `manifest.json` is in root folder.

* ❌ Popup not appearing?
  → Check if permissions are enabled.

* ❌ Messages not syncing?
  → Ensure background script is running.
  → If using server mode, verify Node backend is running.

---

## 📜 License

MIT License © 2025 \SiteChat

---


