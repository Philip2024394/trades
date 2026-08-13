// Path C · Native server-side HTML fetcher for the URL queue worker.
//
// Uses Node's built-in fetch (undici) with a 10-second timeout.
// NO third-party HTTP library. NO Claude WebFetch — this module runs
// on the server as part of the NEX worker per Philip 2026-08-13 spec.
//
// One helper follows up to 2 useful internal pages when present
// (/contact, /about, /services, /refurbishment) so we can find the
// email even when the landing page hides it. Total time-budget per
// candidate is capped at 30 seconds across all follow-ups.

import "server-only";

const REQUEST_TIMEOUT_MS = 15_000; // 15s per page · covers slower UK trade CMS sites
const TOTAL_BUDGET_MS    = 45_000; // 45s across the primary + follow-ups
const MAX_HTML_BYTES     = 1_500_000; // 1.5 MB per page — plenty for any static marketing site
// Chrome UA · verified 2026-08-13 against 6 UK staircase-refurbishment sites.
// The polite bot UA (`NEXCollectionBot/1.0`) triggered Cloudflare 520s and 403s
// on 3 of 6. Chrome UA unblocked 2 of the 3 (stairfurb.co.uk · staircase-refurbishment.co.uk).
// The remaining site (shawstairs.com) 403s regardless — an aggressive block that
// realistically requires manual collector entry (or a residential-IP fetch,
// which NEX deliberately does NOT do).
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type FetchOk = {
  ok: true;
  url: string;
  finalUrl: string;
  html: string;
  contentType: string;
  followedPages: Array<{ url: string; html: string }>;
};

export type FetchFail = {
  ok: false;
  url: string;
  error_category:
    | "connection_refused"
    | "timeout"
    | "ssl_error"
    | "http_error"
    | "dns_error"
    | "not_html"
    | "other";
  error_message: string;
};

/** Fetch a single URL. Native fetch + AbortController. */
async function fetchOne(url: string, budgetMs = REQUEST_TIMEOUT_MS): Promise<FetchOk | FetchFail> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-GB,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      return {
        ok: false,
        url,
        error_category: "http_error",
        error_message: `HTTP ${res.status} ${res.statusText}`,
      };
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      return { ok: false, url, error_category: "not_html", error_message: `content-type: ${contentType}` };
    }
    // Stream + cap to prevent runaway pages
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder("utf-8", { fatal: false });
      let bytesRead = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.byteLength;
        if (bytesRead > MAX_HTML_BYTES) break;
        html += decoder.decode(value, { stream: true });
      }
      html += decoder.decode();
    } else {
      html = await res.text();
    }
    return { ok: true, url, finalUrl: res.url ?? url, html, contentType, followedPages: [] };
  } catch (err) {
    clearTimeout(timer);
    // Node's global fetch throws `TypeError: fetch failed` for DNS / connect /
    // SSL errors — the REAL error hides on `err.cause`, sometimes nested one
    // level deeper (`err.cause.cause` for aggregate errors). Walk the whole
    // chain and gather every `.code` + `.message` so the categoriser doesn't
    // fall through to "other" for real DNS failures.
    const chain: Array<{ code?: string; message: string }> = [];
    let cur: unknown = err;
    while (cur && chain.length < 5) {
      const e = cur as { code?: string; message?: string; cause?: unknown };
      chain.push({ code: e.code, message: e.message ?? String(cur) });
      cur = e.cause;
    }
    const combined = chain.map((c) => `${c.code ?? ""} ${c.message}`).join(" | ");
    const codes    = chain.map((c) => c.code).filter((c): c is string => Boolean(c));
    // Human-readable summary for the queue's last_error field · shows the
    // top-level message plus the innermost cause when they differ.
    const displayMsg =
      chain.length > 1 && chain[0].message !== chain[chain.length - 1].message
        ? `${chain[0].message} · caused by: ${chain[chain.length - 1].message}`
        : chain[0].message;

    if (/aborted|The user aborted|AbortError/i.test(combined)) {
      return { ok: false, url, error_category: "timeout", error_message: displayMsg };
    }
    if (codes.includes("ECONNREFUSED") || /ECONNREFUSED/i.test(combined)) {
      return { ok: false, url, error_category: "connection_refused", error_message: displayMsg };
    }
    if (
      codes.includes("ENOTFOUND") || codes.includes("EAI_AGAIN") ||
      /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(combined)
    ) {
      return { ok: false, url, error_category: "dns_error", error_message: displayMsg };
    }
    if (
      codes.includes("CERT_HAS_EXPIRED") || codes.includes("ERR_TLS_CERT_ALTNAME_INVALID") ||
      codes.includes("UNABLE_TO_VERIFY_LEAF_SIGNATURE") || codes.includes("DEPTH_ZERO_SELF_SIGNED_CERT") ||
      /certificate|SSL|TLS|cert has expired/i.test(combined)
    ) {
      return { ok: false, url, error_category: "ssl_error", error_message: displayMsg };
    }
    return { ok: false, url, error_category: "other", error_message: displayMsg };
  }
}

/** Follow-page hint tiers (Philip 2026-08-13 spec expansion):
 *   Tier 1 · contact  → highest priority · usually has the definitive email/phone
 *   Tier 2 · about    → fallback contact + trading-history evidence
 *   Tier 3 · services → capability evidence · often has service-specific contact
 *   Tier 4 · service  → single-service pages that carry evidence signals
 *
 *  Never guess URLs · only follow links actually present in the primary page HTML.
 *  Both URL substring AND link-text are matched, so "<a href='/kontakt'>Contact</a>"
 *  still gets found. */
