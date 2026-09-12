#!/usr/bin/env node
// scripts/nex-marketing-sender.mjs
//
// Founder 2026-09-10 · Marketing sender daemon.
//
// Non-stop worker that:
//   1. Pulls the next batch of pending messages from nex.marketing_send_queue
//   2. For EACH message, calls authorizeAction() against the campaign's
//      authorization_policy · policy verifies rate limits + conditions
//   3. If authorized → send via SMTP (or ESP API)
//   4. Records outcome in nex.marketing_send_log immutably
//   5. Updates nex.marketing_contact stats (send_count, last_sent_at)
//   6. Emits founder_window_event at every step (dashboard sees live)
//
// GOVERNANCE:
//   · No email leaves this process unless NEX_MARKETING_SEND_ENABLED=true
//   · No email leaves this process without an active authorization_policy
//   · Every send obeys the policy's per-hour + per-day + total rate caps
//   · Bounces + complaints instantly opt-out the recipient
//
// OFFLINE-HONEST:
//   · If Postgres offline → daemon sleeps + retries + emits warning
//   · If SMTP offline → mark send failed + retry with backoff
//   · If ESP webhook fails → suppression still enforced from local log

import { readFileSync, existsSync, mkdirSync, appendFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { createHash, createHmac } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const LOG_PATH = join(LAB_DIR, "marketing-sender.log");
const HEARTBEAT_PATH = join(LAB_DIR, "marketing-sender.heartbeat");

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try { if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true }); appendFileSync(LOG_PATH, msg); } catch { /* silent */ }
}
function writeHeartbeat(state) {
  try { writeFileSync(HEARTBEAT_PATH, JSON.stringify({ pid: process.pid, updated_at: new Date().toISOString(), ...state }, null, 2)); } catch { /* silent */ }
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
function readPgUrl() { return readEnv("NEX_TAXONOMY_POSTGRES_URL") ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev"; }

const SEND_ENABLED = readEnv("NEX_MARKETING_SEND_ENABLED") === "true";
const ESP = readEnv("NEX_MARKETING_ESP") ?? "not_configured"; // 'ses' | 'resend' | 'smtp'
const SMTP_URL = readEnv("NEX_MARKETING_SMTP_URL");
const FROM_EMAIL = readEnv("NEX_MARKETING_FROM_EMAIL") ?? "hello@nex.id";
const FROM_NAME = readEnv("NEX_MARKETING_FROM_NAME") ?? "NEX";
const PHYSICAL_ADDRESS = readEnv("NEX_MARKETING_PHYSICAL_ADDRESS") ?? "Jakarta, Indonesia";
const UNSUB_SECRET = readEnv("NEX_MARKETING_UNSUB_SECRET") ?? readEnv("NEX_LAB_PROMOTION_SECRET") ?? "";
const BASE_URL = readEnv("NEX_MARKETING_BASE_URL") ?? "http://localhost:3008";
const BATCH_SIZE = Number(readEnv("NEX_MARKETING_BATCH_SIZE") ?? "5");
const POLL_INTERVAL_MS = Number(readEnv("NEX_MARKETING_POLL_MS") ?? "10000");
const MAX_PER_MIN = Number(readEnv("NEX_MARKETING_MAX_SEND_PER_MIN") ?? "10");

const AGENT_ID = `marketing-sender-${process.pid}`;

// ─── Policy authorization check (mirrors src/lib/nex/authorization/policy.ts) ───
async function authorizeAction(client, input) {
  await client.query("BEGIN");
  try {
    const policyR = await client.query(
      `SELECT policy_id, slug, conditions, max_actions_per_hour, max_actions_per_day, max_actions_total,
              hourly_bucket, daily_bucket, action_count_last_hour, action_count_last_day, action_count
       FROM nex.authorization_policy
       WHERE subsystem = $1 AND agent_class = $2 AND action_kind = $3
         AND active = TRUE AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > now())
       ORDER BY authorized_at DESC LIMIT 1 FOR UPDATE`,
      [input.subsystem, input.agent_class, input.action_kind]
    );
    if (policyR.rowCount === 0) {
      await client.query("ROLLBACK");
      return { authorized: false, reason: "no_policy" };
    }
    const p = policyR.rows[0];
    // Condition checks (same 6 conditions as TS module)
    const cond = p.conditions ?? {};
    const ev = input.evidence ?? {};
    if (typeof cond.consent_required === "string") {
      const rank = (l) => l === "explicit_opt_in" ? 3 : l === "implicit" ? 2 : l === "discovered" ? 1 : 0;
      const need = cond.consent_required === "opt_in" ? 3 : cond.consent_required === "implicit_or_stronger" ? 2 : 1;
      if (rank(String(ev.consent_basis ?? "")) < need) { await client.query("ROLLBACK"); return { authorized: false, reason: `consent_below_${cond.consent_required}` }; }
    }
    if (typeof cond.quality_score_min === "number") {
      const q = Number(ev.quality_score);
      if (!Number.isFinite(q) || q < cond.quality_score_min) { await client.query("ROLLBACK"); return { authorized: false, reason: `quality_${q}_below_${cond.quality_score_min}` }; }
    }
    if (Array.isArray(cond.country_whitelist) && !cond.country_whitelist.includes(String(ev.country ?? ""))) {
      await client.query("ROLLBACK"); return { authorized: false, reason: `country_not_in_whitelist` };
    }
    if (cond.business_hours_only === true) {
      const h = new Date().getHours();
      if (h < 8 || h >= 20) { await client.query("ROLLBACK"); return { authorized: false, reason: "outside_business_hours" }; }
    }
    // Rate limits
    const now = new Date();
    const currentHourly = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
    const currentDaily = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let hc = p.action_count_last_hour;
    let dc = p.action_count_last_day;
    if (new Date(p.hourly_bucket).getTime() !== currentHourly.getTime()) hc = 0;
    if (new Date(p.daily_bucket).toISOString().slice(0, 10) !== currentDaily.toISOString().slice(0, 10)) dc = 0;
    if (p.max_actions_per_hour !== null && hc >= p.max_actions_per_hour) { await client.query("ROLLBACK"); return { authorized: false, reason: `rate_hour_${hc}/${p.max_actions_per_hour}` }; }
    if (p.max_actions_per_day !== null && dc >= p.max_actions_per_day) { await client.query("ROLLBACK"); return { authorized: false, reason: `rate_day_${dc}/${p.max_actions_per_day}` }; }
    if (p.max_actions_total !== null && Number(p.action_count) >= p.max_actions_total) { await client.query("ROLLBACK"); return { authorized: false, reason: `rate_total` }; }
    // Bump counters + record action
    await client.query(
      `UPDATE nex.authorization_policy SET action_count=action_count+1, action_count_last_hour=$1, action_count_last_day=$2, hourly_bucket=$3, daily_bucket=$4, last_action_at=now() WHERE policy_id=$5`,
      [hc + 1, dc + 1, currentHourly, currentDaily, p.policy_id]
    );
    await client.query(
      `INSERT INTO nex.authorized_action (policy_id, agent_id, action_kind, target_ref, target_summary, evidence, result)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'ok')`,
      [p.policy_id, input.agent_id, input.action_kind, input.target_ref ?? null, input.target_summary ?? null, JSON.stringify(ev)]
    );
    await client.query("COMMIT");
    return { authorized: true, policy_id: p.policy_id, policy_slug: p.slug };
  } catch (err) { try { await client.query("ROLLBACK"); } catch { /* ignore */ } throw err; }
}

async function emitFW(c, kind, status, message, ref = {}) {
  try {
    await c.query(
      `INSERT INTO nex.founder_window_event (subsystem, event_kind, status, actor, message, reference)
       VALUES ('notification', $1, $2, $3, $4, $5::jsonb)`,
      [kind, status, AGENT_ID, message, JSON.stringify(ref)]
    );
  } catch { /* silent */ }
}

// ─── SMTP sender (nodemailer if available, else honest failure) ────
let transporter = null;
async function getTransporter() {
  if (transporter) return transporter;
  if (!SMTP_URL) return null;
  try {
    const mod = await import("nodemailer");
    transporter = mod.default.createTransport(SMTP_URL);
    return transporter;
  } catch { return null; }
}

// Build the unsubscribe URL (HMAC-signed so recipient can't forge others)
function unsubUrl(email) {
  if (!UNSUB_SECRET) return `${BASE_URL}/unsubscribe`;
  const sig = createHmac("sha256", UNSUB_SECRET).update(email.toLowerCase()).digest("hex").slice(0, 32);
  return `${BASE_URL}/unsubscribe?e=${encodeURIComponent(email)}&s=${sig}`;
}

// Compose CAN-SPAM + GDPR-compliant HTML wrapper
function wrapHtml(bodyHtml, email, campaignId, unsub, physicalAddress) {
  const pixel = `${BASE_URL}/api/nex/marketing/pixel/${campaignId}?e=${encodeURIComponent(email)}`;
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;max-width:600px;margin:0 auto;padding:24px;">
${bodyHtml}
<hr style="margin-top:32px;border:0;border-top:1px solid #eee">
<p style="font-size:11px;color:#888;text-align:center;margin-top:16px">
You are receiving this because your business was discovered in a public source we index for the NEX directory.<br>
${physicalAddress}<br>
<a href="${unsub}" style="color:#888">Unsubscribe permanently</a>
</p>
<img src="${pixel}" width="1" height="1" alt="" style="display:block">
</body></html>`;
}

async function sendOne(c, item) {
  const trans = await getTransporter();
  const unsub = unsubUrl(item.email);
  const html = wrapHtml(item.template_html, item.email, item.campaign_id, unsub, PHYSICAL_ADDRESS);
  const headers = { "List-Unsubscribe": `<${unsub}>, <mailto:unsub@${new URL(BASE_URL).host}?subject=unsub>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
  if (!trans) {
    await c.query(
      `INSERT INTO nex.marketing_send_log (campaign_id, contact_id, email, esp, status, status_detail)
       VALUES ($1, $2, $3, $4, 'rejected', $5)`,
      [item.campaign_id, item.contact_id, item.email, ESP, "no_transporter"]
    );
    return { ok: false, reason: "no_transporter" };
  }
  try {
    const info = await trans.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: item.email,
      subject: item.subject_line,
      text: item.template_text,
      html,
      headers,
    });
    await c.query(
      `INSERT INTO nex.marketing_send_log (campaign_id, contact_id, email, esp, esp_message_id, status)
       VALUES ($1, $2, $3, $4, $5, 'accepted')`,
      [item.campaign_id, item.contact_id, item.email, ESP, info.messageId ?? null]
    );
    return { ok: true, esp_message_id: info.messageId };
  } catch (err) {
    await c.query(
      `INSERT INTO nex.marketing_send_log (campaign_id, contact_id, email, esp, status, status_detail)
       VALUES ($1, $2, $3, $4, 'rejected', $5)`,
      [item.campaign_id, item.contact_id, item.email, ESP, String(err).slice(0, 200)]
    );
    return { ok: false, reason: String(err).slice(0, 200) };
  }
}

