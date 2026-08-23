#!/usr/bin/env node
// NEX Food · Phase 5 · outreach CLI (channel-swappable · WhatsApp-first Indonesia).
//
// Ships in Phase 5:
//   - Template rendering with placeholder substitution
//   - Eligibility check: claim_status='listed'+, suppression list, 30-day cooldown
//   - --dry-run mode prints the message that WOULD be sent (no provider call)
//   - Every attempt writes to nex.food_outreach_attempt audit log
//
// Does NOT ship yet (Phase 5b · when Philip picks a WhatsApp provider):
//   - Real WhatsApp API integration (Twilio / Wati / Meta Cloud API)
//   - Delivery status webhooks
//   - Auto-suppression on hard bounce
//
// USAGE
//   node scripts/nex-food/outreach.mjs templates list
//   node scripts/nex-food/outreach.mjs send <ref> --template=<id>
//     [--channel=whatsapp|email]  [--dry-run]  [--by=<actor>]
//   node scripts/nex-food/outreach.mjs history <ref>
//   node scripts/nex-food/outreach.mjs suppress <ref> --reason=<reason>
//     [--channel=whatsapp|email|phone|website]  [--by=<actor>]

import pg from "pg";

const args = process.argv.slice(2);
const cmd = args[0];

function argValue(name, fallback) {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=").slice(1).join("=") : fallback;
}

async function getPool() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
  return new pg.Pool({ connectionString: url });
}

// ── Template rendering ──────────────────────────────────────────────────────

function renderTemplate(body, ctx) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = ctx[key];
    if (value == null) return `{{${key}}}`;   // leave unrendered placeholders visible
    return String(value);
  });
}

// ── Eligibility ─────────────────────────────────────────────────────────────

async function checkEligibility(pool, business, channel) {
  // 1. claim_status must be at least 'listed'
  if (!["listed", "invited", "claimed", "paying"].includes(business.claim_status)) {
    return { eligible: false, reason: `claim_status=${business.claim_status} · must be 'listed' or above` };
  }
  // 2. Suppression check
  const supp = await pool.query(
    `SELECT reason, channel FROM nex.food_outreach_suppression
     WHERE business_ref = $1 AND (channel IS NULL OR channel = $2)
     LIMIT 1`,
    [business.public_listing_ref, channel]
  );
  if (supp.rowCount > 0) {
    const row = supp.rows[0];
    return { eligible: false, reason: `suppressed (${row.channel ?? "ALL channels"}) · ${row.reason}` };
  }
  // 3. 30-day cooldown check on this channel
  const cooldown = await pool.query(
    `SELECT created_at FROM nex.food_outreach_attempt
     WHERE business_ref = $1 AND channel = $2
       AND status IN ('sent','delivered','queued','dry_run')
     ORDER BY created_at DESC LIMIT 1`,
    [business.public_listing_ref, channel]
  );
  if (cooldown.rowCount > 0) {
    const last = new Date(cooldown.rows[0].created_at);
    const ageMs = Date.now() - last.getTime();
    if (ageMs < 30 * 24 * 60 * 60 * 1000) {
      const daysLeft = Math.ceil((30 * 24 * 60 * 60 * 1000 - ageMs) / (24 * 60 * 60 * 1000));
      return { eligible: false, reason: `30-day cooldown active · ${daysLeft} day(s) left` };
    }
  }
  // 4. Destination must be present
  const destination = channel === "whatsapp"
    ? (business.whatsapp_number ?? business.phone)
    : channel === "phone"
    ? business.phone
    : channel === "email"
    ? business.email        // not in schema yet · will be null
    : channel === "website"
    ? business.website
    : null;
  if (!destination) {
    return { eligible: false, reason: `no destination for channel=${channel}` };
  }
  return { eligible: true, destination };
}

// ── Commands ───────────────────────────────────────────────────────────────

async function cmdTemplatesList() {
  const pool = await getPool();
  const r = await pool.query(`
    SELECT template_id, channel, language, purpose, active, subject
    FROM nex.food_outreach_template
    ORDER BY purpose, language, channel
  `);
  console.log(`── outreach templates · ${r.rowCount} ──`);
  r.rows.forEach((t) => {
    console.log(`  ${t.template_id}`);
    console.log(`    channel=${t.channel}  lang=${t.language}  purpose=${t.purpose}  active=${t.active}`);
    if (t.subject) console.log(`    subject: ${t.subject}`);
  });
  await pool.end();
}