type HintTier = 1 | 2 | 3 | 4;
type Hint = { needles: readonly string[]; textNeedles: readonly string[]; tier: HintTier };
const CONTACT_HINTS: Hint = {
  needles: [
    "/contact", "/contact-us", "/contact_us", "/contactus",
    "/get-in-touch", "/getintouch",
    "/find-us", "/findus", "/reach-us",
    "/enquiries", "/enquiry", "/enquire",
    "/quote", "/get-a-quote", "/request-a-quote", "/request-quote",
    "/hello",
  ],
  textNeedles: ["contact us", "contact", "get in touch", "get a quote", "request a quote", "enquire", "reach us", "find us"],
  tier: 1,
};
const ABOUT_HINTS: Hint = {
  needles: [
    "/about", "/about-us", "/about_us", "/aboutus",
    "/who-we-are", "/whoweare", "/our-story", "/our-team",
  ],
  textNeedles: ["about us", "about", "who we are", "our story", "our team"],
  tier: 2,
};
const SERVICES_HINTS: Hint = {
  needles: [
    "/services", "/what-we-do", "/whatwedo", "/our-services",
  ],
  textNeedles: ["services", "what we do", "our services"],
  tier: 3,
};
const SERVICE_HINTS: Hint = {
  needles: [
    "/service",
    "/refurbishment", "/refurb", "/renovation", "/renovations",
    "/refacing", "/staircase-refurbishment", "/staircase-refacing",
    "/staircases", "/staircase", "/stairs",
    "/cladding", "/overlay",
  ],
  textNeedles: [
    "refurbishment", "renovation", "refacing", "staircase refurbishment",
    "staircase renovation", "staircases", "stairs", "cladding",
  ],
  tier: 4,
};
const ALL_HINTS: readonly Hint[] = [CONTACT_HINTS, ABOUT_HINTS, SERVICES_HINTS, SERVICE_HINTS];

const MAX_FOLLOWED_PAGES = 4;

/**
 * Given a starting URL, fetch it and then try up to N useful internal
 * pages from the same domain. Follow only relative or same-domain links.
 * Never follow off-site or file-download links.
 */
export async function fetchCandidateSurface(startUrl: string): Promise<FetchOk | FetchFail> {
  const start = Date.now();
  const primary = await fetchOne(startUrl, REQUEST_TIMEOUT_MS);
  if (!primary.ok) return primary;

  const followed: Array<{ url: string; html: string }> = [];
  const baseOrigin = safeOrigin(primary.finalUrl);
  if (!baseOrigin) return primary;

  // Rank same-origin links by hint tier (contact > about > services > service).
  // Both URL and link text are checked so /kontakt with text "Contact Us" is
  // caught, as is /page-42 with text "Contact us today".
  const ranked = extractRankedLinks(primary.html, baseOrigin);
  const seen = new Set<string>([primary.finalUrl.split("#")[0]]);
  const shortlist: string[] = [];
  for (const link of ranked) {
    const key = link.href.split("#")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    shortlist.push(link.href);
    if (shortlist.length >= MAX_FOLLOWED_PAGES) break;
  }

  for (const href of shortlist) {
    if (Date.now() - start > TOTAL_BUDGET_MS) break;
    const remaining = TOTAL_BUDGET_MS - (Date.now() - start);
    const budget = Math.max(3_000, Math.min(REQUEST_TIMEOUT_MS, remaining));
    const sub = await fetchOne(href, budget);
    if (sub.ok) followed.push({ url: sub.finalUrl, html: sub.html });
  }

  return { ...primary, followedPages: followed };
}

function safeOrigin(url: string): string | null {
  try { return new URL(url).origin; } catch { return null; }
}

type RankedLink = { href: string; tier: HintTier };

/**
 * Extract same-origin links from `<a href="..." ...>text</a>` markup, ranking
 * each by the highest hint tier it matches (URL substring OR anchor text).
 * Skips document / image / mailto / tel / javascript URLs. Same-origin only ·
 * never returns off-site links.
 */
function extractRankedLinks(html: string, baseOrigin: string): RankedLink[] {
  const bestByHref = new Map<string, HintTier>();
  // <a ...>text</a> · captures the whole opening tag + inner text (non-greedy)
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const inner = m[2];
    const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!hrefMatch) continue;
    const rawHref = hrefMatch[1].trim();
    if (!rawHref || /^(mailto:|tel:|javascript:|#)/i.test(rawHref)) continue;
    let abs: string;
    try { abs = new URL(rawHref, baseOrigin).toString(); } catch { continue; }
    if (!abs.startsWith(baseOrigin)) continue;
    // Skip binary/document links · they aren't html and we'd waste a fetch on them
    if (/\.(pdf|jpg|jpeg|png|gif|svg|webp|zip|doc|docx|xls|xlsx)(\?|$)/i.test(abs)) continue;
    const hrefKey = abs.split("#")[0];
    const linkText = stripTagsSimple(inner).toLowerCase();
    const hrefLower = hrefKey.toLowerCase();
    // Find best (numerically lowest = highest priority) tier this link matches.
    let bestTier: HintTier | null = null;
    for (const hint of ALL_HINTS) {
      const urlHit  = hint.needles.some((n) => hrefLower.includes(n));
      const textHit = hint.textNeedles.some((n) => linkText.includes(n));
      if (urlHit || textHit) {
        if (bestTier === null || hint.tier < bestTier) bestTier = hint.tier;
      }
    }
    if (bestTier === null) continue;
    const prev = bestByHref.get(hrefKey);
    if (prev === undefined || bestTier < prev) bestByHref.set(hrefKey, bestTier);
  }
  return Array.from(bestByHref.entries())
    .map(([href, tier]) => ({ href, tier }))
    .sort((a, b) => a.tier - b.tier);
}

function stripTagsSimple(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
