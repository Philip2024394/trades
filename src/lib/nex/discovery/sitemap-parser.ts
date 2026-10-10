// src/lib/nex/discovery/sitemap-parser.ts
//
// UWI · Wave 3.3 · M8 · Sitemap XML parsing (uses htmlparser2 xmlMode)
// Founder-authorised programme.
//
// Parses sitemap.xml (urlset) and sitemap index (sitemapindex) using
// htmlparser2's xmlMode. Deterministic, no external XML library beyond
// the already-approved htmlparser2 (Wave 3.1/3.2 REUSE).
//
// Supports:
//   - <urlset> · list of <url><loc/><lastmod/><changefreq/><priority/></url>
//   - <sitemapindex> · list of <sitemap><loc/><lastmod/></sitemap>
//
// Does NOT recurse — caller drives recursion via the returned
// `child_sitemaps` array.

import { Parser } from "htmlparser2";
import type { CanonicalUrl, SitemapEntry, SitemapParseOutcome } from "./types";
import { tryCanonicalise } from "./url-canonicalisation";

export function parseSitemap(xml: string): SitemapParseOutcome {
  let is_index = false;
  const urls: SitemapEntry[] = [];
  const child_sitemaps: CanonicalUrl[] = [];
  const errors: string[] = [];

  // Current-element state
  let inUrlset = false;
  let inSitemapIndex = false;
  let inUrl = false;
  let inSitemap = false;
  let currentTag: string | null = null;

  // Current entry being built
  let loc: string | null = null;
  let lastmod: string | null = null;
  let changefreq: string | null = null;
  let priority: number | null = null;

  const flushUrl = () => {
    if (loc) {
      const canonical = tryCanonicalise(loc);
      if (!canonical) {
        errors.push(`unparseable <loc> in <url>: ${loc}`);
      } else {
        urls.push({
          loc: canonical,
          lastmod_iso: lastmod ? safeToIso(lastmod) : null,
          changefreq,
          priority,
        });
      }
    }
    loc = null; lastmod = null; changefreq = null; priority = null;
  };

  const flushSitemap = () => {
    if (loc) {
      const canonical = tryCanonicalise(loc);
      if (!canonical) {
        errors.push(`unparseable <loc> in <sitemap>: ${loc}`);
      } else {
        child_sitemaps.push(canonical);
      }
    }
    loc = null; lastmod = null; changefreq = null; priority = null;
  };

  const parser = new Parser({
    onopentag(name) {
      const tag = name.toLowerCase();
      currentTag = tag;
      if (tag === "urlset") inUrlset = true;
      else if (tag === "sitemapindex") { inSitemapIndex = true; is_index = true; }
      else if (tag === "url" && inUrlset) inUrl = true;
      else if (tag === "sitemap" && inSitemapIndex) inSitemap = true;
    },
    ontext(text) {
      if (!currentTag) return;
      const t = text.trim();
      if (!t) return;
      if (currentTag === "loc") loc = (loc ?? "") + t;
      else if (currentTag === "lastmod") lastmod = (lastmod ?? "") + t;
      else if (currentTag === "changefreq") changefreq = (changefreq ?? "") + t;
      else if (currentTag === "priority") {
        const n = Number.parseFloat(t);
        priority = Number.isFinite(n) ? n : null;
      }
    },
    onclosetag(name) {
      const tag = name.toLowerCase();
      if (tag === "url" && inUrl) { flushUrl(); inUrl = false; }
      else if (tag === "sitemap" && inSitemap) { flushSitemap(); inSitemap = false; }
      else if (tag === "urlset") inUrlset = false;
      else if (tag === "sitemapindex") inSitemapIndex = false;
      currentTag = null;
    },
    onerror(e) {
      errors.push(`xml parse error: ${e.message}`);
    },
  }, { xmlMode: true, decodeEntities: true, lowerCaseTags: true });

  try {
    parser.write(xml);
    parser.end();
  } catch (e: any) {
    errors.push(`parser threw: ${e?.message ?? String(e)}`);
  }

  return {
    is_index,
    child_sitemaps,
    urls,
    parse_errors: errors,
  };
}

function safeToIso(s: string): string | null {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
