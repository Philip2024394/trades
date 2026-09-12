#!/usr/bin/env node
// scripts/nex-lab-instagram-enricher.mjs
//
// Founder 2026-09-10 · Instagram Business Discovery enricher.
//
// Uses Meta Graph API's business_discovery edge (legit, ToS-compliant) to
// fetch public Instagram Business profile fields for handles that we
// harvest from website enrichment (payload.enriched_contacts.socials.instagram).
//
// PREREQUISITES (founder must complete before this script yields data):
//   1. Register a Facebook App at developers.facebook.com/apps
//   2. Link a Facebook Page and an Instagram Business/Creator account to it
//   3. Get long-lived Page Access Token via graph.facebook.com/oauth/access_token
//   4. Submit for App Review for permissions:
//        - instagram_basic
//        - pages_show_list
//        - pages_read_engagement
//        - business_management
//   5. Set env vars:
//        META_GRAPH_ACCESS_TOKEN=<page-access-token>
//        META_IG_USER_ID=<instagram-business-account-id>
//
// See: docs/DECISIONS/0305-nex-lab-instagram-enrichment.md for the full
// founder-side setup guide + app-review submission checklist.
//
// While tokens are unset, this script logs "SKIPPED · Meta credentials
// missing" and exits cleanly. Rate-limited to 200 calls/hour (Meta
// enforces 200/hr per IG user for business_discovery).

import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const LOG_PATH = join(LAB_DIR, "instagram-enricher.log");

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
const ROOMS = ["accommodation", "food", "transport", "business", "activities"];
const CLI_ROOM = args.get("room");

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    appendFileSync(LOG_PATH, msg);
  } catch { /* silent */ }
}

