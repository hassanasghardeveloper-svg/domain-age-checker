const els = {
  domain: document.getElementById("domain"),
  favicon: document.getElementById("favicon"),
  recheck: document.getElementById("recheck"),
  copyBtn: document.getElementById("copyBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  history: document.getElementById("history"),
  historyList: document.getElementById("historyList"),
  historyClear: document.getElementById("historyClear"),
  result: document.getElementById("result"),
  loading: document.getElementById("loading"),
  error: document.getElementById("error"),
  errorMsg: document.getElementById("errorMsg"),
  ageYears: document.getElementById("ageYears"),
  ageUnit: document.getElementById("ageUnit"),
  ageSub: document.getElementById("ageSub"),
  tlFill: document.getElementById("tlFill"),
  tlNow: document.getElementById("tlNow"),
  created: document.getElementById("created"),
  expires: document.getElementById("expires"),
  registrar: document.getElementById("registrar"),
  updated: document.getElementById("updated"),
  totalDays: document.getElementById("totalDays"),
  dnsA: document.getElementById("dnsA"),
  dnsNs: document.getElementById("dnsNs"),
  waybackBtn: document.getElementById("waybackBtn"),
  sslBtn: document.getElementById("sslBtn"),
  pagesBtn: document.getElementById("pagesBtn"),
  pagesCount: document.getElementById("pagesCount"),
  pagesValueBtn: document.getElementById("pagesValueBtn"),
  pinBtn: document.getElementById("pinBtn"),
  watchlist: document.getElementById("watchlist"),
  watchlistList: document.getElementById("watchlistList"),
  watchlistCount: document.getElementById("watchlistCount"),
  techSection: document.getElementById("techSection"),
  techStack: document.getElementById("techStack"),
};

let lastSitemapUrl = null;
let lastExpiresAt = null;
let activeTabIdForTech = null;
const WATCHLIST_KEY = "watchlist";

const FALLBACK_FAVICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%236366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></svg>'
  );

let currentDomain = null;
let lastSummary = "";
const HISTORY_KEY = "history";
const HISTORY_LIMIT = 12;

const SETTINGS_DEFAULTS = {
  autoFetch: true,
  badgeFormat: "auto",
  dateFormat: "short",
  theme: "auto",
};
let settings = { ...SETTINGS_DEFAULTS };

async function loadSettings() {
  try {
    const data = await chrome.storage.sync.get(SETTINGS_DEFAULTS);
    settings = { ...SETTINGS_DEFAULTS, ...data };
  } catch {}
}

function applyTheme() {
  document.documentElement.classList.remove("theme-light", "theme-dark");
  if (settings.theme === "light")
    document.documentElement.classList.add("theme-light");
  else if (settings.theme === "dark")
    document.documentElement.classList.add("theme-dark");
}

function setFavicon(domain) {
  if (!els.favicon) return;
  els.favicon.onerror = () => {
    els.favicon.onerror = null;
    els.favicon.src = FALLBACK_FAVICON;
  };
  els.favicon.src = domain
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
    : FALLBACK_FAVICON;
}

function extractRegistrableDomain(hostname) {
  if (!hostname) return null;
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length < 2) return hostname;
  const twoPartTlds = new Set([
    "co.uk", "ac.uk", "gov.uk", "org.uk", "net.uk",
    "com.au", "net.au", "org.au", "edu.au", "gov.au",
    "co.in", "net.in", "org.in",
    "com.pk", "net.pk", "org.pk", "edu.pk", "gov.pk",
    "co.jp", "ne.jp", "or.jp",
    "com.br", "com.cn", "com.mx", "com.tr", "com.sg",
  ]);
  const last2 = parts.slice(-2).join(".");
  const last3 = parts.slice(-3).join(".");
  if (parts.length >= 3 && twoPartTlds.has(last2)) return last3;
  return last2;
}

