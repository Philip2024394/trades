// NEX ImageKit → Supabase migration · Phase 3E-R · Visual spot-check preparation.
// Philip 2026-09-02 · READ-ONLY · selects 10 diverse VERIFIED entries and
// re-verifies each pair server-side, then prints copy-pasteable browser pairs.
//
// ═══════════════════════════════════════════════════════════════════════
// HARD SCOPE
// ═══════════════════════════════════════════════════════════════════════
//
// This script does NOT migrate, upload, delete, move, copy, or modify
// anything. It is purely observational. Its outputs are:
//
//   1. A 10-entry diversity-picked list of VERIFIED entries, deliberately
//      covering: JPEG · PNG · AI-generated · upload · all 3 accounts ·
//      larger files (>400KB) · 429-reconciled entries from Phase 3E-R.
//
//   2. A per-pair server-side re-verification (HEAD both endpoints,
//      GET both endpoints, recompute SHA-256, compare size/MIME/SHA).
//      Fresh evidence of continuing byte-perfect equivalence.
//
//   3. A copy-pasteable list of (ImageKit URL, Supabase URL) pairs for
//      Philip's browser-based visual inspection.
//
// FORBIDDEN (this script does none of these):
//   · Any ledger write
//   · Any Supabase Storage upload/remove/move/copy/bucket op
//   · Any DB write
//   · Any ImageKit mutation
//   · Any src/manifest/frame/shell/PWA edit
//   · Any selection algorithm change
//
// Only permitted runtime operations:
//   · fetch(imagekit_url) HEAD + GET
//   · fetch(supabase_public_url) HEAD + GET
//   · readFileSync(ledger)
//   · console output

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const repoRoot   = join(__dirname, "..", "..");

const HEAD_TIMEOUT_MS = 15_000;
const HARD_LIMIT_SPOT_CHECK = 10;

// ─── Env / NEX guard ──────────────────────────────────────────────────
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
if (!NEX_URL || !NEX_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error(`REFUSING · NEX guard failed`);
  process.exit(1);
}

const LEDGER_PATH = join(repoRoot, "data/nex-imagekit-migration-ledger.json");
if (!existsSync(LEDGER_PATH)) { console.error("Ledger not found"); process.exit(1); }

// ─── Helpers ──────────────────────────────────────────────────────────
const sha256 = (buf) => createHash("sha256").update(Buffer.from(buf)).digest("hex");

