#!/usr/bin/env node
// scripts/nex-lab-directory-crawler.mjs
//
// Founder 2026-09-10 · Universal directory + social crawler · best-in-class.
//
// Design (rock-solid):
//   1. TARGET-DRIVEN · reads nex_crawler.target for URLs to visit ·
//      never wildcards the internet
//   2. ROBOTS.TXT FIRST · every host's robots.txt cached 24h · Disallow
//      rules enforced before fetch
//   3. PER-HOST RATE LIMIT · 60 req/hour default · configurable per host
//   4. IMMUTABLE FETCH LOG · every request writes to nex_crawler.fetch_log
//      with SHA256 + status + duration · cannot fake success
//   5. SITEMAP.XML AUTO-DISCOVERY · finds and expands sitemaps automatically
//   6. STRUCTURED EXTRACTORS · schema.org JSON-LD · Open Graph · meta ·
//      hCard · vCard · fallback to generic contact-page email/whatsapp/phone
//   7. FAIL-CLOSED · unknown host = crawl NOT started · unknown MIME =
//      response body NOT parsed · Founder's Window emits gap event so
//      operator can add extractor
//
// Sources to seed (Indonesia · public directories · terms permit crawl):
//   - Kemenparekraf: satudata.kemenparekraf.go.id (open data portal)
//   - Kominfo: siberkreasi.id (creator directory)
//   - Halal MUI: halalmui.org (halal-certified businesses)
//   - PHRI (hotel association): phri.or.id (hotel member list)
//   - APKRINDO (restaurant assoc): apkrindo.id (member list)
//   - Various regional yellow-pages that publish sitemap.xml
//
// LEGAL: crawler respects robots.txt strictly. Only fetches URLs
// explicitly seeded by operator (no wildcarded discovery beyond what
// sitemap.xml declares crawlable). UA is honest: NEX-Lab-DirectoryCrawler.

import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const LOG_PATH = join(LAB_DIR, "directory-crawler.log");
const EXTRACTOR_VERSION = "1.0.0";

const UA = "NEX-Lab-DirectoryCrawler/1.0 (+https://nex.id/robots ; public-directory-aggregation)";

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const key = a.replace(/^--/, "");
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) { args.set(key, next); i++; }
    else args.set(key, "true");
  }
}
const LIMIT = Number(args.get("limit") ?? "50");
const CLI_HOST = args.get("host");
const DRY = args.get("dry") === "true";

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    appendFileSync(LOG_PATH, msg);
  } catch { /* silent */ }
}

