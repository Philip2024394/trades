// NEX ImageKit → Supabase migration · Phase 3D-R · Resumability Proof
// Philip 2026-09-02 · authorised · MAX 5 IMAGES (2 Test A + 3 Test B)
//
// ═══════════════════════════════════════════════════════════════════════
// HARD SCOPE
// ═══════════════════════════════════════════════════════════════════════
//
// Proves two resumability properties before Phase 3E scales to 100+:
//
//   TEST A · Post-completion idempotency
//     · 2 fresh entries · migrate them once (Run 1)
//     · rerun the SAME 2 URLs (Run 2) · expect all to SKIP
//     · Run 2 must make ZERO HEAD / GET / upload / retrieve calls for these
//     · Supabase must contain exactly one object per destination_path
//
//   TEST B · Mid-flight interruption recovery
//     · 3 fresh entries · child process migrates URLs in order,
//       cleanly process.exit(0)s after the 2nd VERIFIED
//     · Ledger state after child: exactly 2 VERIFIED + 1 PENDING
//     · Orchestrator (main process) resumes with same 3 URLs
//     · Expect: 2 SKIP (zero calls) + 1 fresh migrate → VERIFIED
//     · Supabase must contain exactly one object per destination_path
//
// MAX corpus movement: exactly 5 new VERIFIED (60 → maximum 65).
// Existing 60 VERIFIED are NEVER modified, deleted, overwritten, re-uploaded.
//
// SAFETY:
//   · upsert:false everywhere · no silent overwrite possible
//   · ImageKit HEAD/GET only · no POST/PUT/PATCH/DELETE
//   · No DB writes · no manifests · no source · no frame/shell
//   · No bucket / policy / config changes
//   · No dedup / cleanup / additional migration
//   · Ledger conservation asserted (2,147 entries preserved)

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const repoRoot   = join(__dirname, "..", "..");

// ═══ HARD LIMITS (constants · not overridable) ═══════════════════
const HARD_LIMIT_TOTAL              = 5;
const HARD_LIMIT_TEST_A             = 2;
const HARD_LIMIT_TEST_B             = 3;
const HARD_LIMIT_TEST_B_KILL_AFTER  = 2;
const BUCKET                        = "nex-media";
const HEAD_TIMEOUT_MS               = 15_000;
const ALLOWED_PROVENANCE            = new Set(["OWNED_LIKELY_AI_GENERATED", "OWNED_LIKELY_UPLOAD"]);
const ALLOWED_ACCOUNTS              = new Set(["5vv5pw26q", "9mrgsv2rp", "nepgaxllc"]);

// ═══ Env / NEX-only project guard ════════════════════════════════
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

const sb = createClient(NEX_URL, NEX_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const LEDGER_PATH = join(repoRoot, "data/nex-imagekit-migration-ledger.json");
if (!existsSync(LEDGER_PATH)) { console.error("Ledger not found"); process.exit(1); }

// ═══ Helpers (identical to 3D pipeline) ═══════════════════════════
const sha256 = (buf) => createHash("sha256").update(Buffer.from(buf)).digest("hex");

async function headWithTimeout(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HEAD_TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal });
    clearTimeout(t);
    return { status: r.status, mime: r.headers.get("content-type"), len: Number(r.headers.get("content-length")) || null };
  } catch (e) {
    clearTimeout(t);
    return { status: 0, error: e.message };
  }
}

