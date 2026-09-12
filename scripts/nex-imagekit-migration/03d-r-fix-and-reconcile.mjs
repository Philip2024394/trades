// NEX ImageKit → Supabase migration · Phase 3D-R fix + reconciliation.
// Philip 2026-09-02 · authorised · READ-ONLY VALIDATION.
//
// ═══════════════════════════════════════════════════════════════════════
// HARD SCOPE
// ═══════════════════════════════════════════════════════════════════════
//
// Implements the two fixes Philip approved after Phase 3D-R exposed the
// aliased-URL collision problem and the A1 upload-error observability gap:
//
//   FIX 1 · De-aliased selection · pipeline-utils.mjs · selectDealiased
//     · One migration candidate per destination_path
//     · All 2,147 ledger entries preserved
//     · No new ALIASED_OF status
//     · No source/dest URLs renamed or merged
//
//   FIX 2 · Rich upload error capture · pipeline-utils.mjs · uploadWithDetail
//     · Captures Supabase error.message / name / code / http_status
//     · Never logs credentials/tokens/service keys
//     · Ready for Phase 3E consumption
//
// This script itself is READ-ONLY:
//   · No uploads
//   · No new migrations
//   · No ledger entry mutations (only additive diagnostic top-level blocks)
//   · No DB writes · no manifests · no source · no frame/shell · no ImageKit mutations
//   · No dedup / cleanup / new statuses invented
//
// Output written to ledger (as additive top-level blocks):
//   · destination_collisions       — read-only 174-group collision report
//   · a1_reconciliation            — read-only A1 diagnostic
//   · last_phase_3d_r_fix_report   — run summary with all 10 required attestations

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { selectDealiased, uploadWithDetail } from "./pipeline-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const repoRoot   = join(__dirname, "..", "..");

const BUCKET          = "nex-media";
const HEAD_TIMEOUT_MS = 15_000;
const A1_URL          = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2001_18_11%20AM.png";