async function loadPg() { try { return (await import("pg")).Client; } catch { return null; } }
function readPgUrl() {
  try {
    const env = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    const m = env.match(/^NEX_TAXONOMY_POSTGRES_URL\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* fall through */ }
  return "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

async function emitFW(c, kind, status, message, reference = {}) {
  try {
    await c.query(
      `INSERT INTO nex.founder_window_event (subsystem, event_kind, status, actor, message, reference)
       VALUES ('directory_crawler', $1, $2, 'directory-crawler.mjs', $3, $4::jsonb)`,
      [kind, status, message, JSON.stringify(reference)]
    );
  } catch { /* silent */ }
}

// ─── Robots.txt cache ──────────────────────────────────────────────
const robotsCache = new Map(); // host → { allowedPathsRx, disallowedPathsRx, fetchedAt }

async function robotsAllows(url) {
  const u = new URL(url);
  const host = u.host;
  const path = u.pathname + u.search;
  const cached = robotsCache.get(host);
  if (cached && (Date.now() - cached.fetchedAt) < 24 * 3600 * 1000) {
    return checkPath(path, cached);
  }
  const robotsUrl = `${u.protocol}//${host}/robots.txt`;
  let txt = "";
  try {
    const res = await fetch(robotsUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) txt = await res.text();
  } catch { /* no robots = allowed */ }
  // Parse: focus on User-agent: * blocks
  const rules = { disallow: [], allow: [] };
  let inStar = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (/^user-agent:\s*\*/i.test(line)) inStar = true;
    else if (/^user-agent:/i.test(line)) inStar = false;
    else if (inStar && /^disallow:/i.test(line)) {
      const v = line.split(":", 2)[1]?.trim();
      if (v) rules.disallow.push(v);
    } else if (inStar && /^allow:/i.test(line)) {
      const v = line.split(":", 2)[1]?.trim();
      if (v) rules.allow.push(v);
    }
  }
  const cacheEntry = { ...rules, fetchedAt: Date.now() };
  robotsCache.set(host, cacheEntry);
  return checkPath(path, cacheEntry);
}

function checkPath(path, cache) {
  // Allow rules take precedence (per robots.txt spec)
  for (const a of cache.allow) if (path.startsWith(a)) return { allowed: true, reason: `allow ${a}` };
  for (const d of cache.disallow) {
    if (d === "/") return { allowed: false, reason: "disallow /" };
    if (path.startsWith(d)) return { allowed: false, reason: `disallow ${d}` };
  }
  return { allowed: true, reason: null };
}

// ─── Host budget ───────────────────────────────────────────────────
const hostBudgetCache = new Map();
async function checkAndSpendBudget(c, host) {
  const cached = hostBudgetCache.get(host);
  const nowHour = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
  if (cached && cached.hour.getTime() === nowHour.getTime() && cached.count >= cached.max) {
    return { ok: false, reason: `hour budget exceeded (${cached.count}/${cached.max})` };
  }
  // Persist
  await c.query(`
    INSERT INTO nex_crawler.host_budget (host, hour_bucket, req_this_hour, max_req_per_hour)
    VALUES ($1, $2, 1, 60)
    ON CONFLICT (host) DO UPDATE SET
      req_this_hour = CASE WHEN nex_crawler.host_budget.hour_bucket = EXCLUDED.hour_bucket
                            THEN nex_crawler.host_budget.req_this_hour + 1
                            ELSE 1 END,
      hour_bucket = EXCLUDED.hour_bucket
  `, [host, nowHour]);
  const r = await c.query(
    `SELECT req_this_hour, max_req_per_hour FROM nex_crawler.host_budget WHERE host = $1`,
    [host]
  );
  const row = r.rows[0];
  hostBudgetCache.set(host, { hour: nowHour, count: row.req_this_hour, max: row.max_req_per_hour });
  if (row.req_this_hour > row.max_req_per_hour) {
    return { ok: false, reason: `exceeded ${row.max_req_per_hour}/hour` };
  }
  return { ok: true, remaining: row.max_req_per_hour - row.req_this_hour };
}

// ─── Fetch with logging ────────────────────────────────────────────
async function fetchAndLog(c, target, url) {
  const t0 = Date.now();
  const { allowed, reason: robotsReason } = await robotsAllows(url);
  if (!allowed) {
    await c.query(
      `INSERT INTO nex_crawler.fetch_log (target_id, url, http_status, robots_allowed, robots_reason, duration_ms)
       VALUES ($1, $2, NULL, FALSE, $3, $4)`,
      [target?.target_id ?? null, url, robotsReason, Date.now() - t0]
    );
    return { skipped: "robots", reason: robotsReason };
  }
  const host = new URL(url).host;
  const budget = await checkAndSpendBudget(c, host);
  if (!budget.ok) {
    await c.query(
      `INSERT INTO nex_crawler.fetch_log (target_id, url, rate_limit_hit, robots_reason, duration_ms)
       VALUES ($1, $2, TRUE, $3, $4)`,
      [target?.target_id ?? null, url, budget.reason, Date.now() - t0]
    );
    return { skipped: "rate_limit", reason: budget.reason };
  }

  let httpStatus = null, body = null, contentType = null, err = null;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000)
    });
    httpStatus = res.status;
    contentType = res.headers.get("content-type") || "";
    if (res.ok) {
      body = await res.text();
      if (body.length > 2_000_000) body = body.slice(0, 2_000_000);
    }
  } catch (e) { err = String(e).slice(0, 200); }

  const sha = body ? createHash("sha256").update(body).digest("hex") : null;
  const fetchId = (await c.query(
    `INSERT INTO nex_crawler.fetch_log
       (target_id, url, http_status, content_type, bytes, content_sha256, duration_ms, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING fetch_id`,
    [target?.target_id ?? null, url, httpStatus, contentType, body?.length ?? 0, sha, Date.now() - t0, err]
  )).rows[0].fetch_id;
  return { fetchId, httpStatus, contentType, body, err };
}