async function cmdSend() {
  const ref = args[1];
  if (!ref || !ref.startsWith("#FL-")) {
    console.error("USAGE: outreach.mjs send <#FL-YYYY-XXXXX> --template=<id> [--channel=X] [--dry-run] [--by=actor]");
    process.exit(1);
  }
  const templateId = argValue("template");
  if (!templateId) { console.error("--template=<id> required"); process.exit(1); }
  const channelArg = argValue("channel");
  const dryRun = args.includes("--dry-run");
  const actor = argValue("by", "cli:outreach.mjs");

  const pool = await getPool();

  // Load business
  const bizQ = await pool.query(
    `SELECT public_listing_ref, business_name, claim_status, phone, whatsapp_number, website
     FROM nex.food_business WHERE public_listing_ref = $1`,
    [ref]
  );
  if (bizQ.rowCount === 0) { console.error(`No business with ref=${ref}`); await pool.end(); process.exit(1); }
  const business = bizQ.rows[0];

  // Load template
  const tplQ = await pool.query(
    `SELECT template_id, channel, language, purpose, subject, body, active
     FROM nex.food_outreach_template WHERE template_id = $1`,
    [templateId]
  );
  if (tplQ.rowCount === 0) { console.error(`No template with id=${templateId}`); await pool.end(); process.exit(1); }
  const template = tplQ.rows[0];
  if (!template.active) { console.error(`Template ${templateId} is inactive · use another`); await pool.end(); process.exit(1); }

  const channel = channelArg ?? template.channel;
  if (channel !== template.channel) {
    console.error(`Template channel=${template.channel} but --channel=${channel} requested · refusing to send cross-channel`);
    await pool.end();
    process.exit(1);
  }

  // Eligibility
  const elig = await checkEligibility(pool, business, channel);
  console.log(`── outreach send ──`);
  console.log(`  business : ${business.public_listing_ref}  ${business.business_name}`);
  console.log(`  template : ${templateId} (${template.language}, ${template.purpose})`);
  console.log(`  channel  : ${channel}`);
  console.log(`  actor    : ${actor}`);
  console.log(`  eligible : ${elig.eligible ? "YES" : "NO · " + elig.reason}`);

  if (!elig.eligible) {
    // Still audit-log the blocked attempt.
    const blockedStatus = elig.reason?.includes("suppressed") ? "opted_out"
      : elig.reason?.includes("cooldown") ? "rate_limited"
      : "failed";
    await pool.query(
      `INSERT INTO nex.food_outreach_attempt
       (business_ref, channel, template_id, status, status_reason, destination, rendered_body, attempted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [business.public_listing_ref, channel, templateId, blockedStatus, elig.reason, "n/a", "n/a", actor]
    );
    console.log(`  logged as: ${blockedStatus}`);
    await pool.end();
    process.exit(0);
  }

  // Render
  const rendered = renderTemplate(template.body, {
    business_name: business.business_name,
    public_listing_ref: business.public_listing_ref,
    claim_link: `https://nex.example/food/claim/${encodeURIComponent(business.public_listing_ref)}`,
  });

  console.log(`  destination: ${elig.destination}`);
  console.log(`  rendered body:`);
  console.log("  " + "─".repeat(60));
  rendered.split("\n").forEach((line) => console.log("  " + line));
  console.log("  " + "─".repeat(60));

  const status = dryRun ? "dry_run" : "queued";
  // "queued" is honest here · Phase 5b will flip queued → sent once we wire
  // a real WhatsApp provider. Phase 5 does NOT actually transmit anything.

  await pool.query(
    `INSERT INTO nex.food_outreach_attempt
     (business_ref, channel, template_id, status, destination, rendered_body, attempted_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [business.public_listing_ref, channel, templateId, status, elig.destination, rendered, actor]
  );

  if (!dryRun) {
    // Also progress claim_status: listed → invited on first successful outreach.
    if (business.claim_status === "listed") {
      await pool.query(
        `UPDATE nex.food_business SET claim_status='invited', owner_status='contacted' WHERE public_listing_ref=$1`,
        [business.public_listing_ref]
      );
      console.log(`  claim_status: listed → invited  · owner_status: unknown → contacted`);
    }
  }

  console.log(`  logged as: ${status}${dryRun ? " (nothing actually transmitted · Phase 5b will wire a WhatsApp provider)" : " (awaiting Phase 5b provider send)"}`);
  await pool.end();
}

async function cmdHistory() {
  const ref = args[1];
  if (!ref) { console.error("USAGE: outreach.mjs history <ref>"); process.exit(1); }
  const pool = await getPool();
  const r = await pool.query(
    `SELECT attempt_id, channel, template_id, status, status_reason, destination, attempted_by, created_at
     FROM nex.food_outreach_attempt
     WHERE business_ref = $1
     ORDER BY created_at DESC`,
    [ref]
  );
  console.log(`── outreach history · ${ref} · ${r.rowCount} attempts ──`);
  r.rows.forEach((a) => {
    console.log(`  ${a.created_at.toISOString?.() ?? a.created_at}  ${a.channel.padEnd(8)}  ${a.status.padEnd(13)}  ${a.template_id}`);
    if (a.status_reason) console.log(`     reason: ${a.status_reason}`);
    console.log(`     to: ${a.destination}  by: ${a.attempted_by}`);
  });
  await pool.end();
}

async function cmdSuppress() {
  const ref = args[1];
  if (!ref) { console.error("USAGE: outreach.mjs suppress <ref> --reason=<reason> [--channel=X] [--by=actor]"); process.exit(1); }
  const reason = argValue("reason");
  if (!reason) { console.error("--reason=<reason> required (e.g. owner_opt_out, unreachable, inappropriate)"); process.exit(1); }
  const channel = argValue("channel", null);
  const actor = argValue("by", "cli:outreach.mjs");
  const pool = await getPool();
  await pool.query(
    `INSERT INTO nex.food_outreach_suppression (business_ref, channel, reason, suppressed_by)
     VALUES ($1, $2, $3, $4)`,
    [ref, channel, reason, actor]
  );
  console.log(`  suppressed ${ref} on channel=${channel ?? "ALL"} · reason=${reason} · by=${actor}`);
  await pool.end();
}

async function main() {
  switch (cmd) {
    case "templates": return cmdTemplatesList();
    case "send": return cmdSend();
    case "history": return cmdHistory();
    case "suppress": return cmdSuppress();
    default:
      console.error("USAGE:");
      console.error("  outreach.mjs templates list");
      console.error("  outreach.mjs send <ref> --template=<id> [--channel=X] [--dry-run]");
      console.error("  outreach.mjs history <ref>");
      console.error("  outreach.mjs suppress <ref> --reason=<r> [--channel=X]");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
});