function cleanInputDomain(input) {
  if (!input) return null;
  let domain = input.toLowerCase().trim();
  domain = domain.replace(/^https?:\/\//, "");
  domain = domain.split("/")[0].split("?")[0];
  domain = domain.replace(/^www\./, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return null;
  return extractRegistrableDomain(domain);
}

function getEventDate(events, action) {
  if (!Array.isArray(events)) return null;
  const ev = events.find((e) => e.eventAction === action);
  return ev?.eventDate || null;
}

function getRegistrar(entities) {
  if (!Array.isArray(entities)) return null;
  for (const e of entities) {
    if (e.roles?.includes("registrar")) {
      const vcard = e.vcardArray?.[1];
      if (Array.isArray(vcard)) {
        const fn = vcard.find((row) => row[0] === "fn");
        if (fn?.[3]) return fn[3];
      }
      if (e.handle) return e.handle;
    }
  }
  return null;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  switch (settings.dateFormat) {
    case "long":
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    case "iso":
      return d.toISOString().split("T")[0];
    case "relative":
      return formatRelative(d);
    case "short":
    default:
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
  }
}

function formatRelative(d) {
  const now = Date.now();
  const diff = now - d.getTime();
  const abs = Math.abs(diff);
  const day = 86400000;
  const future = diff < 0;
  if (abs < day) return "today";
  if (abs < 30 * day) {
    const days = Math.floor(abs / day);
    return future
      ? `in ${days} day${days === 1 ? "" : "s"}`
      : `${days} day${days === 1 ? "" : "s"} ago`;
  }
  if (abs < 365 * day) {
    const months = Math.floor(abs / (30 * day));
    return future
      ? `in ${months} month${months === 1 ? "" : "s"}`
      : `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(abs / (365.25 * day));
  return future
    ? `in ${years} year${years === 1 ? "" : "s"}`
    : `${years} year${years === 1 ? "" : "s"} ago`;
}

function ageBreakdown(iso) {
  if (!iso) return null;
  const start = new Date(iso);
  if (isNaN(start.getTime())) return null;
  const end = new Date();
  if (end < start) return { years: 0, months: 0, days: 0, totalDays: 0 };

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalDays = Math.floor(
    (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
  );
  return { years, months, days, totalDays };
}

function setTimeline(createdIso, expiresIso) {
  if (!createdIso || !expiresIso) {
    els.tlFill.style.width = "0%";
    els.tlNow.style.left = "0%";
    return;
  }
  const start = new Date(createdIso).getTime();
  const end = new Date(expiresIso).getTime();
  const now = Date.now();
  if (!isFinite(start) || !isFinite(end) || end <= start) return;

  const pct = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
  requestAnimationFrame(() => {
    els.tlFill.style.width = `${pct}%`;
    els.tlNow.style.left = `${pct}%`;
  });
}

function setActionLinks(domain) {
  els.waybackBtn.href = `https://web.archive.org/web/*/${encodeURIComponent(domain)}`;
  els.sslBtn.href = `https://www.ssllabs.com/ssltest/analyze.html?d=${encodeURIComponent(domain)}`;
  els.pagesBtn.href = `https://www.google.com/search?q=${encodeURIComponent("site:" + domain)}`;
}

async function fetchRdap(domain) {
  const res = await fetch(
    `https://rdap.org/domain/${encodeURIComponent(domain)}`,
    { headers: { Accept: "application/rdap+json" } }
  );
  if (!res.ok) {
    if (res.status === 404)
      throw new Error("Domain not found in the RDAP registry.");
    throw new Error(`Lookup failed (HTTP ${res.status}).`);
  }
  return res.json();
}

async function hasAllUrlsPermission() {
  try {
    return await chrome.permissions.contains({ origins: ["<all_urls>"] });
  } catch {
    return false;
  }
}

async function requestAllUrlsPermission() {
  try {
    return await chrome.permissions.request({ origins: ["<all_urls>"] });
  } catch {
    return false;
  }
}

async function fetchSitemapStats(domain) {
  const cacheKey = `sitemap:${domain}`;
  try {
    const c = await chrome.storage.local.get(cacheKey);
    const entry = c[cacheKey];
    if (entry && Date.now() - entry.ts < 7 * 86400000) return entry;
  } catch {}

  const ok = await hasAllUrlsPermission();
  if (!ok) return { count: null, sitemapUrl: null, needsPermission: true };

  const candidates = ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml"];
  for (const path of candidates) {
    const url = `https://${domain}${path}`;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const text = await res.text();
      if (!text || text.length < 30) continue;

      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/xml");
      if (doc.querySelector("parsererror")) continue;

      const urls = doc.querySelectorAll("url");
      if (urls.length > 0) {
        const result = { count: urls.length, sitemapUrl: url, ts: Date.now(), exact: true };
        try { await chrome.storage.local.set({ [cacheKey]: result }); } catch {}
        return result;
      }

      const childLocs = Array.from(doc.querySelectorAll("sitemap > loc"))
        .map((el) => (el.textContent || "").trim())
        .filter(Boolean);
      if (childLocs.length > 0) {
        const sample = childLocs.slice(0, 3);
        let sampledTotal = 0;
        let sampledOk = 0;
        for (const child of sample) {
          try {
            const cctrl = new AbortController();
            const ctimer = setTimeout(() => cctrl.abort(), 5000);
            const cres = await fetch(child, { signal: cctrl.signal });
            clearTimeout(ctimer);
            if (!cres.ok) continue;
            const ctext = await cres.text();
            const cdoc = parser.parseFromString(ctext, "text/xml");
            sampledTotal += cdoc.querySelectorAll("url").length;
            sampledOk += 1;
          } catch {}
        }
        if (sampledOk > 0) {
          const exact = childLocs.length === sample.length;
          const avg = sampledTotal / sampledOk;
          const estimated = exact ? sampledTotal : Math.round(avg * childLocs.length);
          const result = {
            count: estimated,
            sitemapUrl: url,
            ts: Date.now(),
            exact,
            childCount: childLocs.length,
          };
          try { await chrome.storage.local.set({ [cacheKey]: result }); } catch {}
          return result;
        }
        return { count: null, sitemapUrl: url };
      }
    } catch {}
  }
  return { count: null, sitemapUrl: `https://${domain}/sitemap.xml` };
}

function renderSitemap(stats) {
  lastSitemapUrl = stats?.sitemapUrl || null;
  if (!stats) {
    els.pagesCount.textContent = "—";
    els.pagesValueBtn.disabled = true;
    els.pagesValueBtn.title = "";
    return;
  }
  if (stats.needsPermission) {
    els.pagesCount.textContent = "Allow access";
    els.pagesValueBtn.disabled = false;
    els.pagesValueBtn.title = "Click to allow sitemap fetching";
    return;
  }
  if (stats.count == null) {
    els.pagesCount.textContent = "Not found";
    els.pagesValueBtn.disabled = !stats.sitemapUrl;
    els.pagesValueBtn.title = stats.sitemapUrl ? "Open sitemap.xml" : "";
    return;
  }
  const prefix = stats.exact ? "" : "~";
  els.pagesCount.textContent = `${prefix}${stats.count.toLocaleString()} pages →`;
  els.pagesValueBtn.disabled = false;
  els.pagesValueBtn.title = "Open sitemap.xml in a new tab";
}

// ===== Watchlist =====
async function getWatchlist() {
  try {
    const data = await chrome.storage.local.get(WATCHLIST_KEY);
    return data[WATCHLIST_KEY] || [];
  } catch {
    return [];
  }
}

async function setWatchlist(list) {
  try {
    await chrome.storage.local.set({ [WATCHLIST_KEY]: list });
  } catch {}
}

async function isWatched(domain) {
  const list = await getWatchlist();
  return list.some((item) => item.domain === domain);
}

async function toggleWatch(domain, expiresAt) {
  const list = await getWatchlist();
  const idx = list.findIndex((item) => item.domain === domain);
  if (idx >= 0) {
    list.splice(idx, 1);
    await setWatchlist(list);
    return false;
  }
  list.unshift({
    domain,
    expiresAt,
    addedAt: Date.now(),
    lastNotified: {},
  });
  await setWatchlist(list);
  return true;
}

async function updateWatchExpiry(domain, expiresAt) {
  const list = await getWatchlist();
  const idx = list.findIndex((item) => item.domain === domain);
  if (idx < 0) return;
  if (list[idx].expiresAt !== expiresAt) {
    list[idx].expiresAt = expiresAt;
    list[idx].lastNotified = {};
    await setWatchlist(list);
  }
}

async function refreshPinUI() {
  if (!currentDomain) return;
  const watched = await isWatched(currentDomain);
  els.pinBtn.classList.toggle("pinned", watched);
  els.pinBtn.title = watched ? "Remove from watchlist" : "Add to watchlist";
}

function expiryLabel(expiresAt) {
  if (!expiresAt) return { text: "no expiry data", tone: "neutral" };
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!isFinite(ms)) return { text: "no expiry data", tone: "neutral" };
  const days = Math.ceil(ms / 86400000);
  if (days < 0) return { text: `expired ${-days}d ago`, tone: "urgent" };
  if (days === 0) return { text: "expires today", tone: "urgent" };
  if (days <= 7) return { text: `${days}d left`, tone: "urgent" };
  if (days <= 30) return { text: `${days}d left`, tone: "warn" };
  if (days < 365) return { text: `${days}d left`, tone: "neutral" };
  const years = Math.floor(days / 365);
  const remDays = days - years * 365;
  const months = Math.floor(remDays / 30);
  return {
    text: months ? `${years}y ${months}m left` : `${years}y left`,
    tone: "neutral",
  };
}

async function renderWatchlist() {
  const list = await getWatchlist();
  if (!list.length) {
    els.watchlist.classList.add("hidden");
    return;
  }
  els.watchlistCount.textContent = list.length;
  els.watchlist.classList.remove("hidden");
  els.watchlistList.innerHTML = "";

  // Sort: urgent first, then warn, then by expiry ascending
  const sorted = [...list].sort((a, b) => {
    const aMs = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
    const bMs = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
    return aMs - bMs;
  });

  for (const item of sorted) {
    const { text, tone } = expiryLabel(item.expiresAt);
    const row = document.createElement("div");
    row.className = "wl-item";
    if (tone !== "neutral") row.classList.add(tone);

    const dom = document.createElement("button");
    dom.type = "button";
    dom.className = "wl-domain";
    dom.textContent = item.domain;
    dom.title = item.domain;
    dom.addEventListener("click", () => {
      activeTabIdForTech = null;
      checkDomain(item.domain);
    });

    const exp = document.createElement("span");
    exp.className = "wl-expiry";
    exp.textContent = text;

    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "wl-remove";
    rm.title = `Remove ${item.domain} from watchlist`;
    rm.innerHTML =
      '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    rm.addEventListener("click", async (e) => {
      e.stopPropagation();
      const all = await getWatchlist();
      await setWatchlist(all.filter((w) => w.domain !== item.domain));
      await renderWatchlist();
      await refreshPinUI();
    });

    row.appendChild(dom);
    row.appendChild(exp);
    row.appendChild(rm);
    els.watchlistList.appendChild(row);
  }
}

