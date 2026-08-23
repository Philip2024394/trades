#!/usr/bin/env node
// NEX Food · Phase 6 · claim CLI.
//
// Admin surface for requesting/verifying claim codes. Once self-service
// lands (Phase 6b · owner-initiated claim), this CLI stays as the admin
// override path.
//
// USAGE
//   claim.mjs request <ref> [--language=id|en] [--by=actor] [--dry-run]
//   claim.mjs verify  <ref> <code>
//   claim.mjs status  <ref>

import pg from "pg";
import { randomInt } from "node:crypto";

const args = process.argv.slice(2);
const cmd = args[0];

const CLAIM_CODE_LENGTH = 6;
const CLAIM_CODE_TTL_MS = 10 * 60 * 1000;
const CLAIM_CODE_MAX_ATTEMPTS = 5;

function argValue(name, fallback) {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=").slice(1).join("=") : fallback;
}

function generateClaimCode() {
  const digits = [];
  for (let i = 0; i < CLAIM_CODE_LENGTH; i++) digits.push(String(randomInt(0, 10)));
  return digits.join("");
}

function renderTemplate(body, ctx) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => ctx[k] != null ? String(ctx[k]) : `{{${k}}}`);
}

async function getPool() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
  return new pg.Pool({ connectionString: url });
}

// ── request ────────────────────────────────────────────────────────────────

async function cmdRequest() {
  const ref = args[1];
  if (!ref) { console.error("USAGE: claim.mjs request <ref> [--language=id|en] [--by=actor] [--dry-run]"); process.exit(1); }
  const language = argValue("language", "id");
  const actor = argValue("by", "cli:claim.mjs");
  const dryRun = args.includes("--dry-run");

  const pool = await getPool();

  const bizQ = await pool.query(
    `SELECT public_listing_ref, business_name, claim_status, phone, whatsapp_number
     FROM nex.food_business WHERE public_listing_ref = $1`,
    [ref]
  );
  if (bizQ.rowCount === 0) { console.error(`No business ref=${ref}`); await pool.end(); process.exit(1); }
  const b = bizQ.rows[0];
  if (!["discovered", "listed", "invited"].includes(b.claim_status)) {
    console.error(`Cannot request claim code · current claim_status=${b.claim_status} (must be discovered, listed, or invited)`);
    await pool.end();
    process.exit(1);
  }
  const destination = b.whatsapp_number ?? b.phone;
  if (!destination) { console.error(`No WhatsApp or phone destination on ${ref}`); await pool.end(); process.exit(1); }

  // Invalidate any existing active codes for this business
  const inv = await pool.query(
    `UPDATE nex.food_claim_code
     SET invalidated_at = now(), invalidated_reason = 'superseded_by_new_request'
     WHERE business_ref = $1 AND consumed_at IS NULL AND invalidated_at IS NULL
     RETURNING claim_code_id`,
    [ref]
  );
  if (inv.rowCount > 0) console.log(`  invalidated ${inv.rowCount} previous unconsumed code(s)`);

  const code = generateClaimCode();
  const expiresAt = new Date(Date.now() + CLAIM_CODE_TTL_MS);

  // Store hash · plaintext never persisted
  await pool.query(
    `INSERT INTO nex.food_claim_code
       (business_ref, code_hash, destination, channel, requested_by, expires_at)
     VALUES ($1, crypt($2, gen_salt('bf')), $3, 'whatsapp', $4, $5)`,
    [ref, code, destination, actor, expiresAt]
  );

  // Fetch template
  const tplId = `claim_code_${language}_whatsapp_v1`;
  const tplQ = await pool.query(
    `SELECT body FROM nex.food_outreach_template WHERE template_id = $1 AND active = true`,
    [tplId]
  );
  if (tplQ.rowCount === 0) { console.error(`Template ${tplId} not found or inactive`); await pool.end(); process.exit(1); }

  const claimLink = `https://nex.example/food/claim/${ref.replace(/^#FL-/, "")}`;
  const body = renderTemplate(tplQ.rows[0].body, {
    business_name: b.business_name,
    public_listing_ref: ref,
    claim_code: code,
    claim_link: claimLink,
  });

  // Log to outreach audit trail
  await pool.query(
    `INSERT INTO nex.food_outreach_attempt
       (business_ref, channel, template_id, status, destination, rendered_body, attempted_by)
     VALUES ($1, 'whatsapp', $2, $3, $4, $5, $6)`,
    [ref, tplId, dryRun ? "dry_run" : "queued", destination, body, actor]
  );

  console.log(`── claim code requested ──`);
  console.log(`  business    : ${ref}  ${b.business_name}`);
  console.log(`  language    : ${language}`);
  console.log(`  destination : ${destination}`);
  console.log(`  code        : ${dryRun ? code : "(hidden · sent via WhatsApp)"}${dryRun ? "  (dry-run · plaintext visible for testing only)" : ""}`);
  console.log(`  expires     : ${expiresAt.toISOString()}`);
  console.log(`  claim link  : ${claimLink}`);
  console.log(`  message body:`);
  console.log("  " + "─".repeat(60));
  body.split("\n").forEach((l) => console.log("  " + l));
  console.log("  " + "─".repeat(60));

  await pool.end();
}