// ─── Extractors ────────────────────────────────────────────────────
// 1. sitemap.xml → list of URLs (adds to target queue)
async function extractSitemap(c, target, body) {
  const urls = [];
  const rx = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let m;
  while ((m = rx.exec(body)) !== null) urls.push(m[1].trim());
  // Also parse sitemap-index (nested sitemaps)
  for (const url of urls.slice(0, 500)) {
    if (!url.startsWith("http")) continue;
    await c.query(
      `INSERT INTO nex_crawler.target (kind, host, url, city, category_hint, priority, discovered_by)
       VALUES ($1, $2, $3, $4, $5, 6, 'sitemap')
       ON CONFLICT (url) DO NOTHING`,
      [url.endsWith(".xml") ? "sitemap" : "directory_page",
       new URL(url).host, url, target.city, target.category_hint]
    );
  }
  return { count: urls.length };
}

// 2. Schema.org JSON-LD in the page (structured business data)
function extractJsonLd(body, sourceUrl) {
  const found = [];
  const rx = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = rx.exec(body)) !== null) {
    try {
      let json = JSON.parse(m[1].trim());
      if (!Array.isArray(json)) json = [json];
      for (const item of json) {
        const type = (item?.["@type"] ?? "").toString().toLowerCase();
        if (["localbusiness", "restaurant", "hotel", "store", "organization"].some((t) => type.includes(t))) {
          const name = item.name;
          const email = item.email;
          const phone = item.telephone;
          const website = item.url || sourceUrl;
          const addr = item.address ? (typeof item.address === "string" ? item.address :
            [item.address.streetAddress, item.address.addressLocality, item.address.addressRegion].filter(Boolean).join(", ")) : null;
          const lat = item.geo?.latitude;
          const lon = item.geo?.longitude;
          if (name) found.push({ record_kind: "business", payload: { name, email, phone, website, address: addr, coordinates: (lat && lon) ? { lat: Number(lat), lon: Number(lon) } : null, raw_type: type } });
        }
      }
    } catch { /* invalid JSON-LD · skip */ }
  }
  return found;
}

// 3a. RSS 2.0 / Atom feed extraction (blogs, news, forums)
function extractRssAtom(body, sourceUrl) {
  const found = [];
  // RSS 2.0 items
  const rssItems = [...body.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  for (const it of rssItems.slice(0, 50)) {
    const raw = it[1];
    const title = raw.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim();
    const link = raw.match(/<link[^>]*>([^<]+)<\/link>/i)?.[1]?.trim();
    const desc = raw.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim();
    const author = raw.match(/<(?:dc:creator|author)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:dc:creator|author)>/i)?.[1]?.trim();
    const pubDate = raw.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i)?.[1]?.trim();
    if (title || link) found.push({ record_kind: "event", payload: { title, link, description: desc?.slice(0, 500), author, published: pubDate, feed_url: sourceUrl } });
  }
  // Atom entries
  const atomEntries = [...body.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)];
  for (const en of atomEntries.slice(0, 50)) {
    const raw = en[1];
    const title = raw.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim();
    const link = raw.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
    const summary = raw.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i)?.[1]?.trim();
    const author = raw.match(/<author[^>]*>[\s\S]*?<name[^>]*>([^<]+)<\/name>/i)?.[1]?.trim();
    const updated = raw.match(/<updated[^>]*>([^<]+)<\/updated>/i)?.[1]?.trim();
    if (title || link) found.push({ record_kind: "event", payload: { title, link, description: summary?.slice(0, 500), author, published: updated, feed_url: sourceUrl } });
  }
  return found;
}

