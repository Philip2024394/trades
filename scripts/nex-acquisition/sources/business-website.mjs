// NEX Universal Acquisition Engine · enrichment source · business website.
//
// For any candidate that carries a website URL, fetch the site (and /contact
// /kontak /hubungi) and extract contact channels from the business's OWN
// legitimate public info. Never scrapes third-party platforms.
//
// Vertical-agnostic: works for Food, Hotels, Villas, etc. — anywhere a
// business is likely to publish a WhatsApp/phone on their own site.

const USER_AGENT = "NEX-Acquisition/1.0 (+https://nex.example · public-info-only)";
const FETCH_TIMEOUT_MS = 15000;

const WHATSAPP_PATTERNS = [
  /https?:\/\/wa\.me\/(\+?[\d]+)/gi,
  /https?:\/\/api\.whatsapp\.com\/send\?phone=(\+?[\d]+)/gi,
  /https?:\/\/chat\.whatsapp\.com\/([A-Za-z0-9]+)/gi,
];
const TEL_PATTERNS = [
  /tel:(\+?[\d\s\-().]+)/gi,
];
const IG_PATTERN = /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]+)/gi;
const FB_PATTERN = /https?:\/\/(?:www\.)?facebook\.com\/([A-Za-z0-9_.]+)/gi;

async function safeFetch(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml" },
      signal: ac.signal,
    });
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) return null;
    return await resp.text();
  } catch { return null; }
  finally { clearTimeout(t); }
}

function normaliseWhatsApp(raw) {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 8) return null;
  return "+" + digits;
}
function normalisePhone(raw) {
  const cleaned = String(raw).trim().replace(/\s+/g, "").replace(/[()]/g, "");
  if (cleaned.replace(/\D/g, "").length < 7) return null;
  return cleaned;
}

function extractFromHtml(html) {
  const gain = {};
  const whatsappMatches = new Set();
  for (const p of WHATSAPP_PATTERNS) {
    for (const m of html.matchAll(p)) {
      const n = normaliseWhatsApp(m[1]);
      if (n) whatsappMatches.add(n);
    }
  }
  if (whatsappMatches.size > 0) gain.whatsapp = Array.from(whatsappMatches)[0];

  const phoneMatches = new Set();
  for (const p of TEL_PATTERNS) {
    for (const m of html.matchAll(p)) {
      const n = normalisePhone(m[1]);
      if (n) phoneMatches.add(n);
    }
  }
  if (phoneMatches.size > 0) gain.phone = Array.from(phoneMatches)[0];

  const igMatches = new Set();
  for (const m of html.matchAll(IG_PATTERN)) {
    const h = m[1];
    if (h && !["reel","p","stories","explore"].includes(h)) igMatches.add(h);
  }
  if (igMatches.size > 0) gain.instagram = Array.from(igMatches)[0];

  const fbMatches = new Set();
  for (const m of html.matchAll(FB_PATTERN)) {
    const h = m[1];
    if (h && !["sharer","dialog","tr"].includes(h)) fbMatches.add(h);
  }
  if (fbMatches.size > 0) gain.facebook = Array.from(fbMatches)[0];

  return gain;
}

export function businessWebsiteSource() {
  return {
    name: "business_website",
    async enrich({ record, config, log }) {
      const website = record.website ?? record.existing?.website;
      if (!website) return null;

      const url = website.startsWith("http") ? website : "https://" + website;
      const gain = {};

      const homepage = await safeFetch(url);
      if (homepage) Object.assign(gain, extractFromHtml(homepage));

      if (!gain.whatsapp || !gain.phone) {
        const base = url.replace(/\/$/, "");
        for (const path of ["/contact", "/kontak", "/hubungi"]) {
          if (gain.whatsapp && gain.phone) break;
          const sub = await safeFetch(base + path);
          if (sub) {
            const extra = extractFromHtml(sub);
            if (!gain.whatsapp && extra.whatsapp) gain.whatsapp = extra.whatsapp;
            if (!gain.phone && extra.phone) gain.phone = extra.phone;
            if (!gain.instagram && extra.instagram) gain.instagram = extra.instagram;
            if (!gain.facebook && extra.facebook) gain.facebook = extra.facebook;
          }
        }
      }

      if (Object.keys(gain).length === 0) return null;
      gain._sourceType = "official_website";
      gain._sourceReference = url;
      gain._sourceLicenceTerms = "official business website · public info · attribution not required";
      return gain;
    },
  };
}