// ── verify ─────────────────────────────────────────────────────────────────

async function cmdVerify() {
  const ref = args[1];
  const code = args[2];
  if (!ref || !code) { console.error("USAGE: claim.mjs verify <ref> <code>"); process.exit(1); }
  const pool = await getPool();

  const codeQ = await pool.query(
    `SELECT claim_code_id, code_hash, expires_at, attempt_count
     FROM nex.food_claim_code
     WHERE business_ref = $1 AND consumed_at IS NULL AND invalidated_at IS NULL
     ORDER BY requested_at DESC LIMIT 1`,
    [ref]
  );
  if (codeQ.rowCount === 0) { console.error(`No active claim code for ${ref}`); await pool.end(); process.exit(1); }
  const c = codeQ.rows[0];

  if (new Date(c.expires_at) < new Date()) {
    console.error(`Code expired at ${c.expires_at}`);
    await pool.query(
      `UPDATE nex.food_claim_code SET invalidated_at = now(), invalidated_reason = 'expired' WHERE claim_code_id = $1`,
      [c.claim_code_id]
    );
    await pool.end();
    process.exit(1);
  }
  if (c.attempt_count >= CLAIM_CODE_MAX_ATTEMPTS) {
    console.error(`Attempt limit reached (${CLAIM_CODE_MAX_ATTEMPTS}) · invalidating code`);
    await pool.query(
      `UPDATE nex.food_claim_code SET invalidated_at = now(), invalidated_reason = 'attempt_limit' WHERE claim_code_id = $1`,
      [c.claim_code_id]
    );
    await pool.end();
    process.exit(1);
  }

  // Verify via pgcrypto
  const match = await pool.query(
    `SELECT code_hash = crypt($1, code_hash) AS matched FROM nex.food_claim_code WHERE claim_code_id = $2`,
    [code, c.claim_code_id]
  );
  const matched = match.rows[0]?.matched === true;

  await pool.query(
    `UPDATE nex.food_claim_code SET attempt_count = attempt_count + 1 WHERE claim_code_id = $1`,
    [c.claim_code_id]
  );

  if (!matched) {
    const remaining = CLAIM_CODE_MAX_ATTEMPTS - (c.attempt_count + 1);
    console.error(`  Code incorrect · ${remaining} attempt(s) remaining`);
    await pool.end();
    process.exit(1);
  }

  // Mark consumed
  await pool.query(
    `UPDATE nex.food_claim_code SET consumed_at = now() WHERE claim_code_id = $1`,
    [c.claim_code_id]
  );

  // Flip claim + owner status · this is the moment doctrine merge-safety
  // activates: no future OSM import can touch this row.
  await pool.query(
    `UPDATE nex.food_business
     SET claim_status = 'claimed', owner_status = 'verified'
     WHERE public_listing_ref = $1`,
    [ref]
  );

  console.log(`── CLAIM SUCCESSFUL ──`);
  console.log(`  ${ref}  · claim_status: claimed  · owner_status: verified`);
  console.log(`  From this moment: OSM re-imports NEVER overwrite this row's fields.`);

  await pool.end();
}

// ── status ─────────────────────────────────────────────────────────────────

async function cmdStatus() {
  const ref = args[1];
  if (!ref) { console.error("USAGE: claim.mjs status <ref>"); process.exit(1); }
  const pool = await getPool();
  const b = await pool.query(
    `SELECT public_listing_ref, business_name, claim_status, owner_status FROM nex.food_business WHERE public_listing_ref = $1`,
    [ref]
  );
  if (b.rowCount === 0) { console.error(`No business ref=${ref}`); await pool.end(); process.exit(1); }
  console.log(`  ${b.rows[0].public_listing_ref}  ${b.rows[0].business_name}`);
  console.log(`  claim=${b.rows[0].claim_status}  owner=${b.rows[0].owner_status}`);
  const codes = await pool.query(
    `SELECT claim_code_id, requested_at, expires_at, attempt_count, consumed_at, invalidated_at, invalidated_reason
     FROM nex.food_claim_code WHERE business_ref = $1 ORDER BY requested_at DESC`,
    [ref]
  );
  console.log(`  claim codes: ${codes.rowCount}`);
  codes.rows.forEach((c) => {
    const status = c.consumed_at ? `consumed at ${c.consumed_at.toISOString()}`
      : c.invalidated_at ? `invalidated (${c.invalidated_reason})`
      : new Date(c.expires_at) < new Date() ? "expired (needs sweep)"
      : "ACTIVE";
    console.log(`    ${c.requested_at.toISOString()}  attempts=${c.attempt_count}  ${status}`);
  });
  await pool.end();
}

async function main() {
  switch (cmd) {
    case "request": return cmdRequest();
    case "verify": return cmdVerify();
    case "status": return cmdStatus();
    default:
      console.error("USAGE:");
      console.error("  claim.mjs request <ref> [--language=id|en] [--by=actor] [--dry-run]");
      console.error("  claim.mjs verify <ref> <code>");
      console.error("  claim.mjs status <ref>");
      process.exit(1);
  }
}

main().catch((err) => { console.error(`FATAL: ${err.message}`); process.exit(1); });
