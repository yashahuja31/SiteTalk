// SiteTalk — background service worker
// Keeps shared config, tracks per-tab connection state for the toolbar badge,
// and relays small messages between the popup and the content script.

const DEFAULT_SETTINGS = {
  serverUrl: "https://sitetalk-neg7.onrender.com",
  displayName: "",
  mode: "anonymous", // "anonymous" | "account"
  authToken: null,
  enabled: true,
};

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    const existing = await chrome.storage.sync.get("settings");
    if (!existing.settings) {
      await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    }
  }
});

// Track live connection + participant count per tab so the popup can show it.
const tabState = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (message.type) {
    case "STATE_UPDATE": {
      if (tabId != null) {
        tabState.set(tabId, {
          connected: !!message.connected,
          participants: message.participants ?? 0,
          room: message.room ?? "",
          unread: message.unread ?? 0,
        });
        chrome.action.setBadgeBackgroundColor({ color: "#3D5AFE" });
        chrome.action.setBadgeText({
          tabId,
          text: message.unread ? String(Math.min(message.unread, 99)) : "",
        });
      }
      break;
    }

    case "GET_TAB_STATE": {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        const state = tab ? tabState.get(tab.id) : null;
        sendResponse(state || { connected: false, participants: 0, room: "" });
      });
      return true; // async response
    }

    case "GET_SETTINGS": {
      chrome.storage.sync.get("settings").then(({ settings }) => {
        sendResponse(settings || DEFAULT_SETTINGS);
      });
      return true;
    }

    case "SAVE_SETTINGS": {
      chrome.storage.sync.get("settings").then(async ({ settings }) => {
        const merged = { ...(settings || DEFAULT_SETTINGS), ...message.settings };
        await chrome.storage.sync.set({ settings: merged });
        // Tell every tab's content script to pick up the new settings.
        chrome.tabs.query({}, (tabs) => {
          for (const t of tabs) {
            chrome.tabs.sendMessage(t.id, { type: "SETTINGS_CHANGED", settings: merged }).catch(() => {});
          }
        });
        sendResponse(merged);
      });
      return true;
    }

    case "TOGGLE_PANEL_FROM_POPUP": {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.id != null) {
          chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" }).catch(() => {});
        }
      });
      break;
    }

    default:
      break;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => tabState.delete(tabId));