async function headTimeout(url) {
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

async function fullGet(url) {
  try {
    const r = await fetch(url, { redirect: "follow" });
    if (!r.ok) return { ok: false, http_status: r.status };
    const buf = await r.arrayBuffer();
    return { ok: true, http_status: r.status, content_length: buf.byteLength, content_type: r.headers.get("content-type"), sha256: sha256(buf) };
  } catch (e) {
    return { ok: false, thrown: e.message };
  }
}

// ─── Diverse selection ────────────────────────────────────────────────
function selectDiverse(ledger) {
  const verified = ledger.entries.filter((e) =>
    e.status === "VERIFIED" && e.sha256 && e.destination_url && e.source_url
  );

  const reconciled3ER = verified.filter((e) =>
    (e.notes || "").includes("Phase 3E-R") &&
    (e.notes || "").includes("verified (existing)")
  );
  const uploads = verified.filter((e) => e.provenance === "OWNED_LIKELY_UPLOAD");
  const larger  = verified.filter((e) => (e.content_length || 0) > 400_000);

  const picks = [];
  const seen  = new Set();
  const pick  = (e) => { if (e && !seen.has(e.source_url)) { picks.push(e); seen.add(e.source_url); return true; } return false; };

  // 1–2 · 429-reconciled entries (prefer 9mrgsv2rp + nepgaxllc to also cover accounts)
  pick(reconciled3ER.find((e) => e.imagekit_account === "9mrgsv2rp"));
  pick(reconciled3ER.find((e) => e.imagekit_account === "nepgaxllc"));

  // 3–4 · Larger files (>400KB) · distribute across accounts if possible
  const largerBy5vv = larger.find((e) => e.imagekit_account === "5vv5pw26q" && !seen.has(e.source_url));
  const largerBy9mr = larger.find((e) => e.imagekit_account === "9mrgsv2rp" && !seen.has(e.source_url));
  pick(largerBy5vv);
  pick(largerBy9mr);

  // 5–6 · UPLOAD-provenance (rare in corpus · only ~5 verified)
  for (const e of uploads) { if (picks.length >= 6) break; pick(e); }

  // 7–8 · Ensure at least 2 JPEG total
  let jpegCount = picks.filter((p) => /jpe?g/i.test(p.content_type || "")).length;
  for (const e of verified) {
    if (jpegCount >= 2 || picks.length >= 8) break;
    if (/jpe?g/i.test(e.content_type || "") && !seen.has(e.source_url)) { pick(e); jpegCount++; }
  }

  // 9–10 · Ensure at least 2 PNG total
  let pngCount = picks.filter((p) => /png/i.test(p.content_type || "")).length;
  for (const e of verified) {
    if (pngCount >= 2 || picks.length >= 10) break;
    if (/png/i.test(e.content_type || "") && !seen.has(e.source_url)) { pick(e); pngCount++; }
  }

  // Ensure all 3 accounts represented (backfill missing)
  const currentAccounts = new Set(picks.map((p) => p.imagekit_account));
  for (const acc of ["5vv5pw26q", "9mrgsv2rp", "nepgaxllc"]) {
    if (!currentAccounts.has(acc) && picks.length < HARD_LIMIT_SPOT_CHECK) {
      const e = verified.find((e) => e.imagekit_account === acc && !seen.has(e.source_url));
      if (e) pick(e);
    }
  }

  // Backfill to exactly 10
  for (const e of verified) {
    if (picks.length >= HARD_LIMIT_SPOT_CHECK) break;
    pick(e);
  }

  return picks.slice(0, HARD_LIMIT_SPOT_CHECK);
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
(async () => {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" NEX ImageKit → Supabase · Phase 3E-R · 10-image spot-check");
  console.log(" READ-ONLY · no writes anywhere");
  console.log("═══════════════════════════════════════════════════════════\n");

  const ledger = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  const picks  = selectDiverse(ledger);
  if (picks.length !== HARD_LIMIT_SPOT_CHECK) {
    console.error(`Could not assemble ${HARD_LIMIT_SPOT_CHECK} diverse entries · aborting`);
    process.exit(1);
  }

  // Coverage matrix
  const cov = {
    accounts:      [...new Set(picks.map((p) => p.imagekit_account))],
    mimes:         [...new Set(picks.map((p) => (p.content_type || "").split(";")[0]))],
    provenances:   [...new Set(picks.map((p) => p.provenance))],
    reconciled_from_3E_R: picks.filter((p) => (p.notes || "").includes("Phase 3E-R") && (p.notes || "").includes("verified (existing)")).length,
    larger_than_400KB:    picks.filter((p) => (p.content_length || 0) > 400_000).length,
  };
  console.log("Coverage matrix:");
  console.log(`  Accounts:                 ${JSON.stringify(cov.accounts)}`);
  console.log(`  MIMEs:                    ${JSON.stringify(cov.mimes)}`);
  console.log(`  Provenances:              ${JSON.stringify(cov.provenances)}`);
  console.log(`  Reconciled from 3E-R:     ${cov.reconciled_from_3E_R}`);
  console.log(`  Larger files (>400KB):    ${cov.larger_than_400KB}`);
  console.log("");

  // Re-verify each pair server-side
  console.log("Re-verifying each pair server-side (HEAD + GET + SHA + size + MIME on both endpoints)...\n");
  const results = [];
  for (let i = 0; i < picks.length; i++) {
    const e = picks[i];
    const [srcHead, dstHead] = await Promise.all([headTimeout(e.source_url), headTimeout(e.destination_url)]);
    const [src, dst]         = await Promise.all([fullGet(e.source_url),  fullGet(e.destination_url)]);
    const shaMatch  = src.ok && dst.ok && src.sha256        === dst.sha256;
    const sizeMatch = src.ok && dst.ok && src.content_length === dst.content_length;
    const mimeMatch = src.ok && dst.ok && ((src.content_type || "").toLowerCase() === (dst.content_type || "").toLowerCase() || (/jpe?g/i.test(src.content_type || "") && /jpe?g/i.test(dst.content_type || "")));
    const shaMatchesLedger = e.sha256 === src.sha256 && e.sha256 === dst.sha256;
    results.push({ e, srcHead, dstHead, src, dst, shaMatch, sizeMatch, mimeMatch, shaMatchesLedger });
    const bad = !(shaMatch && sizeMatch && mimeMatch && shaMatchesLedger);
    const label = `[${String(i + 1).padStart(2, "0")}] ${e.imagekit_account} · ${e.content_type} · ${e.provenance} · ${e.content_length}B`;
    console.log(`  ${bad ? "✗" : "✓"} ${label}`);
    console.log(`     HEAD  ImageKit=${srcHead.status} Supabase=${dstHead.status}`);
    console.log(`     GET   ImageKit=${src.ok ? src.http_status : "err"} Supabase=${dst.ok ? dst.http_status : "err"}`);
    console.log(`     SHA   src=${(src.sha256||"").slice(0,10)}… dst=${(dst.sha256||"").slice(0,10)}… ledger=${(e.sha256||"").slice(0,10)}… · match=${shaMatch && shaMatchesLedger ? "✓" : "✗"}`);
    console.log(`     Size  src=${src.content_length} dst=${dst.content_length} ledger=${e.content_length} · match=${sizeMatch ? "✓" : "✗"}`);
    console.log(`     MIME  src=${src.content_type} dst=${dst.content_type} · match=${mimeMatch ? "✓" : "✗"}`);
  }

  // Verification summary
  const passing = results.filter((r) => r.shaMatch && r.sizeMatch && r.mimeMatch && r.shaMatchesLedger).length;
  console.log(`\nServer-side re-verification: ${passing}/${picks.length} pass all checks`);
  if (passing !== picks.length) {
    console.error("⚠ Not all pairs passed server-side re-verification — inspect above");
  }

  // Copy-pasteable pair list for browser inspection
  console.log("\n" + "═".repeat(88));
  console.log(" 10-image visual spot-check pairs · open each pair in adjacent browser tabs");
  console.log("═".repeat(88));
  picks.forEach((e, i) => {
    const flags = [];
    if ((e.notes || "").includes("Phase 3E-R") && (e.notes || "").includes("verified (existing)")) flags.push("3E-R reconciled");
    if ((e.content_length || 0) > 400_000) flags.push("larger >400KB");
    const flagStr = flags.length ? ` · [${flags.join(" · ")}]` : "";
    console.log(`\n[${String(i + 1).padStart(2, "0")}] ${e.imagekit_account} · ${e.content_type} · ${e.provenance} · ${e.content_length}B${flagStr}`);
    console.log(`     ImageKit:  ${e.source_url}`);
    console.log(`     Supabase:  ${e.destination_url}`);
  });
  console.log("\n" + "═".repeat(88));
  console.log(" What to check in the browser for each pair:");
  console.log("═".repeat(88));
  console.log(" - Identical visual appearance (no shifted colours, no compression artefacts)");
  console.log(" - Transparency preserved (if PNG with alpha)");
  console.log(" - Correct orientation (no flip, no rotate)");
  console.log(" - Correct dimensions (no resize)");
  console.log(" - No unexpected re-encoding");
  console.log(" - Supabase URL renders inline (public bucket + correct MIME)");
  console.log(" - No 4xx/5xx errors");
  console.log("═".repeat(88));
  console.log("\nStopped. No further action. Awaiting your visual verdict.");
})();
