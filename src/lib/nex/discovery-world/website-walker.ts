// src/lib/nex/discovery-world/website-walker.ts
//
// NEX World Email Intelligence · Part 4 · Entity-scoped website walker
// Founder-authorised programme · session-2 · 2026-09-21.
//
// **BOUNDED WALKER** · never fans out beyond the entity's own domain.
// Never calls fetch() directly · always uses an injected PageFetcher.
// Governance (robots · politeness · allowlist · evidence) lives in the
// fetcher, not here.
//
// Walk priority (per Founder specification):
//   /                    (homepage)
//   /about, /about-us
//   /services, /solutions, /products, /equipment
//   /contact, /contact-us, /get-in-touch
//   /locations, /branches
//   Links discovered ON the pages we already fetched
//   Sitemap.xml (best-effort · uses conditional-fetch when the fetcher supports it)
//
// Bounded by:
//   * per-entity max pages
//   * per-entity deadline
//   * per-domain circuit breaker (fetcher-side)
//   * same-origin restriction (never leaves the entity's canonical domain)

import type { PageFetcher } from "./page-fetcher";

export interface WalkerConfig {
  readonly max_pages_per_entity: number;                // hard cap
  readonly deadline_ms: number;                          // per-entity budget
  readonly per_page_deadline_ms: number;                 // per-fetch budget
  readonly follow_internal_links: boolean;               // discover /contact from homepage links
  readonly max_link_depth: number;                        // 0 = seeds only · 1 = follow one hop · 2 = two hops
  readonly now?: () => number;
}

export const DEFAULT_WALKER: WalkerConfig = {
  max_pages_per_entity: 32,   // bumped from 20 (Wave I) to accommodate multi-lang seeds + link-following
  deadline_ms: 60_000,
  per_page_deadline_ms: 10_000,
  follow_internal_links: true,
  max_link_depth: 1,
};

// Founder-authored priority list · never dynamically grown by the walker
// (a new path pattern is a Founder decision like a new seed keyword)
// Multi-language expansion Founder-authorised 2026-09-22 Wave I · DE/FR/IT/ES/NL
// added because worldwide harvest cannot assume English-only URL paths
// (Duens Gerüstbau AG · CH · has /kontakt but no /contact → walker missed
// info@duens.ch on Wave G re-walk).
// Sized to remain compatible with DEFAULT_WALKER.max_pages_per_entity (bumped
// to 32 to accommodate multi-lang + preserve room for link-following).
export const SEED_PATHS = [
  "/",
  // English (highest priority · anglophone majority of the current registry)
  "/about", "/services", "/contact", "/contact-us",
  // German (DE · AT · CH · LU) · Duens · Gerüstbau et al
  "/kontakt", "/impressum",
  // French (FR · BE · CH · LU)
  "/contactez-nous", "/mentions-legales",
  // Italian (IT · CH)
  "/contatti",
  // Spanish (ES · LatAm)
  "/contacto",
  // Dutch (NL · BE)
  "/contact-ons",
  // Common legal/imprint pages · email often lives here across every locale
  "/legal", "/privacy",
];

export interface WalkedPage {
  readonly url: string;
  readonly url_final: string;
  readonly html: string;
  readonly bytes: number;
  readonly ms: number;
  readonly status_code: number | null;
  readonly method: "seed_path" | "internal_link" | "sitemap";
  readonly depth: number;
}

export interface WalkOutcome {
  readonly entity_domain: string;
  readonly pages: ReadonlyArray<WalkedPage>;
  readonly pages_attempted: number;
  readonly pages_fetched: number;
  readonly pages_blocked_by_governance: number;
  readonly pages_robots_denied: number;
  readonly pages_not_found: number;
  readonly pages_unavailable: number;
  readonly deadline_expired: boolean;
  readonly total_bytes: number;
  readonly total_ms: number;
  readonly note: string | null;
}

// ─── Same-origin guard ─────────────────────────────────────────────
function sameOrigin(a: string, b: string): boolean {
  try {
    const ua = new URL(a), ub = new URL(b);
    return ua.hostname.replace(/^www\./, "").toLowerCase() === ub.hostname.replace(/^www\./, "").toLowerCase();
  } catch { return false; }
}

function abs(baseUrl: string, href: string): string | null {
  try { return new URL(href, baseUrl).toString(); } catch { return null; }
}

