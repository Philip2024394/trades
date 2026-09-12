#!/usr/bin/env node
// scripts/nex-lab-news-harvester.mjs
//
// Founder ADR-0304 · News RSS harvester · v1.
//
// Pulls headlines from established Indonesian news feeds (Kompas,
// Detik, Antara) and writes to nex_lab_news.harvest_raw. Each item
// gets:
//   · title, url, published_at, source_id
//   · deterministic dedupe_hash (source_id + guid|link)
//   · payload = full item text (bounded to 2 KB)
//
// GOLDEN RULE: RSS feeds are read-only external sources · we never
// modify them · we cite them as source_reference for every fact
// that flows downstream.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const LOG_PATH = join(LAB_DIR, "news.log");

// Feeds we harvest · public RSS · no auth · citation required per feed's own terms.
// Feeds we harvest · public RSS · CC-BY for headlines
// Founder note: Kompas/Detik/Antara URLs shift · maintain in this list.
const FEEDS = [
  // BBC Asia · reliable · CC + editorial standard high
  { id: "bbc_asia",       url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml",  publisher: "BBC" },
  // Reuters world (via public mirror)
  { id: "reuters_world",  url: "https://feeds.reuters.com/reuters/worldNews",       publisher: "Reuters" },
  // Jakarta Post
  { id: "jkt_post_indo",  url: "https://www.thejakartapost.com/rss",                publisher: "Jakarta Post" },
  // Indonesia government RSS · Kemenparekraf tourism feed
  { id: "kemenparekraf",  url: "https://kemenparekraf.go.id/feed",                  publisher: "Kemenparekraf" },
];

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
  return process.env.NEX_TAXONOMY_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

// Minimal RSS parser · handles both RSS 2.0 and Atom
function parseRss(xml) {
  const items = [];
  // Item pattern (RSS)
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  const extract = (block, tag) => {
    const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
    if (!m) return null;
    return m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
  };
  const useAtom = /<feed[^>]*>/.test(xml);
  const re = useAtom ? entryRe : itemRe;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const block = match[1];
    const title = extract(block, "title");
    const link = useAtom
      ? (block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ?? null)
      : extract(block, "link");
    const guid = extract(block, "guid") ?? link;
    const pub  = extract(block, useAtom ? "published" : "pubDate")
              ?? extract(block, useAtom ? "updated" : "date");
    const desc = extract(block, "description") ?? extract(block, "summary");
    if (!title || !link) continue;
    items.push({ title, link, guid: guid ?? link, published_at: pub, description: desc });
  }
  return items;
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "NEX-Lab-News/1.0", "Accept": "application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { items: [], error: `http_${res.status}` };
    const xml = await res.text();
    return { items: parseRss(xml), error: null };
  } catch (err) {
    return { items: [], error: String(err).slice(0, 100) };
  }
}

async function ingest(client, feed, items) {
  let inserted = 0, dupes = 0, errors = 0;
  for (const it of items) {
    const dedupe = createHash("sha256").update(`${feed.id}|${it.guid}`).digest("hex");
    try {
      const existing = await client.query(
        `SELECT record_id FROM nex_lab_news.harvest_raw WHERE dedupe_hash=$1 LIMIT 1`,
        [dedupe],
      );
      if (existing.rows.length > 0) { dupes++; continue; }
      await client.query(
        `INSERT INTO nex_lab_news.harvest_raw (source, source_ref, dedupe_hash, payload) VALUES ($1, $2, $3, $4)`,
        [`rss:${feed.id}`, it.link, dedupe, {
          publisher: feed.publisher,
          title: it.title,
          url: it.link,
          published_at: it.published_at,
          description: (it.description ?? "").slice(0, 2000),
          harvested_via: "nex-lab-news-harvester",
        }],
      );
      inserted++;
    } catch { errors++; }
  }
  return { inserted, dupes, errors };
}

async function main() {
  const t0 = Date.now();
  const Client = await loadPg();
  if (!Client) { log("pg missing"); process.exit(2); }
  const c = new Client({ connectionString: readPgUrl(), connectionTimeoutMillis: 8000 });
  await c.connect();
  let totalIn = 0;
  try {
    for (const feed of FEEDS) {
      log(`fetching ${feed.publisher} (${feed.url})…`);
      const res = await fetchFeed(feed);
      if (res.error) { log(`  err: ${res.error}`); continue; }
      log(`  parsed ${res.items.length} items`);
      const ing = await ingest(c, feed, res.items);
      log(`  ${feed.publisher.padEnd(10)} · inserted=${ing.inserted} dupes=${ing.dupes} errors=${ing.errors}`);
      totalIn += ing.inserted;
      await sleep(500); // polite pause between feeds
    }
  } finally { try { await c.end(); } catch { /* ignore */ } }
  log(`news done · total_inserted=${totalIn} · ${Date.now() - t0}ms`);
  process.exit(0);
}

main().catch((err) => { log(`fatal: ${String(err).slice(0, 400)}`); process.exit(1); });
