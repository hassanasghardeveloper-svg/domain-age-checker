const MENU_ID_LINK = "domainage-check-link";
const MENU_ID_PAGE = "domainage-check-page";
const RDAP_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const BADGE_COLOR = "#6366f1";

const SETTINGS_DEFAULTS = {
  autoFetch: true,
  badgeFormat: "auto",
};
let settings = { ...SETTINGS_DEFAULTS };

async function loadSettings() {
  try {
    const data = await chrome.storage.sync.get(SETTINGS_DEFAULTS);
    settings = { ...SETTINGS_DEFAULTS, ...data };
  } catch {}
}
loadSettings();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.autoFetch) settings.autoFetch = changes.autoFetch.newValue;
  if (changes.badgeFormat) settings.badgeFormat = changes.badgeFormat.newValue;
  // If badge format or auto-fetch changed, refresh badges on all visible tabs
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) updateBadgeForTab(tab);
  });
});

const inFlight = new Map();

const TWO_PART_TLDS = new Set([
  "co.uk", "ac.uk", "gov.uk", "org.uk", "net.uk",
  "com.au", "net.au", "org.au", "edu.au", "gov.au",
  "co.in", "net.in", "org.in",
  "com.pk", "net.pk", "org.pk", "edu.pk", "gov.pk",
  "co.jp", "ne.jp", "or.jp",
  "com.br", "com.cn", "com.mx", "com.tr", "com.sg",
]);

function extractRegistrableDomain(hostname) {
  if (!hostname) return null;
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length < 2) return hostname;
  const last2 = parts.slice(-2).join(".");
  const last3 = parts.slice(-3).join(".");
  if (parts.length >= 3 && TWO_PART_TLDS.has(last2)) return last3;
  return last2;
}

function badgeText(age) {
  if (!age) return "";
  const fmt = settings.badgeFormat || "auto";
  if (fmt === "off") return "";
  const d = age.totalDays;

  if (fmt === "months") {
    const m = Math.max(1, Math.floor(d / 30));
    if (m >= 100) return "99+";
    return m + "m";
  }
  if (fmt === "years") {
    if (d < 365) return "<1y";
    const y = Math.floor(age.years);
    if (y >= 10) return "10+";
    return y + "y";
  }
  // auto
  if (d < 30) return "NEW";
  if (d < 365) {
    const months = Math.max(1, Math.floor(d / 30));
    return months + "m";
  }
  const y = Math.floor(age.years);
  if (y >= 10) return "10+";
  return y + "y";
}

async function getCachedAge(domain) {
  const key = `age:${domain}`;
  const data = await chrome.storage.local.get(key);
  const entry = data[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > RDAP_CACHE_TTL) return null;
  return entry;
}

async function setCachedAge(domain, value) {
  await chrome.storage.local.set({
    [`age:${domain}`]: { ...value, ts: Date.now() },
  });
}

async function fetchAge(domain) {
  if (inFlight.has(domain)) return inFlight.get(domain);
  const promise = (async () => {
    const res = await fetch(
      `https://rdap.org/domain/${encodeURIComponent(domain)}`,
      { headers: { Accept: "application/rdap+json" } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const created = (data.events || []).find(
      (e) => e.eventAction === "registration"
    )?.eventDate;
    if (!created) throw new Error("No registration date");
    const ms = Date.now() - new Date(created).getTime();
    if (ms < 0) throw new Error("Invalid date");
    const totalDays = Math.floor(ms / 86400000);
    const years = ms / (365.25 * 86400000);
    return { years, totalDays };
  })();
  inFlight.set(domain, promise);
  promise.finally(() => inFlight.delete(domain));
  return promise;
}

async function applyBadge(tabId, age) {
  try {
    await chrome.action.setBadgeText({ tabId, text: badgeText(age) });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" });
    }
  } catch {}
}

async function clearBadge(tabId) {
  try {
    await chrome.action.setBadgeText({ tabId, text: "" });
  } catch {}
}

async function setLoadingBadge(tabId) {
  try {
    await chrome.action.setBadgeText({ tabId, text: "…" });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
  } catch {}
}

async function updateBadgeForTab(tab) {
  if (!tab?.id || !tab.url) return;
  let url;
  try { url = new URL(tab.url); } catch { return; }
  if (!/^https?:$/.test(url.protocol)) {
    clearBadge(tab.id);
    return;
  }
  const domain = extractRegistrableDomain(url.hostname);
  if (!domain) {
    clearBadge(tab.id);
    return;
  }

  const cached = await getCachedAge(domain);
  if (cached) {
    applyBadge(tab.id, cached);
    return;
  }

  if (!settings.autoFetch) {
    clearBadge(tab.id);
    return;
  }

  setLoadingBadge(tab.id);
  try {
    const age = await fetchAge(domain);
    await setCachedAge(domain, age);
    // Verify the tab is still on the same domain before applying
    const fresh = await chrome.tabs.get(tab.id).catch(() => null);
    if (!fresh?.url) return;
    try {
      const freshUrl = new URL(fresh.url);
      if (
        /^https?:$/.test(freshUrl.protocol) &&
        extractRegistrableDomain(freshUrl.hostname) === domain
      ) {
        applyBadge(tab.id, age);
      }
    } catch {}
  } catch {
    clearBadge(tab.id);
  }
}

// ===== Context menu =====
const ALARM_NAME = "domainage-watchlist-check";

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.create({
    id: MENU_ID_LINK,
    title: "Check this domain's age",
    contexts: ["link"],
  });
  chrome.contextMenus.create({
    id: MENU_ID_PAGE,
    title: "Check this site's domain age",
    contexts: ["page"],
  });
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: 60 * 12,
  });
  if (details?.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: 60 * 12,
  });
});