// ═══ Per-image pipeline (returns skip if ledger says VERIFIED) ══
// Instruments call counters so Test A Run 2 skips can be proved
// as truly zero-work (no HEAD, no GET, no upload, no retrieve).
async function processOne(entry, calls) {
  // 1 · Resumability check (fresh ledger read)
  const currentLedger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const currentEntry  = currentLedger.entries.find((e) => e.source_url === entry.source_url);
  if (currentEntry?.status === "VERIFIED") {
    return {
      entry, ok: true, skipped: "already_verified",
      ledger_sha256:  currentEntry.sha256,
      ledger_dest:    currentEntry.destination_url,
      ledger_size:    currentEntry.content_length,
    };
  }

  // 2 · HEAD
  calls.head++;
  const head = await headWithTimeout(entry.source_url);
  if (!head.status || head.status < 200 || head.status >= 300) {
    return { entry, ok: false, reason: `HEAD non-2xx: ${head.status}` };
  }
  const headMime = head.mime;

  // 3 · GET
  calls.get++;
  let buf;
  try {
    const res = await fetch(entry.source_url, { redirect: "follow" });
    if (!res.ok) return { entry, ok: false, reason: `GET non-2xx: ${res.status}` };
    buf = await res.arrayBuffer();
  } catch (e) {
    return { entry, ok: false, reason: `GET threw: ${e.message}` };
  }
  const srcLen = buf.byteLength;
  const srcSha = sha256(buf);

  // 4 · Upload (upsert:false)
  calls.upload++;
  let uploadOutcome = "uploaded";
  try {
    const { error } = await sb.storage.from(BUCKET).upload(
      entry.destination_path,
      Buffer.from(buf),
      { contentType: headMime, upsert: false, cacheControl: "3600" },
    );
    if (error) {
      if (/already exists|duplicate|resource already/i.test(error.message)) {
        uploadOutcome = "existing";
      } else {
        return { entry, ok: false, reason: `upload: ${error.message}` };
      }
    }
  } catch (e) {
    return { entry, ok: false, reason: `upload threw: ${e.message}` };
  }

  // 5 · Retrieve + verify
  calls.retrieve++;
  const retrieveUrl = `${NEX_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(entry.destination_path)}`;
  let retLen, retSha, retMime;
  try {
    const r = await fetch(retrieveUrl);
    if (!r.ok) return { entry, ok: false, reason: `retrieve ${r.status}` };
    const retBuf = await r.arrayBuffer();
    retLen  = retBuf.byteLength;
    retSha  = sha256(retBuf);
    retMime = r.headers.get("content-type");
  } catch (e) {
    return { entry, ok: false, reason: `retrieve threw: ${e.message}` };
  }

  const shaOk  = srcSha === retSha;
  const sizeOk = srcLen === retLen;
  const mimeOk = (headMime || "").toLowerCase() === (retMime || "").toLowerCase()
              || (/jpe?g/i.test(headMime || "") && /jpe?g/i.test(retMime || ""));
  const verified = shaOk && sizeOk && mimeOk;

  return {
    entry, ok: verified, uploadOutcome,
    headMime, srcLen, srcSha, retLen, retSha, retMime, retrieveUrl,
  };
}

// ═══ Persist VERIFIED (synchronous write · ledger conservation asserted) ═══
function persistVerified(result, phase) {
  const currentLedger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const totalBefore   = currentLedger.entries.length;
  const idx = currentLedger.entries.findIndex((e) => e.source_url === result.entry.source_url);
  if (idx === -1) throw new Error(`entry not found for persist: ${result.entry.source_url}`);
  const e = currentLedger.entries[idx];
  e.http_status     = 200;
  if (result.headMime) e.content_type   = result.headMime;
  if (result.srcLen)   e.content_length = result.srcLen;
  if (result.srcSha)   e.sha256         = result.srcSha;
  if (result.retrieveUrl) e.destination_url = result.retrieveUrl;
  e.status = "VERIFIED";
  const prior = e.notes ? e.notes + " | " : "";
  e.notes = `${prior}Phase 3D-R ${phase} ${new Date().toISOString()}: verified (${result.uploadOutcome})`;
  if (currentLedger.entries.length !== totalBefore) {
    throw new Error(`LEDGER CONSERVATION FAILURE during persist`);
  }
  writeFileSync(LEDGER_PATH, JSON.stringify(currentLedger, null, 2));
}

// ═══ MODE · WORKER (Test B Run 1 · child process) ═══════════════
async function runWorkerMode() {
  const killAfter = parseInt(process.argv[3], 10);
  const urls      = process.argv.slice(4);
  console.log(`[worker] Test B Run 1 · ${urls.length} URLs · kill-after-n=${killAfter}`);
  const ledger  = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const entries = urls.map((u) => ledger.entries.find((e) => e.source_url === u));
  if (entries.some((e) => !e)) { console.error("[worker] some URLs missing"); process.exit(2); }
  let successCount = 0;
  for (const entry of entries) {
    const calls = { head: 0, get: 0, upload: 0, retrieve: 0 };
    const r = await processOne(entry, calls);
    if (r.skipped) {
      console.log(`[worker] SKIP ${entry.source_url.slice(-50)}`);
      continue;
    }
    if (r.ok) {
      persistVerified(r, "test-b-run-1");
      successCount++;
      console.log(`[worker] ✓ VERIFIED #${successCount} · ${entry.source_url.slice(-50)} · sha=${r.srcSha.slice(0,10)}…`);
      if (successCount >= killAfter) {
        console.log(`[worker] SIMULATED CRASH · process.exit(0) after ${successCount} VERIFIED (leaving remainder PENDING)`);
        process.exit(0);
      }
    } else {
      console.error(`[worker] ✗ FAIL · ${r.reason}`);
      process.exit(3);
    }
  }
  process.exit(0);
}