// ─── Extract internal links from HTML (bounded · dedup) ────────────
function extractInternalLinks(html: string, baseUrl: string, entityDomain: string, cap: number = 100): ReadonlyArray<string> {
  const rx = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(html)) !== null && out.length < cap) {
    const href = m[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    const absolute = abs(baseUrl, href);
    if (!absolute) continue;
    if (!sameOrigin(absolute, `https://${entityDomain}/`)) continue;
    // Drop URL fragments · normalise trailing slash
    const canonical = absolute.split("#")[0].replace(/\/$/, "");
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

// ─── Public entry ──────────────────────────────────────────────────
export interface WalkInput {
  readonly canonical_website: string;              // e.g. "abcscaffolding.co.uk"
  readonly fetcher: PageFetcher;
  readonly config?: Partial<WalkerConfig>;
}

export async function walkEntityWebsite(input: WalkInput): Promise<WalkOutcome> {
  const cfg: WalkerConfig = { ...DEFAULT_WALKER, ...(input.config ?? {}) };
  const now_fn = cfg.now ?? Date.now;
  const t0 = now_fn();
  const deadline = t0 + cfg.deadline_ms;
  const domain = String(input.canonical_website).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*/, "");
  const baseHttps = `https://${domain}`;

  const pages: WalkedPage[] = [];
  const seenUrls = new Set<string>();
  let pages_attempted = 0, pages_fetched = 0;
  let pages_blocked_by_governance = 0, pages_robots_denied = 0;
  let pages_not_found = 0, pages_unavailable = 0;
  let total_bytes = 0;
  let deadline_expired = false;
  let note: string | null = null;

  // Queue: [ { url, method, depth } ]
  const queue: Array<{ url: string; method: WalkedPage["method"]; depth: number }> = [];
  for (const path of SEED_PATHS) {
    const url = `${baseHttps}${path}`.replace(/\/\//g, "/").replace(":/", "://").replace(/\/$/, "");
    if (!seenUrls.has(url)) { queue.push({ url, method: "seed_path", depth: 0 }); seenUrls.add(url); }
  }

  while (queue.length > 0 && pages_fetched < cfg.max_pages_per_entity) {
    if (now_fn() >= deadline) { deadline_expired = true; break; }
    const { url, method, depth } = queue.shift()!;
    pages_attempted += 1;

    const res = await input.fetcher.fetchPage({
      url,
      deadline_ms: Math.min(cfg.per_page_deadline_ms, deadline - now_fn()),
    });

    switch (res.kind) {
      case "responded":
        if (res.html) {
          pages_fetched += 1;
          total_bytes += res.bytes;
          pages.push({
            url, url_final: res.url_final, html: res.html, bytes: res.bytes,
            ms: res.ms, status_code: res.status_code, method, depth,
          });
          if (cfg.follow_internal_links && depth < cfg.max_link_depth) {
            const links = extractInternalLinks(res.html, res.url_final, domain);
            for (const link of links) {
              if (pages_fetched + queue.length >= cfg.max_pages_per_entity) break;
              if (seenUrls.has(link)) continue;
              seenUrls.add(link);
              queue.push({ url: link, method: "internal_link", depth: depth + 1 });
            }
          }
        }
        break;
      case "blocked_by_governance": pages_blocked_by_governance += 1; break;
      case "robots_denied":         pages_robots_denied         += 1; break;
      case "not_found":             pages_not_found             += 1; break;
      case "rate_limited":          pages_unavailable            += 1; break;
      case "unavailable":           pages_unavailable            += 1; break;
      case "parse_error":           pages_unavailable            += 1; break;
      case "responded_zero":        /* count as fetched-empty */         break;
      case "not_modified":          /* freshness · not a new fetch */   break;
    }
  }

  if (pages_fetched === 0) {
    if (pages_blocked_by_governance === pages_attempted && pages_attempted > 0) note = "all pages blocked_by_governance · configure a production PageFetcher";
    else if (pages_robots_denied > 0) note = "walker respected robots.txt · some paths disallowed";
    else if (pages_unavailable === pages_attempted && pages_attempted > 0) note = "every source unavailable";
    else note = "no pages fetched";
  }

  return {
    entity_domain: domain, pages, pages_attempted, pages_fetched,
    pages_blocked_by_governance, pages_robots_denied, pages_not_found, pages_unavailable,
    deadline_expired, total_bytes, total_ms: now_fn() - t0, note,
  };
}

export const _WALKER_NEVER_LEAVES_ENTITY_DOMAIN = "same_origin_enforced";
export const _WALKER_NEVER_CALLS_FETCH_DIRECTLY = "always_via_injected_page_fetcher";
