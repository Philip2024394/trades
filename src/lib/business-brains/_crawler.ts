// Business Brain crawler — respects robots.txt, follows internal
// links only, rate-limited, content-hash change detection.
//
// Zero external dependencies beyond node:crypto and the built-in fetch.
// Runs on the server (Node runtime). Output shape is normalised so the
// extractors and sync engine can consume it without knowing about HTML.

import "server-only";
import { createHash } from "node:crypto";

// ─── Configuration ─────────────────────────────────────────────────
//
// User-Agent: browser-like Chrome string with a self-identifying suffix
// so honest sites can whitelist us and administrators can see who's
// hitting them in access logs. Pure bot UAs get 403'd by common WAF
// rules on many hosts.
const DEFAULT_USER_AGENT   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 NexBusinessBrain/1.0 (+https://thenetworkers.app/business-brains)";
const DEFAULT_REQUEST_MS   = 400;      // ~2.5 req/sec — polite crawler
const DEFAULT_TIMEOUT_MS   = 15000;
const DEFAULT_MAX_PAGES    = 1000;
const DEFAULT_MAX_DEPTH    = 8;
const DEFAULT_ACCEPT_TYPES = new Set(["text/html", "application/xhtml+xml"]);

export type CrawlOptions = {
  seedUrl:       string;
  userAgent?:    string;
  requestDelayMs?: number;
  timeoutMs?:    number;
  maxPages?:     number;
  maxDepth?:     number;
  onProgress?:   (progress: CrawlProgress) => void;
};

export type CrawlProgress = {
  visited: number;
  queued:  number;
  errors:  number;
  current: string;
};

export type CrawledPage = {
  url:          string;
  status:       number;
  contentType:  string | null;
  title:        string | null;
  description:  string | null;
  raw_html:     string;
  clean_text:   string;
  word_count:   number;
  content_hash: string;
  outlinks:     string[];
  media:        Array<{ url: string; type: "image" | "video"; alt: string | null; width: number | null; height: number | null }>;
  pdf_links:    string[];
  fetched_at:   string;
};

export type CrawlResult = {
  seedUrl:    string;
  domain:     string;
  pages:      CrawledPage[];
  errors:     Array<{ url: string; error: string }>;
  duration_ms: number;
  robots_disallowed: string[];
};

// ─── robots.txt ────────────────────────────────────────────────────
type RobotsRules = {
  disallow: string[];
  allow:    string[];
  crawlDelayMs: number | null;
};

async function fetchRobots(origin: string, userAgent: string, timeoutMs: number): Promise<RobotsRules> {
  const robotsUrl = new URL("/robots.txt", origin).toString();
  const rules: RobotsRules = { disallow: [], allow: [], crawlDelayMs: null };

  try {
    const res = await fetchWithTimeout(robotsUrl, { headers: { "User-Agent": userAgent } }, timeoutMs);
    if (!res.ok) return rules;
    const text = await res.text();

    // Naive robots.txt parser — handles User-agent, Allow, Disallow,
    // Crawl-delay for either our UA or the wildcard.
    let applies = false;
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*$/, "").trim();
      if (!line) continue;
      const [rawKey, ...restParts] = line.split(":");
      if (!rawKey || restParts.length === 0) continue;
      const key = rawKey.trim().toLowerCase();
      const value = restParts.join(":").trim();
      if (key === "user-agent") {
        applies = value === "*" || userAgent.toLowerCase().includes(value.toLowerCase());
      } else if (applies) {
        if (key === "disallow" && value !== "") rules.disallow.push(value);
        else if (key === "allow" && value !== "") rules.allow.push(value);
        else if (key === "crawl-delay") {
          const seconds = Number(value);
          if (Number.isFinite(seconds) && seconds > 0) rules.crawlDelayMs = Math.round(seconds * 1000);
        }
      }
    }
  } catch {
    // Missing / unreachable robots.txt = no restrictions
  }
  return rules;
}

function robotsAllows(pathname: string, rules: RobotsRules): boolean {
  // Longest match wins; Allow beats Disallow on ties (RFC-ish behaviour).
  let bestMatch = { length: -1, allow: true };
  for (const p of rules.disallow) {
    if (pathname.startsWith(p) && p.length > bestMatch.length) bestMatch = { length: p.length, allow: false };
  }
  for (const p of rules.allow) {
    if (pathname.startsWith(p) && p.length >= bestMatch.length) bestMatch = { length: p.length, allow: true };
  }
  return bestMatch.allow;
}

// ─── HTML → clean text + metadata ──────────────────────────────────
function extractMetadata(html: string): { title: string | null; description: string | null } {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const descMatch  = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html)
                    ?? /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i.exec(html);
  return {
    title:       titleMatch ? decodeEntities(titleMatch[1].trim()) : null,
    description: descMatch  ? decodeEntities(descMatch[1].trim())  : null
  };
}

