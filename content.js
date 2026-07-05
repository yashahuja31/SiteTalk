// SiteTalk — content script
// Injects a self-contained (Shadow DOM) floating chat widget into every page
// and connects it to the SiteTalk realtime server for that site's room.

(() => {
  if (window.__siteTalkInjected) return;
  window.__siteTalkInjected = true;

  const ROOM = location.hostname.replace(/^www\./, "") || "local";
  const GUEST_ADJECTIVES = ["Quiet", "Curious", "Swift", "Lucky", "Bright", "Calm", "Bold", "Kind", "Sly", "Merry"];
  const GUEST_ANIMALS = ["Otter", "Falcon", "Fox", "Panda", "Heron", "Wolf", "Lynx", "Sparrow", "Koala", "Orca"];

  const MAX_VOICE_SECONDS = 20;

  let ws = null;
  let reconnectDelay = 1000;
  let settings = null;
  let guest = null; // { id, name }
  let panelOpen = false;
  let unread = 0;
  let mediaRecorder = null;
  let recordChunks = [];
  let recordStart = 0;
  let recordTimer = null;

  init();

  async function init() {
    settings = await sendToBackground({ type: "GET_SETTINGS" });
    guest = await loadOrCreateGuest();
    buildUI();
    connect();

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "SETTINGS_CHANGED") {
        settings = msg.settings;
        reconnect();
      }
      if (msg.type === "TOGGLE_PANEL") {
        togglePanel();
      }
    });
  }

  function sendToBackground(msg) {
    return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
  }

  async function loadOrCreateGuest() {
    const { siteTalkGuest } = await chrome.storage.local.get("siteTalkGuest");
    if (siteTalkGuest?.id) return siteTalkGuest;
    const name = `${pick(GUEST_ADJECTIVES)} ${pick(GUEST_ANIMALS)}`;
    const created = { id: crypto.randomUUID(), name };
    await chrome.storage.local.set({ siteTalkGuest: created });
    return created;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------
  let root, panelEl, messagesEl, inputEl, statusDotEl, statusTextEl, unreadBadgeEl, sendBtn, micBtn, launcherEl;

  function buildUI() {
    const host = document.createElement("div");
    host.id = "sitetalk-host";
    host.style.all = "initial";
    document.documentElement.appendChild(host);
    root = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = CSS;
    root.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "st-wrap";
    wrap.innerHTML = `
      <button class="st-launcher" title="Open SiteTalk">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="currentColor"/></svg>
        <span class="st-unread" hidden>0</span>
      </button>
      <div class="st-panel" hidden>
        <div class="st-header">
          <div class="st-header-left">
            <span class="st-dot"></span>
            <div class="st-titles">
              <div class="st-title">SiteTalk</div>
              <div class="st-subtitle">${escapeHtml(ROOM)}</div>
            </div>
          </div>
          <div class="st-header-right">
            <span class="st-status">connecting…</span>
            <button class="st-icon-btn st-minimize" title="Minimize">–</button>
          </div>
        </div>
        <div class="st-messages"></div>
        <div class="st-composer">
          <button class="st-icon-btn st-mic" title="Record a voice message">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/></svg>
          </button>
          <input class="st-input" type="text" maxlength="500" placeholder="Message everyone on this page…" />
          <button class="st-send" title="Send">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 20l18-8L3 4v6l12 2-12 2z"/></svg>
          </button>
        </div>
        <div class="st-footer">
          <span>${guest.name}</span>
          <button class="st-linklike st-identity">change name</button>
          <span class="st-sep">·</span>
          <button class="st-linklike st-account">${settings?.mode === "account" ? "account" : "sign in"}</button>
        </div>
      </div>
    `;
    root.appendChild(wrap);

    launcherEl = root.querySelector(".st-launcher");
    unreadBadgeEl = root.querySelector(".st-unread");
    panelEl = root.querySelector(".st-panel");
    messagesEl = root.querySelector(".st-messages");
    inputEl = root.querySelector(".st-input");
    sendBtn = root.querySelector(".st-send");
    micBtn = root.querySelector(".st-mic");
    statusDotEl = root.querySelector(".st-dot");
    statusTextEl = root.querySelector(".st-status");

    launcherEl.addEventListener("click", togglePanel);
    root.querySelector(".st-minimize").addEventListener("click", togglePanel);
    sendBtn.addEventListener("click", sendTextMessage);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendTextMessage();
    });
    micBtn.addEventListener("click", toggleRecording);
    root.querySelector(".st-identity").addEventListener("click", renameGuest);
    root.querySelector(".st-account").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_POPUP" });
      alert("Open the SiteTalk toolbar icon to sign in or create an account.");
    });

    makeDraggable(wrap.querySelector(".st-header"), wrap);
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    panelEl.hidden = !panelOpen;
    if (panelOpen) {
      unread = 0;
      updateUnreadBadge();
      inputEl.focus();
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    reportState();
  }

  async function renameGuest() {
    const next = prompt("Pick a display name for this device:", guest.name);
    if (!next) return;
    guest = { ...guest, name: next.slice(0, 24) };
    await chrome.storage.local.set({ siteTalkGuest: guest });
    root.querySelector(".st-footer span").textContent = guest.name;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "rename", name: guest.name }));
    }
  }

  function updateUnreadBadge() {
    unreadBadgeEl.hidden = unread === 0;
    unreadBadgeEl.textContent = unread > 9 ? "9+" : String(unread);
  }

  function setStatus(state, participants) {
    statusDotEl.className = `st-dot st-dot-${state}`;
    if (state === "connected") {
      statusTextEl.textContent = participants === 1 ? "just you here" : `${participants} online`;
    } else if (state === "connecting") {
      statusTextEl.textContent = "connecting…";
    } else {
      statusTextEl.textContent = "offline";
    }
  }

  function appendMessage({ id, name, text, mine, system, ts, voiceUrl, voiceSeconds }) {
    const row = document.createElement("div");
    row.className = `st-row ${mine ? "st-row-mine" : ""} ${system ? "st-row-system" : ""}`;
    const time = ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

    if (system) {
      row.innerHTML = `<div class="st-system">${escapeHtml(text)}</div>`;
    } else if (voiceUrl) {
      row.innerHTML = `
        <div class="st-bubble">
          <div class="st-name">${escapeHtml(name)}</div>
          <audio controls src="${voiceUrl}" style="width:180px;height:32px;"></audio>
          <div class="st-time">${time} · ${voiceSeconds || 0}s</div>
        </div>`;
    } else {
      row.innerHTML = `
        <div class="st-bubble">
          <div class="st-name">${escapeHtml(name)}</div>
          <div class="st-text">${escapeHtml(text)}</div>
          <div class="st-time">${time}</div>
        </div>`;
    }
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (!panelOpen && !system) {
      unread += 1;
      updateUnreadBadge();
    }
  }

  function escapeHtml(str = "") {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function makeDraggable(handle, wrap) {
    let dragging = false, startX, startY, startRight, startBottom;
    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panelEl.getBoundingClientRect();
      startRight = window.innerWidth - rect.right;
      startBottom = window.innerHeight - rect.bottom;
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panelEl.style.right = `${Math.max(8, startRight - dx)}px`;
      panelEl.style.bottom = `${Math.max(8, startBottom - dy)}px`;
    });
    window.addEventListener("mouseup", () => (dragging = false));
  }

  // ---------------------------------------------------------------------
  // Realtime connection
  // ---------------------------------------------------------------------
  function connect() {
    if (!settings?.serverUrl) return;
    setStatus("connecting");
    const params = new URLSearchParams({
      room: ROOM,
      name: settings.mode === "account" && settings.displayName ? settings.displayName : guest.name,
      guestId: guest.id,
      token: settings.mode === "account" ? settings.authToken || "" : "",
    });
    try {
      ws = new WebSocket(`${settings.serverUrl}?${params.toString()}`);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectDelay = 1000;
    };

    ws.onmessage = (evt) => {
      let data;
      try {
        data = JSON.parse(evt.data);
      } catch {
        return;
      }
      handleServerMessage(data);
    };

    ws.onclose = () => {
      setStatus("offline");
      reportState(false);
      scheduleReconnect();
    };

    ws.onerror = () => ws.close();
  }

  function scheduleReconnect() {
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.7, 20000);
  }

  function reconnect() {
    if (ws) ws.close();
    connect();
  }

  function handleServerMessage(data) {
    switch (data.type) {
      case "history":
        messagesEl.innerHTML = "";
        for (const m of data.messages || []) {
          appendMessage({ ...m, mine: m.guestId === guest.id });
        }
        setStatus("connected", data.participants ?? 1);
        reportState(true, data.participants);
        break;
      case "message":
        appendMessage({ ...data, mine: data.guestId === guest.id });
        break;
      case "voice":
        appendMessage({ ...data, mine: data.guestId === guest.id, voiceUrl: `data:audio/webm;base64,${data.audio}` });
        break;
      case "presence":
        setStatus("connected", data.participants);
        reportState(true, data.participants);
        break;
      case "system":
        appendMessage({ system: true, text: data.text });
        break;
      default:
        break;
    }
  }

  function reportState(connected = true, participants = 0) {
    chrome.runtime.sendMessage({
      type: "STATE_UPDATE",
      connected,
      participants,
      room: ROOM,
      unread,
    });
  }

  function sendTextMessage() {
    const text = inputEl.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "message", text }));
    inputEl.value = "";
  }

  // ---------------------------------------------------------------------
  // Voice messages
  // ---------------------------------------------------------------------
  async function toggleRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => recordChunks.push(e.data);
      mediaRecorder.onstop = onRecordingStop;
      mediaRecorder.start();
      recordStart = Date.now();
      micBtn.classList.add("st-recording");
      recordTimer = setTimeout(() => mediaRecorder?.state === "recording" && mediaRecorder.stop(), MAX_VOICE_SECONDS * 1000);
    } catch {
      alert("SiteTalk needs microphone access to send a voice message.");
    }
  }

  async function onRecordingStop() {
    clearTimeout(recordTimer);
    micBtn.classList.remove("st-recording");
    const seconds = Math.round((Date.now() - recordStart) / 1000);
    const blob = new Blob(recordChunks, { type: "audio/webm" });
    if (blob.size === 0 || seconds < 1) return;
    const base64 = await blobToBase64(blob);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "voice", audio: base64, seconds }));
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(blob);
    });
  }

  // ---------------------------------------------------------------------
  // Styles (scoped inside the Shadow DOM — cannot leak into the host page)
  // ---------------------------------------------------------------------
  const CSS = `
    :host, .st-wrap, .st-wrap * { box-sizing: border-box; font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; }
    .st-wrap { position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; }
    .st-launcher {
      width: 52px; height: 52px; border-radius: 50%; border: none; cursor: pointer;
      background: linear-gradient(135deg, #3D5AFE, #00C2A8); color: #fff;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 24px rgba(20, 24, 40, 0.28); position: relative;
      transition: transform .15s ease;
    }
    .st-launcher:hover { transform: translateY(-2px); }
    .st-unread {
      position: absolute; top: -4px; right: -4px; background: #FF5D5D; color: #fff;
      font-size: 11px; font-weight: 700; min-width: 18px; height: 18px; border-radius: 9px;
      display: flex; align-items: center; justify-content: center; padding: 0 4px;
      border: 2px solid #fff;
    }
    .st-unread[hidden] { display: none !important; }
    .st-panel {
      position: fixed; bottom: 84px; right: 20px; width: 320px; height: 440px;
      background: #14161F; color: #EDEEF3; border-radius: 16px; overflow: hidden;
      box-shadow: 0 20px 60px rgba(10, 12, 20, 0.45); display: flex; flex-direction: column;
      border: 1px solid rgba(255,255,255,0.06);
    }
    /* The [hidden] attribute normally maps to display:none via the browser's
       default stylesheet, but that default loses to our own "display: flex"
       rule above (author styles always beat user-agent styles). Without this
       override, toggling .hidden in JS does nothing visible — this is the
       actual fix for the minimize button (and the unread badge below). */
    .st-panel[hidden] { display: none !important; }
    .st-header {
      display: flex; align-items: center; justify-content: space-between; padding: 12px 14px;
      background: #1B1E2B; cursor: move; user-select: none; border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .st-header-left { display: flex; align-items: center; gap: 8px; }
    .st-dot { width: 8px; height: 8px; border-radius: 50%; background: #6b7280; flex: none; }
    .st-dot-connected { background: #2ECC71; box-shadow: 0 0 6px #2ECC71; }
    .st-dot-connecting { background: #F5A623; }
    .st-dot-offline { background: #FF5D5D; }
    .st-titles { line-height: 1.2; }
    .st-title { font-weight: 700; font-size: 13px; letter-spacing: .2px; }
    .st-subtitle { font-size: 11px; color: #9AA0B4; }
    .st-header-right { display: flex; align-items: center; gap: 8px; }
    .st-status { font-size: 11px; color: #9AA0B4; }
    .st-icon-btn {
      background: transparent; border: none; color: #C9CCDA; cursor: pointer; font-size: 16px;
      width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
    }
    .st-icon-btn:hover { background: rgba(255,255,255,0.08); }
    .st-messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .st-messages::-webkit-scrollbar { width: 6px; }
    .st-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
    .st-row { display: flex; }
    .st-row-mine { justify-content: flex-end; }
    .st-row-system { justify-content: center; }
    .st-system { font-size: 11px; color: #757C93; font-style: italic; }
    .st-bubble {
      max-width: 78%; background: #22263A; padding: 8px 10px; border-radius: 12px 12px 12px 3px;
      font-size: 13px;
    }
    .st-row-mine .st-bubble { background: linear-gradient(135deg, #3D5AFE, #2843d1); border-radius: 12px 12px 3px 12px; }
    .st-name { font-size: 11px; font-weight: 700; color: #9AA0B4; margin-bottom: 2px; }
    .st-row-mine .st-name { color: rgba(255,255,255,0.75); }
    .st-text { line-height: 1.4; word-break: break-word; }
    .st-time { font-size: 10px; color: #757C93; margin-top: 3px; text-align: right; }
    .st-row-mine .st-time { color: rgba(255,255,255,0.6); }
    .st-composer {
      display: flex; align-items: center; gap: 6px; padding: 10px; border-top: 1px solid rgba(255,255,255,0.06);
      background: #1B1E2B;
    }
    .st-input {
      flex: 1; background: #14161F; border: 1px solid rgba(255,255,255,0.08); color: #EDEEF3;
      border-radius: 10px; padding: 8px 10px; font-size: 13px; outline: none;
    }
    .st-input:focus { border-color: #3D5AFE; }
    .st-send, .st-mic {
      background: #22263A; border: none; color: #C9CCDA; width: 32px; height: 32px; border-radius: 10px;
      cursor: pointer; display: flex; align-items: center; justify-content: center; flex: none;
    }
    .st-send:hover, .st-mic:hover { background: #2c3150; }
    .st-mic.st-recording { background: #FF5D5D; color: #fff; animation: st-pulse 1s infinite; }
    @keyframes st-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .6; } }
    .st-footer {
      display: flex; align-items: center; gap: 6px; padding: 6px 12px 10px; font-size: 11px; color: #757C93;
      background: #1B1E2B;
    }
    .st-linklike { background: none; border: none; color: #7C9BFF; cursor: pointer; font-size: 11px; padding: 0; }
    .st-sep { color: #444a63; }
  `;
})();
