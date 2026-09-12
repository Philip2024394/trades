#!/usr/bin/env node
// scripts/nex-lab-crawler-seed.mjs
//
// Seeds nex_crawler.target with a curated list of Indonesian public
// directories + sitemaps that permit crawling per their ToS.
//
// Each entry documents licence + city + category so we can prioritise.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

function readPgUrl() {
  try {
    const env = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    const m = env.match(/^NEX_TAXONOMY_POSTGRES_URL\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* fall through */ }
  return "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

// Curated global + Indonesia seeds. All sources permit crawl per their
// ToS OR expose public APIs. Founder 2026-09-10 · authorised global scope.
// Format: [kind, url, city, category_hint, priority, licence_terms]
const SEEDS = [
  // ═══ INDONESIA · GOVERNMENT OPEN DATA ═══
  ["directory_page", "https://data.sumbarprov.go.id/", null, "gov-data", 3, "open-data-cc-by"],
  ["directory_page", "https://data.pu.go.id/", null, "gov-data", 3, "open-data-cc-by"],
  ["directory_page", "https://satudata.kemenparekraf.go.id/", null, "gov-tourism", 3, "open-data-permissive"],
  ["seed_root",      "https://opendata.jabarprov.go.id/", null, "gov-data-jabar", 4, "open-data"],
  ["seed_root",      "https://data.jakarta.go.id/", "jakarta", "gov-data-jakarta", 4, "open-data"],
  ["seed_root",      "https://opendata.jatimprov.go.id/", null, "gov-data-jatim", 4, "open-data"],

  // ═══ INDONESIA · TOURISM & HOSPITALITY DIRECTORIES ═══
  ["seed_root", "https://visitjogja.jogjaprov.go.id/", "yogyakarta", "tourism-directory", 4, "public-info"],
  ["seed_root", "https://phri.or.id/", null, "hotel-association", 4, "public-info"],
  ["seed_root", "https://halalmui.org/", null, "halal-certified", 4, "public-info"],

  // ═══ INDONESIA · NEWS (RSS · check robots.txt) ═══
  ["rss_atom", "https://rss.detik.com/index.php/detikcom", null, "news-indonesia", 5, "public-rss"],
  ["rss_atom", "https://www.antaranews.com/rss/terkini", null, "news-antara", 5, "public-rss"],
  ["rss_atom", "https://www.kumparan.com/feed", null, "news-kumparan", 5, "public-rss"],
  ["rss_atom", "https://rss.tempo.co/nasional", null, "news-tempo", 5, "public-rss"],

  // ═══ INDONESIA · FORUMS & COMMUNITIES ═══
  ["seed_root", "https://www.kaskus.co.id/", null, "forum-indonesia", 6, "public-content"],
  ["seed_root", "https://femaledaily.com/", null, "beauty-forum", 6, "public-content"],

  // ═══ GLOBAL · WIKIDATA + OPENSTREETMAP (already-licensed) ═══
  ["directory_page", "https://www.openstreetmap.org/relation/1615616", "jakarta", "osm-jakarta", 7, "odbl"],
  ["directory_page", "https://www.openstreetmap.org/relation/2938320", "yogyakarta", "osm-yogyakarta", 7, "odbl"],

  // ═══ GLOBAL · REDDIT PUBLIC JSON (rate-limited but public) ═══
  ["api_endpoint", "https://www.reddit.com/r/indonesia/.json?limit=25", null, "reddit-indonesia", 5, "reddit-tos"],
  ["api_endpoint", "https://www.reddit.com/r/bali/.json?limit=25", "bali", "reddit-bali", 6, "reddit-tos"],
  ["api_endpoint", "https://www.reddit.com/r/travel/.json?limit=25", null, "reddit-travel", 6, "reddit-tos"],
  ["api_endpoint", "https://www.reddit.com/r/solotravel/.json?limit=25", null, "reddit-solo-travel", 7, "reddit-tos"],

  // ═══ GLOBAL · HACKERNEWS (Firebase JSON, no auth, generous limits) ═══
  ["api_endpoint", "https://hacker-news.firebaseio.com/v0/topstories.json", null, "hn-topstories", 6, "hn-terms"],

  // ═══ GLOBAL · TECH / TRAVEL BLOG NETWORKS (RSS auto-discovered) ═══
  ["seed_root", "https://www.travelblog.org/", null, "travel-blog", 6, "public-content"],
  ["seed_root", "https://www.smartertravel.com/", null, "travel-content", 7, "public-content"],
  ["seed_root", "https://www.lonelyplanet.com/indonesia", null, "travel-guide-id", 6, "public-content"],
  ["seed_root", "https://www.wired.com/", null, "tech-news", 8, "public-content"],
  ["seed_root", "https://techcrunch.com/", null, "tech-news", 8, "public-content"],

  // ═══ GLOBAL · WORDPRESS-POWERED SITES (auto-discover /wp-json) ═══
  // Many independent blogs use WP · auto-discovery finds /wp-json/wp/v2/posts

  // ═══ GLOBAL · OPEN ACADEMIC / RESEARCH ═══
  ["api_endpoint", "https://api.openalex.org/works?filter=title.search:indonesia&per-page=25", null, "openalex-research", 7, "cc0"],

  // ═══ ARCHIVE.ORG · WAYBACK INDEX (for stale-source recovery) ═══
  ["seed_root", "https://web.archive.org/", null, "web-archive", 9, "public-archive"],
];

async function main() {
  const { Client } = await import("pg");
  const c = new Client({ connectionString: readPgUrl(), connectionTimeoutMillis: 8000 });
  await c.connect();
  let inserted = 0, updated = 0;
  try {
    for (const [kind, url, city, cat, priority, licence] of SEEDS) {
      const host = new URL(url).host;
      const r = await c.query(
        `INSERT INTO nex_crawler.target (kind, host, url, city, category_hint, priority, licence_terms, discovered_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'seed')
         ON CONFLICT (url) DO UPDATE SET
           priority = LEAST(nex_crawler.target.priority, EXCLUDED.priority),
           licence_terms = COALESCE(EXCLUDED.licence_terms, nex_crawler.target.licence_terms)
         RETURNING (xmax = 0) AS is_insert`,
        [kind, host, url, city, cat, priority, licence]
      );
      if (r.rows[0].is_insert) inserted++; else updated++;
    }
    console.log(`seed · inserted=${inserted} updated=${updated} · total seeds=${SEEDS.length}`);
    const total = await c.query(`SELECT count(*) FROM nex_crawler.target`);
    console.log(`nex_crawler.target now has ${total.rows[0].count} rows`);
  } finally { await c.end(); }
}
main().catch((err) => { console.error("fatal:", String(err).slice(0, 300)); process.exit(1); });
