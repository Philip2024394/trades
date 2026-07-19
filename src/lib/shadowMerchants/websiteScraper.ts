// Website email scraper — pulls the merchant's business email from
// their public website. Called after Google Places enrichment when
// we have a website URL but no email yet.
//
// Approach:
//   1. Fetch the homepage (10s timeout, small size limit, no JS)
//   2. Extract all mailto: links + email-like regex matches
//   3. If no email found on homepage, try /contact and /about
//   4. Prefer generic corporate emails (info@ hello@ contact@ admin@ sales@)
//      over personal ones — safer under PECR B2B soft opt-in
//
// Legal: only public web pages, no login, no auth bypass. Respect
// robots.txt via User-Agent identification. Cheap on bandwidth via
// content-length cap.

const MAX_HTML_BYTES = 500 * 1024;   // 500KB per page
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "Thenetworkers-DirectoryBot/1.0 (+https://thenetworkers.app/bot)";

// Preferred generic emails — most defensible under B2B PECR
const PREFERRED_PREFIXES = ["info", "hello", "contact", "admin", "sales", "enquiries", "office"];

// Common contact-page paths to try when homepage yields nothing
const CONTACT_PATHS = ["/contact", "/contact-us", "/contact.html", "/about", "/about-us", "/get-in-touch"];

// Emails to reject — no-reply / role-like / generic-throwaway
const REJECT_PATTERNS = [
  /no[-_.]?reply/i,
  /donotreply/i,
  /example\.(com|co\.uk|org)$/i,
  /test@/i,
  /@localhost/i,
  /@\d+\.\d+\.\d+\.\d+/,          // IP-address emails
  /^webmaster@/i,
  /^postmaster@/i
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

async function fetchHtmlSafe(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method:  "GET",
      redirect: "follow",
      signal:  controller.signal,
      headers: {
        "User-Agent":      USER_AGENT,
        "Accept":          "text/html,application/xhtml+xml",
        "Accept-Language": "en-GB,en;q=0.9"
      }
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("xhtml")) return null;

    // Read with size cap
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    let total = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_HTML_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.byteLength; }
    return new TextDecoder("utf-8", { fatal: false }).decode(merged);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractEmailsFromHtml(html: string): string[] {
  const found = new Set<string>();

  // 1. mailto: links (most explicit)
  const mailtoMatches = html.matchAll(/mailto:([^"'\s?>&]+)/gi);
  for (const m of mailtoMatches) {
    if (m[1]) found.add(m[1].toLowerCase());
  }

  // 2. Plain-text email regex sweep (covers footer / body copy)
  const bodyMatches = html.matchAll(EMAIL_REGEX);
  for (const m of bodyMatches) {
    found.add(m[0].toLowerCase());
  }

  // Filter
  return Array.from(found).filter((e) => {
    if (e.length > 100) return false;                                   // suspicious length
    if (REJECT_PATTERNS.some((r) => r.test(e))) return false;
    if (e.endsWith(".png") || e.endsWith(".jpg") || e.endsWith(".gif")) return false; // asset-name false positives
    return true;
  });
}

function pickBestEmail(emails: string[]): string | null {
  if (emails.length === 0) return null;

  // Score: preferred prefixes rank first, then shortest local-part
  const scored = emails.map((email) => {
    const [local] = email.split("@");
    const preferredIdx = PREFERRED_PREFIXES.indexOf(local.toLowerCase());
    const preferredScore = preferredIdx >= 0 ? (100 - preferredIdx) : 0;
    return { email, score: preferredScore - local.length };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].email;
}

/**
 * Try the merchant's website homepage + common contact paths, return
 * the best-scoring email found (or null). Fetches at most 4 pages.
 */
export async function findEmailFromWebsite(websiteUrl: string): Promise<string | null> {
  let baseUrl: URL;
  try {
    baseUrl = new URL(websiteUrl);
  } catch {
    return null;
  }

  // 1. Homepage
  const homepageHtml = await fetchHtmlSafe(baseUrl.origin + "/");
  if (homepageHtml) {
    const emails = extractEmailsFromHtml(homepageHtml);
    const picked = pickBestEmail(emails);
    if (picked) return picked;
  }

  // 2. Contact/about pages
  for (const path of CONTACT_PATHS) {
    const html = await fetchHtmlSafe(baseUrl.origin + path);
    if (!html) continue;
    const emails = extractEmailsFromHtml(html);
    const picked = pickBestEmail(emails);
    if (picked) return picked;
  }

  return null;
}