// ===== Tech stack detection =====
function detectTechInPage() {
  const tech = [];
  const html = document.documentElement.outerHTML;
  const has = (re) => re.test(html);
  const add = (name, category) => tech.push({ name, category });
  const w = /** @type {any} */ (window);

  // ===== Generator meta tag =====
  const gen = document.querySelector('meta[name="generator"]')?.content;
  if (gen) {
    const lower = gen.toLowerCase();
    if (lower.includes("wordpress")) add("WordPress", "CMS");
    else if (lower.includes("drupal")) add("Drupal", "CMS");
    else if (lower.includes("joomla")) add("Joomla", "CMS");
    else if (lower.includes("ghost")) add("Ghost", "CMS");
    else if (lower.includes("hugo")) add("Hugo", "Framework");
    else if (lower.includes("jekyll")) add("Jekyll", "Framework");
    else if (lower.includes("gatsby")) add("Gatsby", "Framework");
    else if (lower.includes("docusaurus")) add("Docusaurus", "Framework");
    else if (lower.includes("astro")) add("Astro", "Framework");
    else add(gen.split(" ")[0], "Generator");
  }

  // ===== CMS / E-commerce =====
  if (w.WordPress || has(/\/wp-content\/|\/wp-includes\//)) add("WordPress", "CMS");
  if (w.Shopify || has(/cdn\.shopify\.com/)) add("Shopify", "E-commerce");
  if (w.Drupal) add("Drupal", "CMS");
  if (has(/static\.wixstatic\.com/) || has(/<html[^>]+wix-/)) add("Wix", "CMS");
  if (has(/squarespace\.com/) && document.querySelector("[data-block-json]"))
    add("Squarespace", "CMS");
  if (has(/cdn\.webflow\.com/) || document.querySelector("[data-wf-page]"))
    add("Webflow", "CMS");
  if (w.Magento || has(/\/skin\/frontend\//)) add("Magento", "E-commerce");
  if (has(/\/wp-content\/plugins\/woocommerce\//)) add("WooCommerce", "E-commerce");
  if (has(/cdn\.bigcommerce\.com/)) add("BigCommerce", "E-commerce");
  if (has(/cdn-prod\.medallia\.com/)) add("Medallia", "Analytics");
  if (w.Ghost || has(/ghost\.io|content\.ghost\.org/)) add("Ghost", "CMS");
  if (has(/\.(myshopify\.com)/)) add("Shopify", "E-commerce");
  if (has(/\/_next\//) || w.__NEXT_DATA__) add("Next.js", "Framework");

  // ===== JS frameworks =====
  if (w.__NUXT__) add("Nuxt.js", "Framework");
  if (
    w.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
    document.querySelector("[data-reactroot], [data-react-checksum]") ||
    has(/react(?:-dom)?[@.]/)
  )
    add("React", "Framework");
  if (w.Vue || document.querySelector("[v-cloak], [data-v-app]")) add("Vue.js", "Framework");
  if (document.querySelector("[ng-version]")) {
    const v = document.querySelector("[ng-version]")?.getAttribute("ng-version");
    add("Angular" + (v ? " " + v.split(".")[0] : ""), "Framework");
  }
  if (
    (document.querySelector("[class*='svelte-']") && has(/svelte/i)) ||
    has(/_app\/immutable\//)
  )
    add("Svelte", "Framework");
  if (has(/\/_astro\//)) add("Astro", "Framework");
  if (has(/_app\/immutable\//) && has(/sveltekit/i)) add("SvelteKit", "Framework");
  if (has(/remix\.run\/|__remixContext/)) add("Remix", "Framework");
  if (has(/\/hugo-/i)) add("Hugo", "Framework");

  // ===== UI libraries =====
  if (w.jQuery) {
    const v = w.jQuery.fn?.jquery;
    add("jQuery" + (v ? " " + v.split(".").slice(0, 2).join(".") : ""), "Library");
  }
  if (document.querySelector('link[href*="bootstrap"]') || has(/bootstrap@|bootstrap\.min/))
    add("Bootstrap", "Library");
  if (
    has(/tailwind/i) ||
    document.querySelector('[class*="text-"][class*="-500"]') ||
    document.querySelector('[class*="bg-gradient-to-"]')
  )
    add("Tailwind CSS", "Library");
  if (has(/material-ui|@mui\//)) add("Material UI", "Library");
  if (has(/chakra-ui/i)) add("Chakra UI", "Library");
  if (has(/font-awesome|fontawesome/i)) add("Font Awesome", "Library");
  if (has(/ant-design|antd\//i)) add("Ant Design", "Library");

  // ===== Analytics =====
  if (w.ga || w.gtag || has(/google-analytics\.com|googletagmanager\.com/))
    add("Google Analytics", "Analytics");
  if (has(/googletagmanager\.com\/gtm\.js/)) add("Google Tag Manager", "Analytics");
  if (w.fbq || has(/connect\.facebook\.net\/.*\/fbevents\.js/))
    add("Facebook Pixel", "Analytics");
  if (w.analytics?.SNIPPET_VERSION || has(/cdn\.segment\.com/))
    add("Segment", "Analytics");
  if (has(/static\.hotjar\.com/)) add("Hotjar", "Analytics");
  if (has(/cdn\.mxpnl\.com|mixpanel/i)) add("Mixpanel", "Analytics");
  if (has(/cdn\.amplitude\.com|amplitude\.com\/libs/i)) add("Amplitude", "Analytics");
  if (has(/plausible\.io\/js/)) add("Plausible", "Analytics");
  if (has(/posthog\.com|app\.posthog/i)) add("PostHog", "Analytics");
  if (has(/clarity\.ms/)) add("Microsoft Clarity", "Analytics");

  // ===== Marketing / chat / support =====
  if (has(/js\.hs-scripts\.com|js\.hsforms\.net/)) add("HubSpot", "Marketing");
  if (has(/widget\.intercom\.io|intercomcdn\.com/)) add("Intercom", "Support");
  if (has(/static\.zdassets\.com|zendesk\.com\/embeddable/)) add("Zendesk", "Support");
  if (has(/widget\.drift\.com/)) add("Drift", "Support");
  if (has(/widget-mediator\.zopim\.com/)) add("Zopim", "Support");
  if (has(/cdn\.tawk\.to/)) add("Tawk.to", "Support");
  if (has(/messenger\.providesupport\.com/)) add("LiveChat", "Support");
  if (has(/cdn\.mailchimp\.com|chimpstatic\.com/)) add("Mailchimp", "Marketing");

  // ===== Payments =====
  if (has(/js\.stripe\.com|m\.stripe\.network/)) add("Stripe", "Payments");
  if (has(/paypal\.com\/sdk|paypalobjects\.com/)) add("PayPal", "Payments");
  if (has(/checkout\.razorpay\.com/)) add("Razorpay", "Payments");
  if (has(/squareup\.com|js\.squareup/)) add("Square", "Payments");

  // ===== CDN / hosting =====
  if (has(/cdn\.cloudflare|cloudflareinsights/) || document.querySelector('script[src*="cloudflare"]'))
    add("Cloudflare", "CDN");
  if (has(/cdn\.jsdelivr\.net/)) add("jsDelivr", "CDN");
  if (has(/unpkg\.com/)) add("unpkg", "CDN");
  if (has(/cdn\.fastly\.net|global\.fastly\.net/)) add("Fastly", "CDN");
  if (has(/cdn\.akamai|akamaihd\.net/)) add("Akamai", "CDN");
  if (has(/vercel-analytics|vercel\.app|_vercel/)) add("Vercel", "Hosting");
  if (has(/netlify\.app|netlify-cdn/)) add("Netlify", "Hosting");

  // ===== Fonts =====
  if (
    document.querySelector('link[href*="fonts.googleapis.com"]') ||
    document.querySelector('link[href*="fonts.gstatic.com"]')
  )
    add("Google Fonts", "Fonts");
  if (document.querySelector('link[href*="use.typekit"]')) add("Adobe Fonts", "Fonts");

  // ===== Media / images =====
  if (has(/res\.cloudinary\.com/)) add("Cloudinary", "Media");
  if (has(/imagekit\.io/)) add("ImageKit", "Media");
  if (has(/imgix\.net/)) add("Imgix", "Media");

  // ===== Errors / monitoring =====
  if (has(/sentry-cdn\.com|@sentry\//) || w.Sentry) add("Sentry", "Monitoring");
  if (has(/datadoghq-browser-agent|datadoghq\.com/)) add("Datadog", "Monitoring");

  // ===== Dedupe (last write wins on category) =====
  const map = new Map();
  for (const t of tech) {
    if (!t || !t.name) continue;
    if (!map.has(t.name)) map.set(t.name, t);
  }
  return Array.from(map.values());
}

async function detectTechStack(tabId) {
  if (!tabId) return [];
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: detectTechInPage,
      world: "MAIN",
    });
    return results?.[0]?.result || [];
  } catch {
    return [];
  }
}

async function runTechDetection() {
  if (!activeTabIdForTech) {
    els.techSection.classList.add("hidden");
    return;
  }
  // If we don't have <all_urls> yet, scripting can still run on the active tab
  // because of activeTab permission (granted on user click).
  const stack = await detectTechStack(activeTabIdForTech);
  renderTechStack(stack);
}

function renderTechStack(stack) {
  els.techStack.innerHTML = "";
  if (!stack || stack.length === 0) {
    els.techSection.classList.add("hidden");
    return;
  }
  for (const t of stack) {
    const badge = document.createElement("span");
    badge.className = "tech-badge";
    if (t.category) badge.dataset.cat = t.category;
    badge.textContent = t.name;
    badge.title = t.category ? `${t.category}: ${t.name}` : t.name;
    els.techStack.appendChild(badge);
  }
  els.techSection.classList.remove("hidden");
}

async function fetchDns(domain) {
  const headers = { Accept: "application/dns-json" };
  const [aRes, nsRes] = await Promise.all([
    fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
      { headers }
    ),
    fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=NS`,
      { headers }
    ),
  ]);
  if (!aRes.ok || !nsRes.ok) throw new Error("DNS lookup failed");
  const [aData, nsData] = await Promise.all([aRes.json(), nsRes.json()]);
  const ips = (aData.Answer || [])
    .filter((a) => a.type === 1)
    .map((a) => a.data);
  const nameservers = (nsData.Answer || [])
    .filter((a) => a.type === 2)
    .map((a) => a.data.replace(/\.$/, ""));
  return { ips, nameservers };
}

function renderDns(dns) {
  if (!dns) {
    els.dnsA.textContent = "—";
    els.dnsNs.textContent = "—";
    return;
  }
  els.dnsA.textContent = dns.ips.length ? dns.ips.join(", ") : "—";
  els.dnsA.title = els.dnsA.textContent;
  els.dnsNs.textContent = dns.nameservers.length
    ? dns.nameservers.join(", ")
    : "—";
  els.dnsNs.title = els.dnsNs.textContent;
}

function show(state) {
  els.loading.classList.toggle("hidden", state !== "loading");
  els.result.classList.toggle("hidden", state !== "result");
  els.error.classList.toggle("hidden", state !== "error");
}

function showError(msg) {
  els.errorMsg.textContent = msg;
  show("error");
}

async function lookupDomain(domain) {
  show("loading");
  try {
    const [rdapData, dnsData, sitemapStats] = await Promise.all([
      fetchRdap(domain),
      fetchDns(domain).catch(() => null),
      fetchSitemapStats(domain).catch(() => null),
    ]);

    const created = getEventDate(rdapData.events, "registration");
    const expires = getEventDate(rdapData.events, "expiration");
    const updated = getEventDate(rdapData.events, "last changed");
    const registrar = getRegistrar(rdapData.entities);
    const age = ageBreakdown(created);

    if (!age) {
      showError("Registration date not available for this domain.");
      return;
    }

    els.ageYears.textContent = age.years;
    els.ageUnit.textContent = age.years === 1 ? "year old" : "years old";
    const monthsLbl = age.months === 1 ? "month" : "months";
    const daysLbl = age.days === 1 ? "day" : "days";
    els.ageSub.textContent = `${age.months} ${monthsLbl} · ${age.days} ${daysLbl}`;

    els.created.textContent = formatDate(created);
    els.expires.textContent = formatDate(expires);
    els.updated.textContent = formatDate(updated);
    els.registrar.textContent = registrar || "—";
    els.registrar.title = registrar || "";
    els.totalDays.textContent = `${age.totalDays.toLocaleString()} days`;

    setTimeline(created, expires);
    renderDns(dnsData);
    renderSitemap(sitemapStats);

    lastExpiresAt = expires || null;
    lastSummary = buildSummary(domain, age, created, expires, registrar);
    notifyBadge(domain, age);
    pushHistory(domain);
    if (lastExpiresAt) await updateWatchExpiry(domain, lastExpiresAt);
    await refreshPinUI();
    await renderWatchlist();

    show("result");
    runTechDetection();
  } catch (err) {
    showError(err.message || "Something went wrong.");
  }
}

function buildSummary(domain, age, createdIso, expiresIso, registrar) {
  const ageStr = `${age.years}y ${age.months}m ${age.days}d`;
  const reg = formatDate(createdIso);
  const exp = formatDate(expiresIso);
  const parts = [`${domain}`, `${ageStr} old`, `Registered ${reg}`];
  if (exp !== "—") parts.push(`Expires ${exp}`);
  if (registrar) parts.push(`Registrar: ${registrar}`);
  return parts.join(" · ");
}

function notifyBadge(domain, age) {
  try {
    chrome.runtime.sendMessage({
      type: "domain-checked",
      domain,
      age: { years: age.years + age.months / 12 + age.days / 365.25, totalDays: age.totalDays },
    });
  } catch {}
}

async function pushHistory(domain) {
  try {
    const data = await chrome.storage.local.get(HISTORY_KEY);
    const list = data[HISTORY_KEY] || [];
    const filtered = list.filter((h) => h.domain !== domain);
    filtered.unshift({ domain, ts: Date.now() });
    const trimmed = filtered.slice(0, HISTORY_LIMIT);
    await chrome.storage.local.set({ [HISTORY_KEY]: trimmed });
    renderHistory(trimmed);
  } catch {}
}

async function loadHistory() {
  try {
    const data = await chrome.storage.local.get(HISTORY_KEY);
    renderHistory(data[HISTORY_KEY] || []);
  } catch {}
}

function renderHistory(list) {
  const filtered = (list || []).filter(
    (item) => item.domain && item.domain !== currentDomain
  );
  if (filtered.length === 0) {
    els.history.classList.add("hidden");
    els.historyList.innerHTML = "";
    return;
  }
  els.history.classList.remove("hidden");
  els.historyList.innerHTML = "";
  for (const item of filtered) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "history-chip";
    chip.textContent = item.domain;
    chip.title = item.domain;
    chip.addEventListener("click", () => {
      activeTabIdForTech = null;
      checkDomain(item.domain);
    });
    els.historyList.appendChild(chip);
  }
}

async function checkDomain(domain) {
  if (!domain) return;
  currentDomain = domain;
  els.domain.textContent = domain;
  els.domain.title = domain;
  setFavicon(domain);
  setActionLinks(domain);
  await lookupDomain(domain);
}

function parseHashDomain() {
  const hash = window.location.hash;
  const match = hash.match(/domain=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function init() {
  await loadSettings();
  applyTheme();

  // 1) URL hash override (from context-menu / external trigger)
  const hashDomain = parseHashDomain();
  if (hashDomain) {
    activeTabIdForTech = null;
    const cleaned = cleanInputDomain(hashDomain) || hashDomain;
    await checkDomain(cleaned);
    return;
  }

  // 2) Active tab
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.url) {
      showError("No active tab URL available.");
      return;
    }
    const url = new URL(tab.url);
    if (!/^https?:$/.test(url.protocol)) {
      els.domain.textContent = url.hostname || tab.url;
      showError("Open a regular website to check its domain age.");
      return;
    }
    const domain = extractRegistrableDomain(url.hostname);
    activeTabIdForTech = tab.id;
    await checkDomain(domain);
  } catch (err) {
    showError(err.message || "Could not read the active tab.");
  }
}

els.recheck.addEventListener("click", () => {
  if (currentDomain) {
    checkDomain(currentDomain);
  } else {
    init();
  }
});

els.copyBtn.addEventListener("click", async () => {
  if (!lastSummary) return;
  try {
    await navigator.clipboard.writeText(lastSummary);
    els.copyBtn.classList.add("success");
    setTimeout(() => els.copyBtn.classList.remove("success"), 1500);
  } catch {}
});

els.pagesValueBtn.addEventListener("click", async () => {
  const text = els.pagesCount.textContent;
  if (text === "Allow access") {
    const granted = await requestAllUrlsPermission();
    if (granted && currentDomain) {
      try {
        await chrome.storage.local.remove(`sitemap:${currentDomain}`);
      } catch {}
      const stats = await fetchSitemapStats(currentDomain).catch(() => null);
      renderSitemap(stats);
    }
    return;
  }
  if (lastSitemapUrl) {
    chrome.tabs.create({ url: lastSitemapUrl });
  }
});

els.settingsBtn.addEventListener("click", () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("options.html"));
  }
});

els.historyClear.addEventListener("click", async () => {
  try {
    await chrome.storage.local.remove(HISTORY_KEY);
    renderHistory([]);
  } catch {}
});

els.pinBtn.addEventListener("click", async () => {
  if (!currentDomain) return;
  const nowWatched = await toggleWatch(currentDomain, lastExpiresAt);
  els.pinBtn.classList.toggle("pinned", nowWatched);
  els.pinBtn.title = nowWatched ? "Remove from watchlist" : "Add to watchlist";
  await renderWatchlist();
});

loadHistory();
renderWatchlist();
init();