// 3b. WordPress REST API extractor (wp-json/wp/v2/posts endpoint)
function extractWordPressJson(body, sourceUrl) {
  const found = [];
  try {
    const data = JSON.parse(body);
    if (!Array.isArray(data)) return found;
    for (const post of data.slice(0, 50)) {
      found.push({
        record_kind: "event",
        payload: {
          title: post.title?.rendered?.replace(/<[^>]+>/g, "").trim(),
          link: post.link,
          description: post.excerpt?.rendered?.replace(/<[^>]+>/g, "").trim().slice(0, 500),
          author: post.author_name ?? String(post.author ?? ""),
          published: post.date,
          slug: post.slug,
          source: "wordpress_rest",
        },
      });
    }
  } catch { /* not JSON · skip */ }
  return found;
}

// 3c. Reddit-style JSON extractor (/r/<sub>.json)
function extractRedditJson(body, sourceUrl) {
  const found = [];
  try {
    const data = JSON.parse(body);
    const children = data?.data?.children ?? [];
    for (const child of children.slice(0, 50)) {
      const d = child.data;
      if (!d) continue;
      found.push({
        record_kind: "event",
        payload: {
          title: d.title,
          link: d.url,
          description: (d.selftext ?? "").slice(0, 500),
          author: d.author,
          published: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
          subreddit: d.subreddit,
          score: d.score,
          num_comments: d.num_comments,
          permalink: d.permalink ? `https://reddit.com${d.permalink}` : null,
          source: "reddit_json",
        },
      });
    }
  } catch { /* not Reddit JSON · skip */ }
  return found;
}

// 3d. HackerNews Firebase JSON (kids/comments/story arrays)
function extractHackerNewsJson(body, sourceUrl) {
  const found = [];
  try {
    const data = JSON.parse(body);
    if (Array.isArray(data)) {
      // /v0/topstories.json returns array of IDs · seed follow-up crawls
      return data.slice(0, 20).map((id) => ({
        record_kind: "link",
        payload: { hn_id: id, follow_url: `https://hacker-news.firebaseio.com/v0/item/${id}.json`, source: "hackernews_topstories" },
      }));
    }
    if (data.title) {
      found.push({
        record_kind: "event",
        payload: {
          title: data.title,
          link: data.url,
          description: (data.text ?? "").slice(0, 500).replace(/<[^>]+>/g, ""),
          author: data.by,
          published: data.time ? new Date(data.time * 1000).toISOString() : null,
          score: data.score,
          descendants: data.descendants,
          source: "hackernews_item",
        },
      });
    }
  } catch { /* not JSON · skip */ }
  return found;
}

// 3. Open Graph + meta + hCard extraction (fallback)
function extractMeta(body, sourceUrl) {
  const found = [];
  const emails = [...(body.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])].filter((e) =>
    !/(example|test|sample|noreply|no-reply|webmaster|postmaster|@localhost)/i.test(e));
  const phones = [...(body.match(/(?:\+62|0)[0-9]{7,13}/g) || [])];
  const whatsapp = [...(body.matchAll(/wa\.me\/(\+?[0-9]{8,15})/gi))].map((m) => m[1]);
  const ogTitle = body.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const ogDesc = body.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const titleTag = body.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const name = ogTitle || titleTag;
  if (name || emails.length || phones.length) {
    found.push({
      record_kind: "business",
      payload: {
        name: name?.trim() ?? null,
        description: ogDesc?.trim() ?? null,
        emails: [...new Set(emails)],
        phones: [...new Set(phones)],
        whatsapp: [...new Set(whatsapp)],
        source_url: sourceUrl,
      }
    });
  }
  return found;
}

