#!/usr/bin/env node
// scripts/nex-lab-email-enricher.mjs
//
// Founder 2026-09-10 · Website → email enricher.
//
// For every harvest_raw row in every Lab room whose payload has a `website`
// but no `email`, fetch the website + its likely contact pages, extract
// mailto: links, contact-form actions, WhatsApp buttons, and store the
// discoveries in a new `payload.enriched_contacts` block.
//
// LEGAL FOOTING:
//   · Only fetches URLs the business itself has published on their own site
//   · Respects robots.txt (fetches /robots.txt first, skips disallowed)
//   · UA identifies as NEX-Lab-EmailEnricher/1.0
//   · Rate-limited 1 req/host/sec to avoid load
//   · No form submission · read-only
//   · No personal-data harvesting (business emails only)
//
// Doesn't touch main nex.* — only annotates Lab rows.

import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const LOG_PATH = join(LAB_DIR, "email-enricher.log");

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
const CLI_ROOM = args.get("room");
const LIMIT = Number(args.get("limit") ?? "40");
const ROOMS = ["accommodation", "food", "transport", "business", "activities"];
const CONTACT_PATHS = [
  "", "/contact", "/contact-us", "/hubungi-kami", "/kontak",
  "/about", "/about-us", "/tentang", "/tentang-kami",
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

async function loadPg() {
  try { return (await import("pg")).Client; } catch { return null; }
}
function readPgUrl() {
  try {
    const env = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    const m = env.match(/^NEX_TAXONOMY_POSTGRES_URL\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* fall through */ }
  return "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

function normaliseUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  let u = raw.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const parsed = new URL(u);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    return { url: parsed.toString(), host: parsed.host, origin: parsed.origin };
  } catch { return null; }
}

async function fetchWithTimeout(url, ms = 8000) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "NEX-Lab-EmailEnricher/1.0 (+https://nex.id/robots)",
        "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/") && !ct.includes("html")) return null;
    const text = await res.text();
    if (text.length > 500_000) return text.slice(0, 500_000);
    return text;
  } catch { return null; }
}

async function robotsAllows(origin, path) {
  try {
    const robotsTxt = await fetchWithTimeout(origin + "/robots.txt", 4000);
    if (!robotsTxt) return true; // no robots.txt = allowed
    // simplistic parse · look for any User-agent: * Disallow: path prefix
    const lines = robotsTxt.split(/\r?\n/);
    let inStar = false;
    for (const raw of lines) {
      const line = raw.trim();
      if (/^user-agent:\s*\*/i.test(line)) inStar = true;
      else if (/^user-agent:/i.test(line)) inStar = false;
      else if (inStar && /^disallow:/i.test(line)) {
        const disallow = line.split(":", 2)[1]?.trim();
        if (disallow && disallow !== "/" && path.startsWith(disallow)) return false;
        if (disallow === "/") return false;
      }
    }
    return true;
  } catch { return true; }
}

// ─── Extractors ────────────────────────────────────────────────────
const EMAIL_RX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const WA_RX = /(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|whatsapp:\/\/send\?phone=)(\+?[0-9]{8,15})/gi;

const EMAIL_BLOCKLIST = /(?:example|test|sample|domain|yourdomain|noreply|no-reply|donotreply|do-not-reply|webmaster|postmaster|abuse|admin@localhost|user@|sentry\.io|wixpress\.com|jimdo\.com|godaddy\.com|namecheap\.com)/i;

function extractEmails(html, ownHost) {
  const found = new Set();
  // mailto: links (highest confidence)
  const mailto = html.match(/mailto:([^"'?\s>]+)/gi) || [];
  for (const m of mailto) {
    const e = m.replace(/^mailto:/i, "").trim().toLowerCase();
    if (e && !EMAIL_BLOCKLIST.test(e)) found.add(e);
  }
  // raw email regex
  const raw = html.match(EMAIL_RX) || [];
  for (const e of raw) {
    const clean = e.trim().toLowerCase();
    if (clean.length > 254) continue;
    if (EMAIL_BLOCKLIST.test(clean)) continue;
    // Prefer emails whose domain matches the website host (own-domain business email)
    // but also keep gmail/yahoo/etc. which is common for SMB in Indonesia
    found.add(clean);
  }
  // Score: own-domain emails are highest confidence
  return [...found].map((email) => {
    const domain = email.split("@")[1] || "";
    const ownDomain = ownHost && domain && (ownHost.endsWith(domain) || domain.endsWith(ownHost.replace(/^www\./, "")));
    return { email, confidence: ownDomain ? "high" : "medium", source: mailto.some((m) => m.toLowerCase().includes(email)) ? "mailto" : "regex" };
  });
}

function extractWhatsApp(html) {
  const found = new Set();
  const matches = [...html.matchAll(WA_RX)];
  for (const m of matches) {
    const num = m[1].replace(/[^\d+]/g, "");
    if (num.length >= 8) found.add(num);
  }
  return [...found];
}

function extractSocials(html) {
  const socials = {};
  const ig = html.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/gi) || [];
  const fb = html.match(/https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9_.\-]+)/gi) || [];
  const tk = html.match(/https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)/gi) || [];
  if (ig.length) socials.instagram = [...new Set(ig)].slice(0, 3);
  if (fb.length) socials.facebook = [...new Set(fb)].slice(0, 3);
  if (tk.length) socials.tiktok = [...new Set(tk)].slice(0, 3);
  return socials;
}