// ═══ MODE · ORCHESTRATOR ═════════════════════════════════════════
async function runOrchestrator() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" NEX ImageKit → Supabase · Phase 3D-R · Resumability Proof");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(` Target:  ${NEX_URL}`);
  console.log(` Bucket:  ${BUCKET}`);
  console.log(` Hard cap: ${HARD_LIMIT_TOTAL} images total (${HARD_LIMIT_TEST_A} Test A + ${HARD_LIMIT_TEST_B} Test B)\n`);

  const started = new Date();

  // ─── Load ledger + select 5 fresh candidates ────────────────
  const ledger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const totalEntriesAtStart = ledger.entries.length;

  const eligible = ledger.entries.filter((e) =>
    e.status === "PENDING" &&
    ALLOWED_PROVENANCE.has(e.provenance) &&
    ALLOWED_ACCOUNTS.has(e.imagekit_account) &&
    e.validation_state === "REACHABLE" &&
    e.source_url?.startsWith("https://ik.imagekit.io/") &&
    e.destination_path
  );
  eligible.sort((a, b) => a.source_url.localeCompare(b.source_url));

  const selected = eligible.slice(0, HARD_LIMIT_TOTAL);
  if (selected.length < HARD_LIMIT_TOTAL) {
    console.error(`Not enough eligible candidates · need ${HARD_LIMIT_TOTAL} · found ${selected.length}`);
    process.exit(1);
  }
  const testA = selected.slice(0, HARD_LIMIT_TEST_A);
  const testB = selected.slice(HARD_LIMIT_TEST_A, HARD_LIMIT_TEST_A + HARD_LIMIT_TEST_B);

  console.log(`Selected 5 fresh candidates (deterministic sort by source_url):`);
  console.log(`  Test A (idempotency):`);
  testA.forEach((e, i) => console.log(`    A${i + 1}: ${e.imagekit_account} · ${e.source_url}`));
  console.log(`  Test B (interruption):`);
  testB.forEach((e, i) => console.log(`    B${i + 1}: ${e.imagekit_account} · ${e.source_url}`));

  // ─── Pre-flight: none of the 5 destination_paths exist in Supabase ───
  console.log(`\nPre-flight: verifying none of the 5 destination_paths currently exist in Supabase...`);
  const preflight = [];
  for (const e of selected) {
    const url = `${NEX_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(e.destination_path)}`;
    const r = await fetch(url, { method: "HEAD" });
    preflight.push({ path: e.destination_path, http_status: r.status });
    if (r.status === 200) {
      console.error(`PRE-FLIGHT FAIL · destination already exists: ${e.destination_path}`);
      process.exit(1);
    }
  }
  console.log(`  ✓ All 5 destination_paths absent (all HTTP ${preflight[0].http_status})`);

  // ═══ TEST A · Post-completion idempotency ══════════════════
  console.log(`\n─── TEST A · Post-completion idempotency ─────────────────`);
  const aRun1 = [];
  const aRun2 = [];

  console.log(`Test A Run 1 · fresh migrate ${testA.length} entries...`);
  for (const entry of testA) {
    const calls = { head: 0, get: 0, upload: 0, retrieve: 0 };
    const r = await processOne(entry, calls);
    if (r.ok && !r.skipped) persistVerified(r, "test-a-run-1");
    console.log(`  A · ${r.skipped ? "SKIP" : (r.ok ? "✓ VERIFIED" : "✗ FAIL")} · ${entry.source_url.slice(-50)} · HEAD=${calls.head} GET=${calls.get} UPLOAD=${calls.upload} RETRIEVE=${calls.retrieve}`);
    aRun1.push({ url: entry.source_url, ok: r.ok, skipped: !!r.skipped, sha256: r.srcSha, calls: { ...calls } });
  }

  console.log(`\nTest A Run 2 · rerun same ${testA.length} URLs (expect all SKIP · zero calls)...`);
  for (const entry of testA) {
    const calls = { head: 0, get: 0, upload: 0, retrieve: 0 };
    const r = await processOne(entry, calls);
    console.log(`  A · ${r.skipped ? "SKIP" : (r.ok ? "✓" : "✗")} · ${entry.source_url.slice(-50)} · HEAD=${calls.head} GET=${calls.get} UPLOAD=${calls.upload} RETRIEVE=${calls.retrieve}`);
    aRun2.push({ url: entry.source_url, ok: r.ok, skipped: !!r.skipped, ledger_sha256: r.ledger_sha256, ledger_dest: r.ledger_dest, calls: { ...calls } });
  }

  console.log(`\nTest A · Supabase object presence check...`);
  const aObjects = [];
  for (const entry of testA) {
    const url = `${NEX_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(entry.destination_path)}`;
    const r = await fetch(url, { method: "HEAD" });
    aObjects.push({ path: entry.destination_path, http_status: r.status, content_length: r.headers.get("content-length"), content_type: r.headers.get("content-type") });
    console.log(`  ${r.status === 200 ? "✓" : "✗"} ${entry.destination_path} · HTTP ${r.status} · ${r.headers.get("content-length")} B · ${r.headers.get("content-type")}`);
  }

  // ═══ TEST B · Mid-flight interruption recovery ════════════
  console.log(`\n─── TEST B · Mid-flight interruption recovery ───────────`);
  console.log(`Test B Run 1 · spawning child process (real process boundary) with kill-after-n=${HARD_LIMIT_TEST_B_KILL_AFTER}...\n`);

  const childArgs = [
    __filename,
    "--worker-test-b",
    String(HARD_LIMIT_TEST_B_KILL_AFTER),
    ...testB.map((e) => e.source_url),
  ];
  const spawn = spawnSync(process.execPath, childArgs, { stdio: "inherit" });
  console.log(`\nChild exited with code: ${spawn.status}`);

  // Verify ledger state after the child died
  const ledgerAfterInterrupt = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const bStatesAfterInterrupt = testB.map((e) => {
    const cur = ledgerAfterInterrupt.entries.find((x) => x.source_url === e.source_url);
    return { url: e.source_url, status: cur.status, sha256: cur.sha256 || null };
  });
  console.log(`\nLedger state after Test B Run 1 (child exit):`);
  bStatesAfterInterrupt.forEach((s, i) => console.log(`  B${i + 1}: ${s.status.padEnd(10)} · sha=${(s.sha256 || "").slice(0, 10)}…`));
  const bVerifiedAfterInt = bStatesAfterInterrupt.filter((s) => s.status === "VERIFIED").length;
  const bPendingAfterInt  = bStatesAfterInterrupt.filter((s) => s.status === "PENDING").length;
  const interruptOk = bVerifiedAfterInt === 2 && bPendingAfterInt === 1;
  console.log(`  Assertion (exactly 2 VERIFIED + 1 PENDING): ${interruptOk ? "✓" : "✗"}`);

  console.log(`\nTest B Run 2 · resume same 3 URLs (expect 2 SKIP with zero calls · 1 fresh migrate)...`);
  const bRun2 = [];
  for (const entry of testB) {
    const calls = { head: 0, get: 0, upload: 0, retrieve: 0 };
    const r = await processOne(entry, calls);
    if (r.ok && !r.skipped) persistVerified(r, "test-b-run-2");
    console.log(`  B · ${r.skipped ? "SKIP" : (r.ok ? "✓ VERIFIED" : "✗ FAIL")} · ${entry.source_url.slice(-50)} · HEAD=${calls.head} GET=${calls.get} UPLOAD=${calls.upload} RETRIEVE=${calls.retrieve}`);
    bRun2.push({ url: entry.source_url, ok: r.ok, skipped: !!r.skipped, sha256: r.srcSha, ledger_sha256: r.ledger_sha256, calls: { ...calls } });
  }

  console.log(`\nTest B · Supabase object presence check...`);
  const bObjects = [];
  for (const entry of testB) {
    const url = `${NEX_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(entry.destination_path)}`;
    const r = await fetch(url, { method: "HEAD" });
    bObjects.push({ path: entry.destination_path, http_status: r.status, content_length: r.headers.get("content-length"), content_type: r.headers.get("content-type") });
    console.log(`  ${r.status === 200 ? "✓" : "✗"} ${entry.destination_path} · HTTP ${r.status} · ${r.headers.get("content-length")} B`);
  }

  // ─── Ledger conservation + final report ────────────────────
  const ledgerFinal = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const totalEntriesAtEnd = ledgerFinal.entries.length;
  const conservationOk    = totalEntriesAtStart === totalEntriesAtEnd;

  const postCounts = { PENDING: 0, VERIFIED: 0, PROVENANCE_REVIEW_REQUIRED: 0, BROKEN: 0, MIGRATION_BLOCKED_MAIN: 0, FAILED: 0 };
  for (const e of ledgerFinal.entries) postCounts[e.status] = (postCounts[e.status] || 0) + 1;

  const assertions = {
    test_a: {
      run1_all_verified:        aRun1.every((x) => x.ok && !x.skipped),
      run2_all_skipped:         aRun2.every((x) => x.skipped),
      run2_zero_network_calls:  aRun2.every((x) => x.calls.head === 0 && x.calls.get === 0 && x.calls.upload === 0 && x.calls.retrieve === 0),
      objects_present:          aObjects.every((x) => x.http_status === 200),
    },
    test_b: {
      run1_child_exit_zero:     spawn.status === 0,
      run1_left_2_verified_1_pending: interruptOk,
      run2_two_skipped:         bRun2.filter((x) => x.skipped).length === 2,
      run2_one_migrated:        bRun2.filter((x) => x.ok && !x.skipped).length === 1,
      run2_zero_calls_on_skipped: bRun2.every((x) => x.skipped ? (x.calls.head === 0 && x.calls.get === 0 && x.calls.upload === 0 && x.calls.retrieve === 0) : true),
      objects_present:          bObjects.every((x) => x.http_status === 200),
    },
    ledger_conservation: conservationOk,
    max_5_verified_moved: (postCounts.VERIFIED - 60) <= 5 && (postCounts.VERIFIED - 60) >= 0,
  };

  const finished = new Date();
  ledgerFinal.last_phase_3d_r_proof = {
    ran_at:               finished.toISOString(),
    started_at:           started.toISOString(),
    hard_caps:            { total: HARD_LIMIT_TOTAL, test_a: HARD_LIMIT_TEST_A, test_b: HARD_LIMIT_TEST_B, kill_after: HARD_LIMIT_TEST_B_KILL_AFTER },
    test_a:               { selected: testA.map((e) => e.source_url), run1: aRun1, run2: aRun2, supabase_objects: aObjects },
    test_b:               { selected: testB.map((e) => e.source_url), run1_child_exit_code: spawn.status, states_after_interrupt: bStatesAfterInterrupt, run2: bRun2, supabase_objects: bObjects },
    assertions,
    conservation:         { entries_before: totalEntriesAtStart, entries_after: totalEntriesAtEnd },
    post_counts:          postCounts,
  };

  if (!conservationOk) {
    console.error(`LEDGER CONSERVATION FAILURE · before ${totalEntriesAtStart} · after ${totalEntriesAtEnd}`);
    process.exit(1);
  }
  writeFileSync(LEDGER_PATH, JSON.stringify(ledgerFinal, null, 2));

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(" Phase 3D-R complete");
  console.log(`   Test A · Run 1 all VERIFIED:   ${assertions.test_a.run1_all_verified ? "✓" : "✗"}`);
  console.log(`   Test A · Run 2 all SKIPPED:    ${assertions.test_a.run2_all_skipped ? "✓" : "✗"}`);
  console.log(`   Test A · Run 2 zero calls:     ${assertions.test_a.run2_zero_network_calls ? "✓" : "✗"}`);
  console.log(`   Test A · Supabase objects OK:  ${assertions.test_a.objects_present ? "✓" : "✗"}`);
  console.log(`   Test B · Child exit=0:         ${assertions.test_b.run1_child_exit_zero ? "✓" : "✗"}`);
  console.log(`   Test B · Interrupt 2V+1P:      ${assertions.test_b.run1_left_2_verified_1_pending ? "✓" : "✗"}`);
  console.log(`   Test B · Run 2 two SKIP:       ${assertions.test_b.run2_two_skipped ? "✓" : "✗"}`);
  console.log(`   Test B · Run 2 one migrated:   ${assertions.test_b.run2_one_migrated ? "✓" : "✗"}`);
  console.log(`   Test B · Zero calls on SKIP:   ${assertions.test_b.run2_zero_calls_on_skipped ? "✓" : "✗"}`);
  console.log(`   Test B · Supabase objects OK:  ${assertions.test_b.objects_present ? "✓" : "✗"}`);
  console.log(`   Ledger conservation:           ${assertions.ledger_conservation ? "✓" : "✗"} (${totalEntriesAtStart}/${totalEntriesAtEnd})`);
  console.log(`   Movement ≤ 5:                  ${assertions.max_5_verified_moved ? "✓" : "✗"} (VERIFIED: 60 → ${postCounts.VERIFIED})`);
  console.log("");
  console.log(" Full-ledger status after 3D-R:");
  for (const [k, v] of Object.entries(postCounts)) if (v > 0) console.log(`   ${k}: ${v}`);
  console.log("═══════════════════════════════════════════════════════════");
}

// ═══ ENTRY ═══════════════════════════════════════════════════════
if (process.argv[2] === "--worker-test-b") {
  await runWorkerMode();
} else {
  await runOrchestrator();
}
