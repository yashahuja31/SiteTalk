const send = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));

let settings = null;

init();

async function init() {
  settings = await send({ type: "GET_SETTINGS" });

  const tabState = await send({ type: "GET_TAB_STATE" });
  renderStatus(tabState);

  document.getElementById("guestNameInput").value = await currentGuestName();
  document.getElementById("serverUrlInput").value = settings.serverUrl || "";
  document.getElementById("displayNameInput").value = settings.displayName || "";

  if (settings.mode === "account" && settings.authToken) {
    showLoggedIn(settings.accountEmail || "");
    selectTab("account");
  }

  wireEvents();
}

function renderStatus(state) {
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");
  const room = document.getElementById("roomLabel");
  dot.className = `status-dot ${state.connected ? "connected" : "offline"}`;
  text.textContent = state.connected
    ? `Connected · ${state.participants} ${state.participants === 1 ? "person" : "people"} here`
    : "Not connected on this tab";
  room.textContent = state.room ? `Room: ${state.room}` : "";
}

async function currentGuestName() {
  const { siteTalkGuest } = await chrome.storage.local.get("siteTalkGuest");
  return siteTalkGuest?.name || "Guest";
}

function wireEvents() {
  document.getElementById("openPanelBtn").addEventListener("click", () => {
    send({ type: "TOGGLE_PANEL_FROM_POPUP" });
    window.close();
  });

  document.getElementById("settingsToggle").addEventListener("click", () => {
    const el = document.getElementById("advancedCard");
    el.hidden = !el.hidden;
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  });

  document.getElementById("saveGuestName").addEventListener("click", async () => {
    const name = document.getElementById("guestNameInput").value.trim().slice(0, 24);
    if (!name) return;
    const { siteTalkGuest } = await chrome.storage.local.get("siteTalkGuest");
    await chrome.storage.local.set({ siteTalkGuest: { ...(siteTalkGuest || {}), name, id: siteTalkGuest?.id || crypto.randomUUID() } });
    flash(document.getElementById("saveGuestName"));
  });

  document.getElementById("saveServerUrl").addEventListener("click", async () => {
    const serverUrl = document.getElementById("serverUrlInput").value.trim();
    settings = await send({ type: "SAVE_SETTINGS", settings: { serverUrl } });
    flash(document.getElementById("saveServerUrl"));
  });

  document.getElementById("saveDisplayName").addEventListener("click", async () => {
    const displayName = document.getElementById("displayNameInput").value.trim().slice(0, 24);
    settings = await send({ type: "SAVE_SETTINGS", settings: { displayName } });
    flash(document.getElementById("saveDisplayName"));
  });

  document.getElementById("loginBtn").addEventListener("click", () => authRequest("/api/login"));
  document.getElementById("signupBtn").addEventListener("click", () => authRequest("/api/signup"));

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    settings = await send({ type: "SAVE_SETTINGS", settings: { mode: "anonymous", authToken: null, accountEmail: "" } });
    showLoggedOut();
  });
}

function selectTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${name}`));
}

async function authRequest(path) {
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;
  const errorEl = document.getElementById("authError");
  errorEl.hidden = true;

  if (!email || !password) {
    errorEl.textContent = "Enter an email and password.";
    errorEl.hidden = false;
    return;
  }

  const base = (settings.serverUrl || "").replace(/^wss/, "https").replace(/^ws/, "http");
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong.");

    settings = await send({
      type: "SAVE_SETTINGS",
      settings: { mode: "account", authToken: data.token, accountEmail: email, displayName: settings.displayName || email.split("@")[0] },
    });
    showLoggedIn(email);
  } catch (err) {
    errorEl.textContent = err.message || "Couldn't reach the SiteTalk server. Check the server address under settings.";
    errorEl.hidden = false;
  }
}

function showLoggedIn(email) {
  document.getElementById("loggedOutView").hidden = true;
  document.getElementById("loggedInView").hidden = false;
  document.getElementById("accountEmail").textContent = email;
}

function showLoggedOut() {
  document.getElementById("loggedOutView").hidden = false;
  document.getElementById("loggedInView").hidden = true;
}

function flash(btn) {
  const original = btn.textContent;
  btn.textContent = "Saved ✓";
  setTimeout(() => (btn.textContent = original), 1200);
}
