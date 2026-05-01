const DEFAULTS = {
  autoFetch: true,
  badgeFormat: "auto",
  dateFormat: "short",
  theme: "auto",
};

let savedTimer = null;

async function loadSettings() {
  try {
    const data = await chrome.storage.sync.get(DEFAULTS);
    return { ...DEFAULTS, ...data };
  } catch {
    return { ...DEFAULTS };
  }
}

async function saveSetting(key, value) {
  try {
    await chrome.storage.sync.set({ [key]: value });
    showSavedToast();
  } catch {}
}

function showSavedToast() {
  const t = document.getElementById("savedToast");
  t.classList.remove("hidden");
  if (savedTimer) clearTimeout(savedTimer);
  savedTimer = setTimeout(() => t.classList.add("hidden"), 1400);
}

function applyTheme(theme) {
  document.documentElement.classList.remove("theme-light", "theme-dark");
  if (theme === "light") document.documentElement.classList.add("theme-light");
  else if (theme === "dark")
    document.documentElement.classList.add("theme-dark");
}

async function updateCounts() {
  try {
    const all = await chrome.storage.local.get(null);
    const ageKeys = Object.keys(all).filter((k) => k.startsWith("age:"));
    const ccount = ageKeys.length;
    document.getElementById("cacheCount").textContent =
      ccount === 0
        ? "Empty"
        : `${ccount} domain${ccount === 1 ? "" : "s"} cached`;

    const history = all.history || [];
    document.getElementById("historyCount").textContent =
      history.length === 0
        ? "Empty"
        : `${history.length} domain${history.length === 1 ? "" : "s"}`;
  } catch {}
}

async function init() {
  const settings = await loadSettings();
  document.getElementById("theme").value = settings.theme;
  document.getElementById("dateFormat").value = settings.dateFormat;
  document.getElementById("autoFetch").checked = settings.autoFetch;
  document.getElementById("badgeFormat").value = settings.badgeFormat;

  applyTheme(settings.theme);

  document.getElementById("theme").addEventListener("change", (e) => {
    saveSetting("theme", e.target.value);
    applyTheme(e.target.value);
  });
  document.getElementById("dateFormat").addEventListener("change", (e) => {
    saveSetting("dateFormat", e.target.value);
  });
  document.getElementById("autoFetch").addEventListener("change", (e) => {
    saveSetting("autoFetch", e.target.checked);
  });
  document.getElementById("badgeFormat").addEventListener("change", (e) => {
    saveSetting("badgeFormat", e.target.value);
  });

  document
    .getElementById("clearCache")
    .addEventListener("click", async () => {
      if (!confirm("Clear all cached domain age data?")) return;
      try {
        const all = await chrome.storage.local.get(null);
        const ageKeys = Object.keys(all).filter((k) => k.startsWith("age:"));
        if (ageKeys.length) await chrome.storage.local.remove(ageKeys);
        await updateCounts();
      } catch {}
    });

  document
    .getElementById("clearHistory")
    .addEventListener("click", async () => {
      if (!confirm("Clear recent history?")) return;
      try {
        await chrome.storage.local.remove("history");
        await updateCounts();
      } catch {}
    });

  await updateCounts();
}

init();