// ===== Watchlist + expiry alerts =====
const EXPIRY_THRESHOLDS = [30, 14, 7, 3, 1];

function expiryDateLabel(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "soon";
  }
}

async function checkWatchlistExpiries() {
  try {
    const data = await chrome.storage.local.get("watchlist");
    const watchlist = data.watchlist || [];
    const now = Date.now();
    let dirty = false;

    for (const item of watchlist) {
      if (!item?.expiresAt) continue;
      const expiresMs = new Date(item.expiresAt).getTime();
      if (!isFinite(expiresMs)) continue;
      const daysUntil = Math.ceil((expiresMs - now) / 86400000);
      if (daysUntil < 0) continue;

      if (!item.lastNotified) item.lastNotified = {};

      for (const t of EXPIRY_THRESHOLDS) {
        const key = `d${t}`;
        if (daysUntil <= t && !item.lastNotified[key]) {
          chrome.notifications.create(`expiry-${item.domain}-${t}-${now}`, {
            type: "basic",
            iconUrl: "icons/icon128.png",
            title: `${item.domain} expires soon`,
            message: `Domain expires in ${daysUntil} day${
              daysUntil === 1 ? "" : "s"
            } (${expiryDateLabel(item.expiresAt)})`,
            priority: 1,
          });
          item.lastNotified[key] = now;
          dirty = true;
          break;
        }
      }
    }

    if (dirty) await chrome.storage.local.set({ watchlist });
  } catch (e) {
    console.error("Watchlist check failed", e);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) checkWatchlistExpiries();
});

chrome.notifications.onClicked.addListener((notifId) => {
  const m = notifId.match(/^expiry-([^-]+(?:-[^-]+)*?)-(\d+)-\d+$/);
  if (m) {
    const domain = m[1];
    chrome.windows.create({
      url: `popup.html#domain=${encodeURIComponent(domain)}`,
      type: "popup",
      width: 380,
      height: 660,
    });
  }
  chrome.notifications.clear(notifId);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID_LINK && info.menuItemId !== MENU_ID_PAGE)
    return;
  const url = info.linkUrl || info.pageUrl || tab?.url;
  if (!url) return;
  let hostname = "";
  try { hostname = new URL(url).hostname; } catch { return; }
  if (!hostname) return;
  chrome.windows.create({
    url: `popup.html#domain=${encodeURIComponent(hostname)}`,
    type: "popup",
    width: 380,
    height: 660,
  });
});

// ===== Tab badge updates (from cache only — privacy-friendly) =====
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    updateBadgeForTab(tab);
  } catch {}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    updateBadgeForTab(tab);
  }
});

// ===== Popup -> background messages =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "domain-checked" && msg.domain && msg.age) {
    (async () => {
      await setCachedAge(msg.domain, msg.age);
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (!tab.url || !tab.id) continue;
        try {
          const url = new URL(tab.url);
          if (
            /^https?:$/.test(url.protocol) &&
            extractRegistrableDomain(url.hostname) === msg.domain
          ) {
            applyBadge(tab.id, msg.age);
          }
        } catch {}
      }
    })();
  }
  return false;
});