// ─── Env + NEX-only guard ─────────────────────────────────────
function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = loadEnv();
const NEX_URL = env.NEX_SUPABASE_URL || env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const NEX_KEY = env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!NEX_URL || !NEX_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error(`REFUSING · NEX project guard failed · saw ${NEX_URL}`);
  process.exit(1);
}
if (!NEX_KEY) { console.error("Missing service role key"); process.exit(1); }
const sb = createClient(NEX_URL, NEX_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const LEDGER_PATH = join(repoRoot, "data/nex-imagekit-migration-ledger.json");
if (!existsSync(LEDGER_PATH)) { console.error("Ledger not found"); process.exit(1); }

const sha256 = (buf) => createHash("sha256").update(Buffer.from(buf)).digest("hex");

async function headSupabase(destination_path) {
  const url = `${NEX_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(destination_path)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HEAD_TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(t);
    return {
      url,
      status: r.status,
      exists: r.status === 200,
      content_length: r.status === 200 ? (Number(r.headers.get("content-length")) || null) : null,
      content_type:   r.status === 200 ? r.headers.get("content-type") : null,
    };
  } catch (e) {
    clearTimeout(t);
    return { url, status: 0, exists: false, error: e.message };
  }
}

async function getSupabase(destination_path) {
  const url = `${NEX_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(destination_path)}`;
  const r = await fetch(url);
  if (!r.ok) return { ok: false, http_status: r.status };
  const buf = await r.arrayBuffer();
  return {
    ok: true,
    http_status:    r.status,
    content_length: buf.byteLength,
    content_type:   r.headers.get("content-type"),
    sha256:         sha256(buf),
  };
}

async function getImageKit(source_url) {
  try {
    const headCtrl = new AbortController();
    const headT = setTimeout(() => headCtrl.abort(), HEAD_TIMEOUT_MS);
    const headR = await fetch(source_url, { method: "HEAD", redirect: "follow", signal: headCtrl.signal });
    clearTimeout(headT);
    if (!headR.ok) return { ok: false, phase: "HEAD", http_status: headR.status };
    const getR = await fetch(source_url, { redirect: "follow" });
    if (!getR.ok) return { ok: false, phase: "GET", http_status: getR.status };
    const buf = await getR.arrayBuffer();
    return {
      ok: true,
      http_status:    getR.status,
      content_length: buf.byteLength,
      content_type:   getR.headers.get("content-type") || headR.headers.get("content-type"),
      sha256:         sha256(buf),
    };
  } catch (e) {
    return { ok: false, phase: "network", error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
(async () => {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" NEX ImageKit → Supabase · Phase 3D-R fix + reconcile");
  console.log(" Read-only · no uploads · no new migrations");
  console.log("═══════════════════════════════════════════════════════════\n");

  const startedAt = new Date().toISOString();
  const ledger    = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const totalEntriesBefore = ledger.entries.length;

  // ─── Dry-run selectDealiased to attest Fix 1 is functional ─────────
  console.log(`Fix 1 verification · dry-run selectDealiased at pretend-hardLimit=100...`);
  const dealiasDryRun = selectDealiased(ledger, {
    hardLimit: 100,
    distribution: { "5vv5pw26q": 45, "9mrgsv2rp": 45, "nepgaxllc": 10 },
  });
  console.log(`  eligible PENDING before de-alias:       ${dealiasDryRun.eligible_before}`);
  console.log(`  candidate pool after de-alias:          ${dealiasDryRun.candidate_pool}`);
  console.log(`  groups skipped (alias of selected):     ${dealiasDryRun.groups_skipped_alias_of_selected}`);
  console.log(`  groups skipped (dest already verified): ${dealiasDryRun.groups_skipped_destination_verified}`);
  console.log(`  skipped_aliases records:                ${dealiasDryRun.skipped_aliases.length}`);
  console.log(`  would-select candidates (capped 100):   ${dealiasDryRun.candidates.length}\n`);

  // ─── Build destination_collisions report (read-only) ───────────────
  console.log(`Building destination_collisions report...`);
  const collisionMap = new Map();
  for (const e of ledger.entries) {
    if (!e.destination_path) continue;
    if (!collisionMap.has(e.destination_path)) collisionMap.set(e.destination_path, []);
    collisionMap.get(e.destination_path).push(e);
  }
  const collisionGroups = [];
  for (const [dest, entries] of collisionMap.entries()) {
    if (entries.length <= 1) continue;
    collisionGroups.push({
      destination_path:      dest,
      source_urls_count:     entries.length,
      source_urls:           entries.map((e) => e.source_url),
      statuses:              entries.map((e) => e.status),
      provenance:            entries.map((e) => e.provenance),
      validation_state:      entries.map((e) => e.validation_state || null),
      sha256:                entries.map((e) => e.sha256 || null),
      supabase_object_exists:         null,
      supabase_object_http_status:    null,
      supabase_object_content_length: null,
      supabase_object_content_type:   null,
    });
  }

  console.log(`  Total collision groups: ${collisionGroups.length}`);
  console.log(`  HEAD-checking Supabase for each destination_path...`);
  let checked = 0;
  for (const g of collisionGroups) {
    const head = await headSupabase(g.destination_path);
    g.supabase_object_http_status    = head.status;
    g.supabase_object_exists         = head.exists;
    g.supabase_object_content_length = head.content_length;
    g.supabase_object_content_type   = head.content_type;
    checked++;
    if (checked % 25 === 0) console.log(`    ${checked}/${collisionGroups.length}...`);
  }
  const groupsWithVerified = collisionGroups.filter((g) => g.statuses.includes("VERIFIED")).length;
  const groupsWithPending  = collisionGroups.filter((g) => g.statuses.includes("PENDING")).length;
  const groupsWithBoth     = collisionGroups.filter((g) => g.statuses.includes("VERIFIED") && g.statuses.includes("PENDING")).length;
  const groupsObjectExists = collisionGroups.filter((g) => g.supabase_object_exists === true).length;
  const totalSourceUrlsInvolved = collisionGroups.reduce((s, g) => s + g.source_urls_count, 0);
  console.log(`  ✓ Collision analysis complete`);
  console.log(`    Groups:                          ${collisionGroups.length}`);
  console.log(`    Total source URLs involved:      ${totalSourceUrlsInvolved}`);
  console.log(`    Groups with any VERIFIED entry:  ${groupsWithVerified}`);
  console.log(`    Groups with any PENDING entry:   ${groupsWithPending}`);
  console.log(`    Groups with BOTH statuses:       ${groupsWithBoth}`);
  console.log(`    Groups with Supabase object:     ${groupsObjectExists}\n`);

  // ─── A1 reconciliation (read-only) ─────────────────────────────────
  console.log(`A1 reconciliation · reading source binary + destination object...`);
  const a1Entry = ledger.entries.find((e) => e.source_url === A1_URL);
  if (!a1Entry) {
    console.error("A1 entry not found in ledger");
    process.exit(1);
  }
  console.log(`  A1 source_url:        ${a1Entry.source_url}`);
  console.log(`  A1 destination_path:  ${a1Entry.destination_path}`);
  console.log(`  A1 ledger status:     ${a1Entry.status}`);
  console.log(`  A1 ledger sha256:     ${a1Entry.sha256 || "(empty)"}`);

  const [src, dst] = await Promise.all([
    getImageKit(a1Entry.source_url),
    getSupabase(a1Entry.destination_path),
  ]);

  const shaMatch  = src.ok && dst.ok && src.sha256 === dst.sha256;
  const sizeMatch = src.ok && dst.ok && src.content_length === dst.content_length;
  const mimeMatch = src.ok && dst.ok && (
    (src.content_type || "").toLowerCase() === (dst.content_type || "").toLowerCase() ||
    (/jpe?g/i.test(src.content_type || "") && /jpe?g/i.test(dst.content_type || ""))
  );

  const a1Reconciliation = {
    ran_at: new Date().toISOString(),
    source_url:        a1Entry.source_url,
    destination_path:  a1Entry.destination_path,
    ledger_status_before_reconcile: a1Entry.status,
    ledger_status_after_reconcile:  a1Entry.status, // UNCHANGED · Philip's instruction
    source:      src,
    destination: dst,
    checks: {
      destination_object_exists:      dst.ok,
      destination_object_retrievable: dst.ok,
      sha256_match:                   shaMatch,
      byte_length_match:              sizeMatch,
      content_type_match:             mimeMatch,
    },
    proposed_diagnostic_state: (dst.ok && shaMatch && sizeMatch && mimeMatch)
      ? "RECONCILED_EXISTING_OBJECT (proposed · not applied · awaits Philip's ledger-status decision)"
      : "RECONCILIATION_MISMATCH",
    original_upload_error_recoverable: false,
    original_upload_error_note:        "The original A1 Run 1 upload error message was not captured by processOne at the time of failure — Fix 2 (uploadWithDetail) prevents this happening on future upload attempts, but cannot reconstruct the original error. Re-attempting the A1 upload today would return 'already exists' (destination populated by A2's Run 1 upload) so the original error condition cannot be reproduced non-destructively.",
    ledger_entry_touched: false,
  };
  console.log(`  Source (ImageKit)       ok=${src.ok} · sha=${(src.sha256 || "").slice(0, 10)}… · size=${src.content_length}B · mime=${src.content_type}`);
  console.log(`  Destination (Supabase)  ok=${dst.ok} · sha=${(dst.sha256 || "").slice(0, 10)}… · size=${dst.content_length}B · mime=${dst.content_type}`);
  console.log(`  Checks: exists=${dst.ok} retrievable=${dst.ok} sha=${shaMatch} size=${sizeMatch} mime=${mimeMatch}`);
  console.log(`  Proposed diagnostic state: ${a1Reconciliation.proposed_diagnostic_state}`);
  console.log(`  Ledger entry touched: NO (A1 remains ${a1Entry.status})\n`);

  // ─── Assemble the 10-point validation report ────────────────────────
  const validationReport = {
    ran_at: new Date().toISOString(),
    fixes_implemented: {
      fix_1_de_aliased_selection: {
        library: "scripts/nex-imagekit-migration/pipeline-utils.mjs",
        exported_function: "selectDealiased",
        strategy: "one PENDING candidate per destination_path · alias entries preserved · reported via skipped_aliases · never deletes / renames / re-statuses",
      },
      fix_2_upload_error_detail: {
        library: "scripts/nex-imagekit-migration/pipeline-utils.mjs",
        exported_function: "uploadWithDetail",
        captures: ["source_url", "destination_path", "attempt", "supabase_error_message", "supabase_error_name", "supabase_error_code", "http_status", "raw_error_repr (whitelisted fields only)"],
        never_logs: ["credentials", "tokens", "service_role_key", "auth_headers", "cookies"],
        upsert_false_always: true,
      },
    },
    fix_1_dry_run: dealiasDryRun,
    reports: {
      "1_destination_path_collision_groups":                   collisionGroups.length,
      "2_source_urls_involved_in_collisions":                  totalSourceUrlsInvolved,
      "3_collision_groups_containing_VERIFIED_entries":        groupsWithVerified,
      "4_collision_groups_containing_PENDING_entries":         groupsWithPending,
      "5_a1_reconciliation":                                   a1Reconciliation.proposed_diagnostic_state,
      "6_a1_original_upload_error_recoverable":                a1Reconciliation.original_upload_error_recoverable,
      "6_a1_original_upload_error_note":                       a1Reconciliation.original_upload_error_note,
      "7_ledger_entries_preserved":                            null, // filled at end
      "8_db_writes":                                           0,
      "9_imagekit_mutations":                                  0,
      "10_application_manifest_shell_changes":                 0,
    },
    additional_stats: {
      collision_groups_with_both_statuses:  groupsWithBoth,
      collision_groups_with_supabase_object: groupsObjectExists,
    },
  };

  // ─── Write diagnostic blocks additively (no entry mutation) ─────────
  ledger.destination_collisions = {
    computed_at: startedAt,
    total_groups: collisionGroups.length,
    total_source_urls_involved: totalSourceUrlsInvolved,
    groups_containing_VERIFIED: groupsWithVerified,
    groups_containing_PENDING:  groupsWithPending,
    groups_containing_both:     groupsWithBoth,
    groups_with_supabase_object: groupsObjectExists,
    groups: collisionGroups,
  };
  ledger.a1_reconciliation = a1Reconciliation;
  ledger.last_phase_3d_r_fix_report = validationReport;

  const totalEntriesAfter = ledger.entries.length;
  if (totalEntriesBefore !== totalEntriesAfter) {
    console.error(`LEDGER CONSERVATION FAILURE · before ${totalEntriesBefore} · after ${totalEntriesAfter}`);
    process.exit(1);
  }
  validationReport.reports["7_ledger_entries_preserved"] = totalEntriesAfter;

  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));

  // ─── Console summary ────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" Phase 3D-R fix + reconcile complete · READ-ONLY VALIDATION");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(` Fix 1 library:  scripts/nex-imagekit-migration/pipeline-utils.mjs · selectDealiased`);
  console.log(` Fix 2 library:  scripts/nex-imagekit-migration/pipeline-utils.mjs · uploadWithDetail`);
  console.log("");
  console.log(` 10-point read-only validation report:`);
  console.log(`   1) destination_path collision groups:                   ${collisionGroups.length}`);
  console.log(`   2) source URLs involved:                                ${totalSourceUrlsInvolved}`);
  console.log(`   3) collision groups containing VERIFIED entries:        ${groupsWithVerified}`);
  console.log(`   4) collision groups containing PENDING entries:         ${groupsWithPending}`);
  console.log(`   5) A1 reconciliation:                                   ${a1Reconciliation.proposed_diagnostic_state}`);
  console.log(`   6) original A1 upload error recoverable:                ${a1Reconciliation.original_upload_error_recoverable} (see note in report)`);
  console.log(`   7) ledger entries preserved:                            ${totalEntriesBefore} → ${totalEntriesAfter} ${totalEntriesBefore === totalEntriesAfter ? "✓" : "✗"}`);
  console.log(`   8) DB writes:                                           0`);
  console.log(`   9) ImageKit mutations:                                  0`);
  console.log(`  10) application/manifest/shell changes:                  0`);
  console.log("");
  console.log(" Additional stats:");
  console.log(`   Collision groups with BOTH statuses:  ${groupsWithBoth}`);
  console.log(`   Collision groups w/ Supabase object:  ${groupsObjectExists}`);
  console.log("");
  console.log(` A1 status: preserved as ${a1Entry.status} (NOT re-marked)`);
  console.log(" Diagnostic blocks written to ledger:");
  console.log("   · destination_collisions (174-group audit)");
  console.log("   · a1_reconciliation (read-only diagnostic)");
  console.log("   · last_phase_3d_r_fix_report (this run summary)");
  console.log("═══════════════════════════════════════════════════════════");
})();
