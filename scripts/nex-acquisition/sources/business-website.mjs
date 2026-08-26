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

// Image extraction · Chief Architect 2026-08-27 · narrowly scoped pivot.
// Priority: og:image:secure_url > og:image > schema.org JSON-LD image >
// apple-touch-icon fallback. Own-site public info only · ADR-0022 compliant ·
// never GBP/Facebook/Instagram/Google-Image-Search.
const OG_IMAGE_SECURE_PATTERN = /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
const OG_IMAGE_PATTERN        = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
// Also handle content-first, property-second attribute order (both are legal HTML)
const OG_IMAGE_SECURE_ALT     = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["'][^>]*>/gi;
const OG_IMAGE_ALT            = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/gi;
const APPLE_TOUCH_ICON        = /<link[^>]+rel=["']apple-touch-icon(?:-precomposed)?["'][^>]+href=["']([^"']+)["'][^>]*>/gi;
const APPLE_TOUCH_ICON_ALT    = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon(?:-precomposed)?["'][^>]*>/gi;
const JSON_LD_BLOCK           = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

// Resolve a possibly-relative image URL against a base page URL.
// Returns null if unresolvable or clearly invalid.
function resolveImageUrl(raw, baseUrl) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length < 4 || trimmed.length > 2048) return null;
  try {
    const resolved = new URL(trimmed, baseUrl).toString();
    // Only accept http/https (rejects data:, javascript:, etc.)
    if (!/^https?:\/\//i.test(resolved)) return null;
    return resolved;
  } catch { return null; }
}

// Extract image URL(s) from a schema.org JSON-LD script block · safely.
// LocalBusiness / Restaurant / Hotel / etc. all use the same `image` field.
// Handles: string · {url:string} · array of either.
function extractFromJsonLd(jsonText, baseUrl) {
  let parsed;
  try { parsed = JSON.parse(jsonText); } catch { return null; }
  const blocks = Array.isArray(parsed) ? parsed : [parsed];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    // Only trust @type that's a business/place · not Person/Article/Product-in-list
    const t = block["@type"];
    const types = Array.isArray(t) ? t : t ? [t] : [];
    const isBusiness = types.some((x) =>
      typeof x === "string" &&
      /^(LocalBusiness|Restaurant|CafeOrCoffeeShop|Hotel|LodgingBusiness|Bakery|BarOrPub|FastFoodRestaurant|Store|Organization|Place|TouristAttraction)$/i.test(x)
    );
    if (!isBusiness) continue;
    const img = block.image;
    if (typeof img === "string") {
      const r = resolveImageUrl(img, baseUrl);
      if (r) return r;
    } else if (img && typeof img === "object" && !Array.isArray(img) && typeof img.url === "string") {
      const r = resolveImageUrl(img.url, baseUrl);
      if (r) return r;
    } else if (Array.isArray(img)) {
      for (const item of img) {
        if (typeof item === "string") {
          const r = resolveImageUrl(item, baseUrl);
          if (r) return r;
        } else if (item && typeof item === "object" && typeof item.url === "string") {
          const r = resolveImageUrl(item.url, baseUrl);
          if (r) return r;
        }
      }
    }
  }
  return null;
}

// Pick best image from HTML · priority order captured in `image_source_method`.
function extractImageFromHtml(html, baseUrl) {
  // 1. og:image:secure_url (HTTPS preferred)
  for (const p of [OG_IMAGE_SECURE_PATTERN, OG_IMAGE_SECURE_ALT]) {
    for (const m of html.matchAll(p)) {
      const r = resolveImageUrl(m[1], baseUrl);
      if (r) return { url: r, method: "og:image:secure_url" };
    }
  }
  // 2. og:image
  for (const p of [OG_IMAGE_PATTERN, OG_IMAGE_ALT]) {
    for (const m of html.matchAll(p)) {
      const r = resolveImageUrl(m[1], baseUrl);
      if (r) return { url: r, method: "og:image" };
    }
  }
  // 3. schema.org JSON-LD image (only from a business/place @type block)
  for (const m of html.matchAll(JSON_LD_BLOCK)) {
    const found = extractFromJsonLd(m[1], baseUrl);
    if (found) return { url: found, method: "schema.org/JSON-LD" };
  }
  // 4. apple-touch-icon (fallback · smaller · sometimes only option)
  for (const p of [APPLE_TOUCH_ICON, APPLE_TOUCH_ICON_ALT]) {
    for (const m of html.matchAll(p)) {
      const r = resolveImageUrl(m[1], baseUrl);
      if (r) return { url: r, method: "apple-touch-icon" };
    }
  }
  return null;
}

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

function extractFromHtml(html, baseUrl) {
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

  // Image extraction · Chief Architect 2026-08-27 · own-site only.
  // baseUrl is required for resolving relative image paths (og:image often
  // gives "/img/hero.jpg" instead of a full URL).
  if (baseUrl) {
    const img = extractImageFromHtml(html, baseUrl);
    if (img) {
      gain.image_url            = img.url;
      gain.image_source_method  = img.method;   // 'og:image:secure_url' | 'og:image' | 'schema.org/JSON-LD' | 'apple-touch-icon'
    }
  }

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
      if (homepage) Object.assign(gain, extractFromHtml(homepage, url));

      if (!gain.whatsapp || !gain.phone) {
        const base = url.replace(/\/$/, "");
        for (const path of ["/contact", "/kontak", "/hubungi"]) {
          if (gain.whatsapp && gain.phone) break;
          const subUrl = base + path;
          const sub = await safeFetch(subUrl);
          if (sub) {
            const extra = extractFromHtml(sub, subUrl);
            if (!gain.whatsapp && extra.whatsapp) gain.whatsapp = extra.whatsapp;
            if (!gain.phone && extra.phone) gain.phone = extra.phone;
            if (!gain.instagram && extra.instagram) gain.instagram = extra.instagram;
            if (!gain.facebook && extra.facebook) gain.facebook = extra.facebook;
            // Image · only take from contact/kontak page if homepage didn't
            // yield one (homepage's og:image usually wins on quality).
            if (!gain.image_url && extra.image_url) {
              gain.image_url = extra.image_url;
              gain.image_source_method = extra.image_source_method;
            }
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
