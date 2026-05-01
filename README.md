# DomainAge — Chrome extension

> Know how old any website really is — right from your toolbar.

**🌐 Live site:** https://domainages.netlify.app

DomainAge is a free Chrome extension that shows you a domain's age, expiry, tech stack, registrar, and trust signals in one click. Built to help you spot scam sites, inspect competitors, and keep an eye on domain renewals.

![DomainAge](icons/icon128.png)

---

## ✨ Features

- **📅 Domain age timeline** — exact years, months, days + visual lifecycle bar
- **🛠️ Tech stack detection** — 50+ technologies (React, WordPress, Stripe, Cloudflare, etc.)
- **⏳ Watchlist with expiry alerts** — desktop notifications 30/14/7/3/1 days before expiry
- **⚡ Toolbar badge** — every site's age shown right on the icon (cached locally for 7 days)
- **🌐 DNS & registrar info** — IPs, nameservers, registrar via Cloudflare DoH
- **📚 Wayback + SSL** — one-click links to archive.org and Qualys SSL Labs
- **🔍 Right-click context menu** — inspect any link without leaving the page
- **📋 Copy summary** — share-ready one-line summary of every domain
- **🌗 Dark mode** — auto-follows system theme
- **⌨️ Keyboard shortcut** — `Alt + Shift + D` opens the popup any time

---

## 🚀 Install

### Method 1 — From the live site (easiest)

1. Visit https://domainages.netlify.app
2. Click **Download**
3. Unzip the file
4. Go to `chrome://extensions`, enable **Developer mode**
5. Click **Load unpacked** and select the unzipped folder

### Method 2 — From this repo

```bash
git clone https://github.com/hassanasghardeveloper-svg/domain-age-checker.git
```

Then load the cloned folder via `chrome://extensions` → **Load unpacked**.

Works in **Chrome, Edge, Brave, Arc, Opera, Vivaldi** — any Chromium-based browser.

---

## 🧪 Try it on a real site

Open any website and click the toolbar icon. Some good sites to test it on:

- [google.com](https://google.com) — should show ~27 years old
- [github.com](https://github.com) — ~17 years old
- [stripe.com](https://stripe.com) — ~14 years old, full tech stack visible
- [youcineapks.com.br](https://youcineapks.com.br) — a recently launched APK directory (good test for "new domain" badge)

The toolbar badge will turn red for very new domains (< 30 days) — a useful warning sign for unfamiliar sites.

---

## 🏗️ Project structure

```
domain-age-checker/
├── manifest.json          # MV3 extension manifest
├── popup.html / .css / .js  # The toolbar popup UI
├── background.js          # Service worker (badge, alarms, watchlist)
├── welcome.html           # First-install welcome screen
├── options.html           # Settings page
├── icons/                 # 16 / 32 / 48 / 128 px icons
└── website/               # Landing site (deployed to Netlify)
    ├── index.html
    ├── styles.css
    └── DomainAge.zip      # Generated downloadable bundle
```

---

## 🛠️ Tech & data sources

- **Manifest V3** Chrome extension
- Domain data via **[RDAP](https://rdap.org)** (the modern WHOIS replacement, free, no API key)
- DNS queries via **[Cloudflare DoH](https://1.1.1.1/dns/)** (free, no API key)
- 100% client-side — no analytics, no servers, no tracking
- Results cached locally for 7 days

---

## 🔒 Privacy

DomainAge is privacy-first by design:

- ✅ Only the **bare domain** is sent to RDAP / Cloudflare — never the full URL
- ✅ All caching is **local** (`chrome.storage.local`)
- ✅ No accounts, no analytics, no telemetry
- ✅ Open source — read every line of code in this repo

---

## 🧰 Build the downloadable ZIP

From the project root:

```powershell
# PowerShell (Windows)
Compress-Archive -Path manifest.json,popup.*,welcome.*,options.*,background.js,icons -DestinationPath website\DomainAge.zip -Force
```

```bash
# bash / macOS / Linux
zip -r website/DomainAge.zip manifest.json popup.* welcome.* options.* background.js icons
```

---

## 📜 License

MIT — do whatever you want with it. Attribution appreciated but not required.

---

## 🙌 Acknowledgements

- Free RDAP service from [rdap.org](https://rdap.org)
- Free DNS-over-HTTPS from [Cloudflare](https://1.1.1.1)
- Tested in the wild on sites like [youcineapks.com.br](https://youcineapks.com.br) and many others

---

**🌐 Live site:** https://domainages.netlify.app

If you find DomainAge useful, share it with someone who deserves to know how old that sketchy site really is. ⭐