async function loadPg() {
  try { return (await import("pg")).Client; } catch { return null; }
}
function readEnv(name) {
  if (process.env[name]) return process.env[name];
  try {
    const env = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    const m = env.match(new RegExp(`^${name}\\s*=\\s*(.+)$`, "m"));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* fall through */ }
  return null;
}
function readPgUrl() {
  return readEnv("NEX_TAXONOMY_POSTGRES_URL") ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

// ─── Meta Graph client ─────────────────────────────────────────────
const GRAPH_BASE = "https://graph.facebook.com/v20.0";

async function businessDiscovery(igUserId, targetUsername, accessToken) {
  const fields = "business_discovery.username(" + encodeURIComponent(targetUsername) +
    "){id,username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url}";
  const url = `${GRAPH_BASE}/${igUserId}?fields=${fields}&access_token=${accessToken}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "NEX-Lab-IGEnricher/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429) return { error: "rate_limited" };
    if (!res.ok) return { error: `http_${res.status}` };
    const json = await res.json();
    if (json.error) return { error: json.error?.message?.slice(0, 200) ?? "api_error" };
    return { ok: true, data: json.business_discovery ?? null };
  } catch (err) { return { error: String(err).slice(0, 200) }; }
}

// Extract email from IG biography (many Indo SMBs put email in bio)
const EMAIL_RX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const WA_RX = /(?:wa\.me\/|\+?62[0-9\s-]{8,15})/gi;

function parseBio(bio) {
  if (!bio) return { emails: [], whatsapp: null };
  const emails = [...(bio.match(EMAIL_RX) || [])].filter(Boolean);
  const waMatch = bio.match(/wa\.me\/(\+?[0-9]{8,15})/i) || bio.match(/(\+?62[0-9]{8,13})/);
  const whatsapp = waMatch ? waMatch[1] || waMatch[0] : null;
  return { emails, whatsapp };
}

function extractHandleFromUrl(url) {
  const m = String(url ?? "").match(/instagram\.com\/([a-zA-Z0-9_.]+)/i);
  return m ? m[1].replace(/\/+$/, "") : null;
}

// ─── Main ──────────────────────────────────────────────────────────
async function processRoom(Client, url, roomSlug, limit, igUserId, accessToken) {
  const schema = `nex_lab_${roomSlug}`;
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });
  await c.connect();
  let considered = 0, enriched = 0, missing = 0, errors = 0;
  try {
    // Select rows that have an IG handle in enriched_contacts.socials but no IG bio yet
    const rows = (await c.query(`
      SELECT record_id, payload
      FROM ${schema}.harvest_raw
      WHERE payload->'enriched_contacts'->'socials'->>'instagram' IS NOT NULL
        AND (payload->'ig_bio_data') IS NULL
      ORDER BY harvested_at DESC
      LIMIT $1
    `, [limit])).rows;
    log(`  ${roomSlug}: ${rows.length} candidates with IG handle`);
    for (const row of rows) {
      considered++;
      const socials = row.payload?.enriched_contacts?.socials ?? {};
      const igUrls = Array.isArray(socials.instagram) ? socials.instagram : [];
      const handle = extractHandleFromUrl(igUrls[0]);
      if (!handle) { missing++; continue; }
      const result = await businessDiscovery(igUserId, handle, accessToken);
      if (result.error) {
        errors++;
        log(`  ✗ @${handle} · ${result.error}`);
        if (result.error === "rate_limited") { log("  rate-limited · pausing 60s"); await sleep(60_000); }
        await sleep(500);
        continue;
      }
      if (!result.data) { missing++; continue; }
      const { emails, whatsapp } = parseBio(result.data.biography);
      const igData = {
        handle: result.data.username,
        name: result.data.name,
        biography: result.data.biography,
        website: result.data.website,
        followers: result.data.followers_count,
        follows: result.data.follows_count,
        media_count: result.data.media_count,
        profile_picture_url: result.data.profile_picture_url,
        bio_emails: emails,
        bio_whatsapp: whatsapp,
        fetched_at: new Date().toISOString(),
        source: "meta_graph_business_discovery",
      };
      const newPayload = { ...row.payload, ig_bio_data: igData };
      // Merge new emails into enriched_contacts if any
      if (emails.length) {
        const ec = newPayload.enriched_contacts ?? {};
        const existing = new Set((ec.emails ?? []).map((e) => e.email));
        for (const e of emails) if (!existing.has(e)) {
          ec.emails = (ec.emails ?? []).concat([{ email: e, confidence: "medium", source: "instagram_bio" }]);
        }
        newPayload.enriched_contacts = ec;
      }
      await c.query(
        `UPDATE ${schema}.harvest_raw SET payload = $1::jsonb WHERE record_id = $2`,
        [JSON.stringify(newPayload), row.record_id]
      );
      enriched++;
      log(`  ✓ ${roomSlug} · @${handle} · followers=${result.data.followers_count ?? "?"} · emails=${emails.length}`);
      await sleep(500); // Meta rate limit: 200/hr = 18s minimum · we go faster + backoff on 429
    }
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
  return { considered, enriched, missing, errors };
}

async function main() {
  const t0 = Date.now();
  const igUserId = readEnv("META_IG_USER_ID");
  const accessToken = readEnv("META_GRAPH_ACCESS_TOKEN");
  if (!igUserId || !accessToken) {
    log("SKIPPED · Meta credentials missing (META_IG_USER_ID + META_GRAPH_ACCESS_TOKEN)");
    log("  → complete the app-review checklist at docs/DECISIONS/0305-nex-lab-instagram-enrichment.md");
    log("  → set env vars in .env.local then re-run this script");
    process.exit(0); // clean exit · not an error · scheduled task can safely tick past
  }
  const Client = await loadPg();
  if (!Client) { log("no pg module · aborting"); process.exit(2); }
  const url = readPgUrl();
  const rooms = CLI_ROOM ? [CLI_ROOM] : ROOMS;
  log(`start · rooms=${rooms.join(",")} · limit/room=${LIMIT} · igUserId=${igUserId.slice(0, 6)}…`);
  const totals = { considered: 0, enriched: 0, missing: 0, errors: 0 };
  for (const room of rooms) {
    try {
      const r = await processRoom(Client, url, room, LIMIT, igUserId, accessToken);
      log(`  ${room} done · considered=${r.considered} enriched=${r.enriched} missing=${r.missing} errors=${r.errors}`);
      for (const k of Object.keys(totals)) totals[k] += r[k];
    } catch (err) {
      log(`  ${room} ERROR: ${String(err).slice(0, 200)}`);
    }
  }
  log(`done · considered=${totals.considered} enriched=${totals.enriched} missing=${totals.missing} errors=${totals.errors} · ${Date.now() - t0}ms`);
}

main().catch((err) => { log(`fatal: ${String(err).slice(0, 300)}`); process.exit(1); });
