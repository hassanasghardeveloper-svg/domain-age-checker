document.getElementById("tryNow").addEventListener("click", async () => {
  // Open a real popular site in a new tab so the badge can populate and the
  // toolbar popup has something meaningful to show.
  let tab;
  try {
    tab = await chrome.tabs.create({
      url: "https://www.google.com",
      active: true,
    });
  } catch {}

  // Try to open the actual toolbar action popup (Chrome 127+, MV3).
  // If not supported / blocked, the user already sees the new tab + badge
  // and can click the toolbar icon themselves.
  if (chrome.action && typeof chrome.action.openPopup === "function") {
    try {
      // Small delay so the new tab is the active context first.
      setTimeout(() => {
        chrome.action.openPopup().catch(() => {});
      }, 600);
    } catch {}
  }
});

document.getElementById("openSettings").addEventListener("click", () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("options.html"));
  }
});