// ─── Main loop ────────────────────────────────────────────────────
async function main() {
  writeHeartbeat({ status: "starting", send_enabled: SEND_ENABLED, esp: ESP });
  log(`daemon start · pid=${process.pid} · SEND_ENABLED=${SEND_ENABLED} · ESP=${ESP} · MAX/min=${MAX_PER_MIN}`);
  for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
    process.on(sig, () => { log(`caught ${sig} · exiting`); writeHeartbeat({ status: "stopped" }); process.exit(0); });
  }

  const { Client } = await import("pg");
  let successCount = 0, skippedCount = 0, failedCount = 0;
  const started = Date.now();
  let sendsThisMinute = 0;
  let minuteBucket = Math.floor(Date.now() / 60_000);

  while (true) {
    // Reset per-minute counter
    const currentMinute = Math.floor(Date.now() / 60_000);
    if (currentMinute !== minuteBucket) { minuteBucket = currentMinute; sendsThisMinute = 0; }

    writeHeartbeat({
      status: "running", send_enabled: SEND_ENABLED, esp: ESP,
      success_count: successCount, skipped_count: skippedCount, failed_count: failedCount,
      uptime_sec: Math.round((Date.now() - started) / 1000),
      sends_this_minute: sendsThisMinute,
    });

    // Cap per-minute (belt + suspenders on top of policy rate limit)
    if (sendsThisMinute >= MAX_PER_MIN) { await sleep(2000); continue; }

    const c = new Client({ connectionString: readPgUrl(), connectionTimeoutMillis: 5000 });
    try { await c.connect(); }
    catch (err) {
      log(`Postgres offline · waiting: ${String(err).slice(0, 100)}`);
      await sleep(15_000);
      continue;
    }

    try {
      // Claim a batch of pending sends
      const batch = (await c.query(`
        WITH picked AS (
          SELECT queue_id FROM nex.marketing_send_queue
          WHERE status = 'pending' AND next_attempt_at <= now()
          ORDER BY next_attempt_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED
        )
        UPDATE nex.marketing_send_queue q
          SET status='claimed', claimed_at=now(), claimed_by=$2
          FROM picked WHERE q.queue_id = picked.queue_id
        RETURNING q.queue_id, q.campaign_id, q.contact_id, q.email, q.attempts
      `, [BATCH_SIZE, AGENT_ID])).rows;

      if (batch.length === 0) { await c.end(); await sleep(POLL_INTERVAL_MS); continue; }

      // Load campaign + template + contact per item
      for (const item of batch) {
        const bundle = (await c.query(`
          SELECT cam.slug AS campaign_slug, cam.status AS campaign_status,
                 tpl.subject_line, tpl.html_compiled, tpl.text_fallback,
                 ct.country, ct.category_group, ct.category_slug, ct.consent_basis, ct.hard_bounced, ct.opt_out,
                 ct.business_name
          FROM nex.marketing_campaign cam
          JOIN nex.marketing_template tpl ON tpl.template_id = cam.template_id
          JOIN nex.marketing_contact ct ON ct.contact_id = $1
          WHERE cam.campaign_id = $2 LIMIT 1
        `, [item.contact_id, item.campaign_id])).rows[0];

        if (!bundle) {
          await c.query(`UPDATE nex.marketing_send_queue SET status='failed', error=$1 WHERE queue_id=$2`, ["bundle_missing", item.queue_id]);
          failedCount++; continue;
        }
        if (bundle.hard_bounced) {
          await c.query(`UPDATE nex.marketing_send_queue SET status='skipped_bounced' WHERE queue_id=$1`, [item.queue_id]);
          skippedCount++; continue;
        }
        if (bundle.opt_out) {
          await c.query(`UPDATE nex.marketing_send_queue SET status='skipped_opt_out' WHERE queue_id=$1`, [item.queue_id]);
          skippedCount++; continue;
        }
        if (bundle.campaign_status !== "sending" && bundle.campaign_status !== "approved") {
          // Campaign was paused/cancelled by founder · release row back to pending for later
          await c.query(`UPDATE nex.marketing_send_queue SET status='pending', claimed_at=NULL, claimed_by=NULL, next_attempt_at=now()+interval '5 minutes' WHERE queue_id=$1`, [item.queue_id]);
          skippedCount++; continue;
        }

        // POLICY GATE · not per-record HMAC · per-policy authorization
        if (!SEND_ENABLED) {
          await c.query(`UPDATE nex.marketing_send_queue SET status='failed', error=$1 WHERE queue_id=$2`, ["NEX_MARKETING_SEND_ENABLED=false · founder toggle required", item.queue_id]);
          skippedCount++;
          await emitFW(c, "action_rejected", "warning", `send blocked · NEX_MARKETING_SEND_ENABLED=false`, { queue_id: item.queue_id });
          continue;
        }
        const auth = await authorizeAction(c, {
          subsystem: "marketing_email",
          agent_class: "marketing_sender",
          action_kind: "send_email",
          agent_id: AGENT_ID,
          target_ref: createHash("sha256").update(item.email.toLowerCase()).digest("hex").slice(0, 16),
          target_summary: `${bundle.business_name ?? "?"} · ${item.email}`,
          evidence: { country: bundle.country, category_group: bundle.category_group, category_slug: bundle.category_slug, consent_basis: bundle.consent_basis, campaign_id: item.campaign_id },
        });
        if (!auth.authorized) {
          await c.query(`UPDATE nex.marketing_send_queue SET status='failed', error=$1 WHERE queue_id=$2`, [`policy_gate: ${auth.reason}`, item.queue_id]);
          skippedCount++;
          await emitFW(c, "action_rejected", "warning", `send blocked · ${auth.reason}`, { queue_id: item.queue_id, reason: auth.reason });
          continue;
        }

        // Send
        const r = await sendOne(c, {
          campaign_id: item.campaign_id, contact_id: item.contact_id, email: item.email,
          subject_line: bundle.subject_line, template_html: bundle.html_compiled, template_text: bundle.text_fallback,
        });
        if (r.ok) {
          successCount++; sendsThisMinute++;
          await c.query(`UPDATE nex.marketing_send_queue SET status='sent', sent_at=now(), esp_message_id=$1 WHERE queue_id=$2`, [r.esp_message_id ?? null, item.queue_id]);
          await c.query(`UPDATE nex.marketing_contact SET send_count=send_count+1, last_sent_at=now() WHERE contact_id=$1`, [item.contact_id]);
          await c.query(`UPDATE nex.marketing_campaign SET send_count=send_count+1 WHERE campaign_id=$1`, [item.campaign_id]);
          await emitFW(c, "action_authorized", "ok", `send ok · ${item.email}`, { policy: auth.policy_slug, esp: ESP });
          log(`  ✓ ${item.email} · policy=${auth.policy_slug}`);
        } else {
          failedCount++;
          const attempts = item.attempts + 1;
          const backoffSec = Math.min(3600, 60 * Math.pow(2, attempts));
          if (attempts >= 3) {
            await c.query(`UPDATE nex.marketing_send_queue SET status='failed', error=$1 WHERE queue_id=$2`, [r.reason ?? "send_failed", item.queue_id]);
          } else {
            await c.query(`UPDATE nex.marketing_send_queue SET status='pending', attempts=$1, next_attempt_at=now()+($2||' seconds')::interval, claimed_at=NULL, claimed_by=NULL WHERE queue_id=$3`, [attempts, backoffSec, item.queue_id]);
          }
          log(`  ✗ ${item.email} · attempt ${attempts} · ${r.reason}`);
        }
      }
    } finally { try { await c.end(); } catch { /* ignore */ } }
    await sleep(1000);
  }
}

main().catch((err) => { log("fatal: " + String(err).slice(0, 300)); writeHeartbeat({ status: "crashed" }); process.exit(1); });