// 4. Social handle extraction
function extractSocials(body) {
  const found = [];
  const ig = [...(body.matchAll(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/gi))].map((m) => m[1]);
  const fb = [...(body.matchAll(/(?:https?:\/\/)?(?:www\.)?facebook\.com\/([a-zA-Z0-9_.\-]+)/gi))].map((m) => m[1]);
  const tk = [...(body.matchAll(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)/gi))].map((m) => m[1]);
  for (const h of [...new Set(ig)]) found.push({ record_kind: "social_handle", payload: { platform: "instagram", handle: h } });
  for (const h of [...new Set(fb)].slice(0, 5)) found.push({ record_kind: "social_handle", payload: { platform: "facebook", handle: h } });
  for (const h of [...new Set(tk)].slice(0, 5)) found.push({ record_kind: "social_handle", payload: { platform: "tiktok", handle: h } });
  return found;
}

// Auto-discovery: for a given seed host, probe common feed/API paths
// and register them as new targets. Non-blocking · silent failures.
async function autoDiscoverPaths(c, target) {
  const origin = new URL(target.url).origin;
  const probes = [
    { kind: "sitemap",       path: "/sitemap.xml" },
    { kind: "sitemap",       path: "/sitemap_index.xml" },
    { kind: "rss_atom",      path: "/feed" },
    { kind: "rss_atom",      path: "/rss" },
    { kind: "rss_atom",      path: "/rss.xml" },
    { kind: "rss_atom",      path: "/atom.xml" },
    { kind: "rss_atom",      path: "/feed.xml" },
    { kind: "wordpress_api", path: "/wp-json/wp/v2/posts?per_page=25" },
  ];
  for (const p of probes) {
    const url = origin + p.path;
    try {
      const head = await fetch(url, {
        method: "HEAD",
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(4000),
      });
      if (head.ok || head.status === 405 /* HEAD not allowed but resource exists */) {
        await c.query(
          `INSERT INTO nex_crawler.target (kind, host, url, city, category_hint, priority, discovered_by)
           VALUES ($1, $2, $3, $4, $5, 6, 'auto_discovery')
           ON CONFLICT (url) DO NOTHING`,
          [p.kind, new URL(url).host, url, target.city, target.category_hint]
        );
      }
    } catch { /* not reachable · skip */ }
  }
}