function extractCleanText(html: string): string {
  // Strip scripts, styles, noscript, comments
  let s = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  // Convert breaks + paragraphs to newlines so paragraph structure survives
  s = s.replace(/<\/(p|div|h[1-6]|li|section|article|header|footer|nav)\s*>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  // Strip all remaining tags
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  // Collapse whitespace
  s = s.replace(/[ \t]+/g, " ").replace(/\n[ \t]*/g, "\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function decodeEntities(s: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => named[name.toLowerCase()] ?? m);
}

function extractOutlinks(html: string, baseUrl: URL): string[] {
  const links: string[] = [];
  const linkRegex = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    try {
      const abs = new URL(m[1], baseUrl).toString();
      links.push(abs.split("#")[0]);
    } catch { /* skip malformed */ }
  }
  return Array.from(new Set(links));
}

function extractMedia(html: string, baseUrl: URL): CrawledPage["media"] {
  const media: CrawledPage["media"] = [];
  const imgRegex = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRegex.exec(html)) !== null) {
    const tag = m[0];
    const srcMatch = /\bsrc=["']([^"']+)["']/i.exec(tag);
    if (!srcMatch) continue;
    try {
      const abs = new URL(srcMatch[1], baseUrl).toString();
      const altMatch = /\balt=["']([^"']*)["']/i.exec(tag);
      const wMatch   = /\bwidth=["']?(\d+)["']?/i.exec(tag);
      const hMatch   = /\bheight=["']?(\d+)["']?/i.exec(tag);
      media.push({
        url:    abs,
        type:   "image",
        alt:    altMatch ? decodeEntities(altMatch[1]) : null,
        width:  wMatch ? Number(wMatch[1]) : null,
        height: hMatch ? Number(hMatch[1]) : null
      });
    } catch { /* skip malformed */ }
  }
  return media;
}

function extractPdfLinks(links: string[]): string[] {
  return links.filter((l) => /\.pdf(\?|$)/i.test(l));
}

// ─── Fetch helper ──────────────────────────────────────────────────
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

// ─── URL filtering ─────────────────────────────────────────────────
function normaliseUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    // Strip fragments
    u.hash = "";
    // Ignore known non-content assets by extension
    const path = u.pathname.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|mp4|mov|zip|dmg|exe)(\?|$)/.test(path)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// ─── Main crawler entry point ──────────────────────────────────────
export async function crawlSite(opts: CrawlOptions): Promise<CrawlResult> {
  const started = Date.now();
  const seed = new URL(opts.seedUrl);
  const domain = seed.hostname.replace(/^www\./, "");
  const userAgent   = opts.userAgent   ?? DEFAULT_USER_AGENT;
  const timeoutMs   = opts.timeoutMs   ?? DEFAULT_TIMEOUT_MS;
  const maxPages    = opts.maxPages    ?? DEFAULT_MAX_PAGES;
  const maxDepth    = opts.maxDepth    ?? DEFAULT_MAX_DEPTH;

  // Determine crawl delay: max of user default and robots.txt crawl-delay
  const robots = await fetchRobots(`${seed.protocol}//${seed.host}`, userAgent, timeoutMs);
  const requestDelayMs = Math.max(
    opts.requestDelayMs ?? DEFAULT_REQUEST_MS,
    robots.crawlDelayMs ?? 0
  );

  const visited = new Map<string, CrawledPage>();
  const errors: CrawlResult["errors"] = [];
  const robotsDisallowed: string[] = [];
  const queue: Array<{ url: string; depth: number }> = [];
  const enqueued = new Set<string>();

  const seedNormalised = normaliseUrl(seed.toString());
  if (!seedNormalised) throw new Error(`Seed URL is not valid: ${opts.seedUrl}`);
  queue.push({ url: seedNormalised, depth: 0 });
  enqueued.add(seedNormalised);

  while (queue.length > 0 && visited.size < maxPages) {
    const { url, depth } = queue.shift()!;
    if (visited.has(url)) continue;

    // Politeness delay between requests
    if (visited.size > 0) await new Promise((r) => setTimeout(r, requestDelayMs));

    // robots.txt check
    const parsed = new URL(url);
    if (!robotsAllows(parsed.pathname, robots)) {
      robotsDisallowed.push(url);
      continue;
    }

    opts.onProgress?.({
      visited: visited.size,
      queued:  queue.length,
      errors:  errors.length,
      current: url
    });

    let res: Response;
    try {
      res = await fetchWithTimeout(url, {
        headers: {
          "User-Agent":      userAgent,
          "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-GB,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control":   "no-cache"
        }
      }, timeoutMs);
    } catch (e) {
      errors.push({ url, error: e instanceof Error ? e.message : "fetch_error" });
      continue;
    }

    if (!res.ok) {
      errors.push({ url, error: `http_${res.status}` });
      continue;
    }

    const contentType = res.headers.get("content-type");
    const baseType = contentType?.split(";")[0].trim().toLowerCase() ?? "";
    if (!DEFAULT_ACCEPT_TYPES.has(baseType)) continue;

    const html = await res.text();
    const { title, description } = extractMetadata(html);
    const cleanText = extractCleanText(html);
    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
    const contentHash = createHash("sha256").update(cleanText).digest("hex");

    const outlinks = extractOutlinks(html, parsed);
    const media    = extractMedia(html, parsed);
    const pdfLinks = extractPdfLinks(outlinks);

    const page: CrawledPage = {
      url,
      status:      res.status,
      contentType: baseType,
      title,
      description,
      raw_html:    html,
      clean_text:  cleanText,
      word_count:  wordCount,
      content_hash: contentHash,
      outlinks,
      media,
      pdf_links:   pdfLinks,
      fetched_at:  new Date().toISOString()
    };
    visited.set(url, page);

    // Enqueue internal outlinks that we haven't seen yet
    if (depth < maxDepth) {
      for (const outUrl of outlinks) {
        if (enqueued.size + visited.size >= maxPages + queue.length) break;
        const norm = normaliseUrl(outUrl);
        if (!norm) continue;
        const outParsed = new URL(norm);
        if (outParsed.hostname.replace(/^www\./, "") !== domain) continue;   // same-domain only
        if (visited.has(norm) || enqueued.has(norm)) continue;
        queue.push({ url: norm, depth: depth + 1 });
        enqueued.add(norm);
      }
    }
  }

  return {
    seedUrl: opts.seedUrl,
    domain,
    pages: Array.from(visited.values()),
    errors,
    duration_ms: Date.now() - started,
    robots_disallowed: robotsDisallowed
  };
}