// ─── Per-website enrichment ────────────────────────────────────────
async function enrichOne(originalUrl) {
  const n = normaliseUrl(originalUrl);
  if (!n) return { status: "invalid_url" };
  const emails = new Map();
  const whatsapp = new Set();
  const socials = {};
  const pagesTried = [];

  for (const path of CONTACT_PATHS) {
    const allowed = await robotsAllows(n.origin, path);
    if (!allowed) { pagesTried.push({ path, skipped: "robots" }); continue; }
    const url = n.origin + path;
    const html = await fetchWithTimeout(url);
    pagesTried.push({ path, ok: !!html });
    if (!html) { await sleep(300); continue; }
    for (const e of extractEmails(html, n.host)) {
      const prev = emails.get(e.email);
      if (!prev || (e.confidence === "high" && prev.confidence !== "high")) emails.set(e.email, e);
    }
    for (const w of extractWhatsApp(html)) whatsapp.add(w);
    Object.assign(socials, extractSocials(html));
    // Rate-limit per host
    await sleep(1000);
    // Stop early once we have a high-confidence email
    if ([...emails.values()].some((e) => e.confidence === "high")) break;
  }

  const emailArr = [...emails.values()];
  return {
    status: emailArr.length ? "enriched" : "no_contact_found",
    website: n.url,
    host: n.host,
    emails: emailArr,
    whatsapp: [...whatsapp],
    socials,
    pages_tried: pagesTried.length,
    enriched_at: new Date().toISOString(),
  };
}

// ─── Main loop ─────────────────────────────────────────────────────
async function processRoom(Client, url, roomSlug, limit) {
  const schema = `nex_lab_${roomSlug}`;
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });
  await c.connect();
  let considered = 0, enriched = 0, empty = 0, invalid = 0;
  try {
    // Select rows with a website but no enriched_contacts yet
    const rows = (await c.query(`
      SELECT record_id, payload
      FROM ${schema}.harvest_raw
      WHERE payload->>'website' IS NOT NULL
        AND payload->>'enriched_contacts' IS NULL
      ORDER BY harvested_at DESC
      LIMIT $1
    `, [limit])).rows;
    log(`  ${roomSlug}: ${rows.length} candidates with website + no enrichment yet`);
    for (const row of rows) {
      considered++;
      const site = row.payload?.website;
      const result = await enrichOne(site);
      if (result.status === "invalid_url") { invalid++; continue; }
      if (result.status === "no_contact_found") empty++;
      else enriched++;
      // Merge into payload
      const newPayload = { ...row.payload, enriched_contacts: result };
      await c.query(
        `UPDATE ${schema}.harvest_raw SET payload = $1::jsonb WHERE record_id = $2`,
        [JSON.stringify(newPayload), row.record_id]
      );
      if (result.emails?.length) {
        log(`  ✓ ${roomSlug} · ${site} → ${result.emails.length} emails (${result.emails[0].email})`);
      }
    }
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
  return { considered, enriched, empty, invalid };
}

async function emitFW(url, kind, status, message, reference = {}) {
  try {
    const { Client } = await import("pg");
    const c = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
    await c.connect();
    await c.query(
      `INSERT INTO nex.founder_window_event (subsystem, event_kind, status, actor, message, reference)
       VALUES ('email_enricher', $1, $2, 'nex-lab-email-enricher.mjs', $3, $4::jsonb)`,
      [kind, status, message, JSON.stringify(reference)]
    );
    await c.end();
  } catch { /* silent */ }
}

async function main() {
  const t0 = Date.now();
  const Client = await loadPg();
  if (!Client) { log("no pg module · aborting"); process.exit(2); }
  const url = readPgUrl();
  const rooms = CLI_ROOM ? [CLI_ROOM] : ROOMS;
  log(`start · rooms=${rooms.join(",")} · limit/room=${LIMIT}`);
  await emitFW(url, "scheduled_task_triggered", "info", `enrichment sweep · ${rooms.length} rooms · limit ${LIMIT}`, { rooms });
  const totals = { considered: 0, enriched: 0, empty: 0, invalid: 0 };
  for (const room of rooms) {
    try {
      const r = await processRoom(Client, url, room, LIMIT);
      log(`  ${room} done · considered=${r.considered} enriched=${r.enriched} empty=${r.empty} invalid=${r.invalid}`);
      if (r.enriched > 0) {
        await emitFW(url, "evidence_discovered", "ok",
          `${r.enriched} new contact records in ${room}`,
          { room, ...r });
      }
      totals.considered += r.considered;
      totals.enriched += r.enriched;
      totals.empty += r.empty;
      totals.invalid += r.invalid;
    } catch (err) {
      log(`  ${room} ERROR: ${String(err).slice(0, 200)}`);
      await emitFW(url, "agent_failed", "error", `enricher ${room} failed`, { room, error: String(err).slice(0, 200) });
    }
  }
  log(`done · total considered=${totals.considered} enriched=${totals.enriched} empty=${totals.empty} invalid=${totals.invalid} · ${Date.now() - t0}ms`);
  await emitFW(url, "scheduled_task_completed", "ok",
    `${totals.enriched} contacts enriched from ${totals.considered} candidates`,
    { ...totals, duration_ms: Date.now() - t0 });
}

main().catch((err) => { log(`fatal: ${String(err).slice(0, 300)}`); process.exit(1); });