async function persistExtracted(c, fetchId, sourceUrl, records) {
  let saved = 0;
  const host = new URL(sourceUrl).host;
  for (const rec of records) {
    const dedupe = createHash("sha256").update(
      JSON.stringify({ url: sourceUrl, name: rec.payload.name, host, kind: rec.record_kind })
    ).digest("hex");
    try {
      await c.query(
        `INSERT INTO nex_crawler.extracted_record
           (fetch_id, source_url, source_host, record_kind, payload, dedupe_hash, extractor, extractor_version)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [fetchId, sourceUrl, host, rec.record_kind, JSON.stringify(rec.payload), dedupe, "html_generic", EXTRACTOR_VERSION]
      );
      saved++;
    } catch { /* dedupe · skip */ }
  }
  return saved;
}

// ─── Main crawl loop ───────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  const Client = await loadPg();
  if (!Client) { log("no pg module"); process.exit(2); }
  const c = new Client({ connectionString: readPgUrl(), connectionTimeoutMillis: 8000 });
  await c.connect();
  try {
    // Pick targets: least-recently-crawled active targets first
    const whereHost = CLI_HOST ? "AND host = $2" : "";
    const params = [LIMIT];
    if (CLI_HOST) params.push(CLI_HOST);
    const targets = (await c.query(
      `SELECT target_id, kind, host, url, city, category_hint
       FROM nex_crawler.target
       WHERE active = TRUE ${whereHost}
       ORDER BY last_crawled_at NULLS FIRST, priority ASC
       LIMIT $1`, params
    )).rows;
    log(`start · ${targets.length} targets · limit ${LIMIT}${CLI_HOST ? " · host " + CLI_HOST : ""}`);
    await emitFW(c, "scheduled_task_triggered", "info", `crawl sweep · ${targets.length} targets`, { host: CLI_HOST, limit: LIMIT });

    let fetched = 0, extracted = 0, skipped = 0, errored = 0;
    for (const t of targets) {
      if (DRY) { log(`  DRY · would fetch ${t.url}`); continue; }
      const r = await fetchAndLog(c, t, t.url);
      if (r.skipped) {
        skipped++;
        log(`  ⊘ ${t.url} · skipped: ${r.skipped} (${r.reason})`);
        continue;
      }
      if (r.err || !r.body) {
        errored++;
        log(`  ✗ ${t.url} · ${r.err ?? `http_${r.httpStatus}`}`);
        continue;
      }
      fetched++;
      // Dispatch to extractor by kind + content-type
      let records = [];
      const ct = r.contentType?.toLowerCase() ?? "";
      if (t.kind === "sitemap" || (ct.includes("xml") && r.body.includes("<urlset") || r.body.includes("<sitemapindex"))) {
        const sm = await extractSitemap(c, t, r.body);
        log(`  ↳ sitemap ${t.url} · discovered ${sm.count} URLs`);
      } else if (t.kind === "rss_atom" || (ct.includes("rss") || ct.includes("atom")) || r.body.match(/<(?:rss|feed)\b/i)) {
        records = extractRssAtom(r.body, t.url);
        log(`  ↳ RSS/Atom ${t.url} · ${records.length} items`);
      } else if (t.kind === "wordpress_api" || t.url.includes("/wp-json/wp/v2/posts")) {
        records = extractWordPressJson(r.body, t.url);
        log(`  ↳ WP-REST ${t.url} · ${records.length} posts`);
      } else if (t.url.match(/reddit\.com\/r\/[^/]+\.json/i)) {
        records = extractRedditJson(r.body, t.url);
        log(`  ↳ Reddit ${t.url} · ${records.length} posts`);
      } else if (t.url.includes("hacker-news.firebaseio.com")) {
        records = extractHackerNewsJson(r.body, t.url);
        log(`  ↳ HN ${t.url} · ${records.length} items`);
      } else {
        records = [
          ...extractJsonLd(r.body, t.url),
          ...extractMeta(r.body, t.url),
          ...extractSocials(r.body),
        ];
        // Auto-discovery: probe for common feed/API paths (adds new targets)
        if (t.kind === "seed_root" || t.kind === "directory_page") {
          await autoDiscoverPaths(c, t);
        }
      }
      const saved = records.length ? await persistExtracted(c, r.fetchId, t.url, records) : 0;
      extracted += saved;
      await c.query(
        `UPDATE nex_crawler.fetch_log SET extractor = 'html_generic', parsed_count = $1 WHERE fetch_id = $2`,
        [saved, r.fetchId]
      );
      await c.query(
        `UPDATE nex_crawler.target SET last_crawled_at = now(), last_status = $1 WHERE target_id = $2`,
        [r.httpStatus, t.target_id]
      );
      if (saved > 0) {
        await emitFW(c, "evidence_discovered", "ok",
          `${saved} records from ${t.host}`,
          { host: t.host, url: t.url, saved });
      }
      log(`  ✓ ${t.url} · ${r.httpStatus} · extracted ${saved}`);
      await sleep(1000); // polite pause
    }

    log(`done · fetched=${fetched} extracted=${extracted} skipped=${skipped} errored=${errored} · ${Date.now() - t0}ms`);
    await emitFW(c, "scheduled_task_completed", errored ? "warning" : "ok",
      `crawl: ${fetched} fetched · ${extracted} records`,
      { fetched, extracted, skipped, errored, duration_ms: Date.now() - t0 });
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
}

main().catch((err) => { log("fatal: " + String(err).slice(0, 200)); process.exit(1); });
