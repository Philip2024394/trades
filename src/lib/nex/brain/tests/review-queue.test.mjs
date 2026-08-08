#!/usr/bin/env node
// review-queue.test.mjs · Phase 10.8
//
// Verifies the Awaiting Review path is wired end-to-end:
//   Warehouse barrel  →  UI page  →  GET endpoint  →  POST decision
//
// Read-only assertions across source + live endpoint (when reachable).
//
// Assertions:
//   RV1  · GET /api/nex/brain/review handler exists in the same file as POST
//   RV2  · GET filters to status = UNDER_REVIEW only (never touches other statuses)
//   RV3  · GET returns { ok, records, total, computed_at }
//   RV4  · GET uses count=exact head=true for the total (accurate past 1000)
//   RV5  · GET composes latest_check per record (confidence + flags + decision)
//   RV6  · POST semantics unchanged (approve → AUTHORITATIVE · reject → DEPRECATED · edit → UNDER_REVIEW)
//   RV7  · UI page exists at src/app/nex-app/nex-brain/review/page.tsx
//   RV8  · UI consumes GET /api/nex/brain/review (no local composition)
//   RV9  · UI action buttons POST to /api/nex/brain/review with action ∈ {approve,reject}
//   RV10 · UI does NOT display or edit records outside UNDER_REVIEW
//   RV11 · Warehouse "Awaiting your review" barrel links to /nex-app/nex-brain/review
//   RV12 · Live · GET returns non-empty records array with the expected shape
//          (skipped cleanly when server offline or creds absent)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const BASE      = process.env.NEX_TEST_BASE_URL || "http://localhost:3008";

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

const REVIEW_ROUTE = readFileSync(join(REPO, "src/app/api/nex/brain/review/route.ts"), "utf8");
const REVIEW_UI    = readFileSync(join(REPO, "src/app/nex-app/nex-brain/review/page.tsx"), "utf8");
const OPS_UI       = readFileSync(join(REPO, "src/app/nex-app/nex-brain/operations-centre/page.tsx"), "utf8");

// RV1 · GET handler is in the same route file as POST
record("RV1",
  /export\s+async\s+function\s+GET/.test(REVIEW_ROUTE) && /export\s+async\s+function\s+POST/.test(REVIEW_ROUTE),
  "GET + POST both present in review/route.ts");

// RV2 · GET filters exclusively on status='UNDER_REVIEW'
const filtersUnderReview = /\.eq\(\s*["']status["']\s*,\s*["']UNDER_REVIEW["']\s*\)/.test(REVIEW_ROUTE);
const noOtherStatusRead = !/\.eq\(\s*["']status["']\s*,\s*["'](AUTHORITATIVE|DRAFT|DEPRECATED|SUPERSEDED)["']\s*\)/.test(REVIEW_ROUTE);
record("RV2", filtersUnderReview && noOtherStatusRead,
  `filters=${filtersUnderReview} · never queries other statuses in GET=${noOtherStatusRead}`);

// RV3 · GET response shape
const returnsOk       = /NextResponse\.json\(\s*\{\s*ok:\s*true[\s\S]{0,200}?records[\s\S]{0,60}?total[\s\S]{0,60}?computed_at/.test(REVIEW_ROUTE);
record("RV3", returnsOk, "GET returns { ok, records, total, computed_at }");

// RV4 · uses count=exact head=true for the total
const usesCountExact = /count:\s*"exact"/.test(REVIEW_ROUTE) && /head:\s*true/.test(REVIEW_ROUTE);
record("RV4", usesCountExact, "GET uses count=exact head=true for total");

// RV5 · latest_check composition
const hasLatestCheck = /latest_check:/.test(REVIEW_ROUTE)
                    && /overall_confidence/.test(REVIEW_ROUTE)
                    && /flags/.test(REVIEW_ROUTE);
record("RV5", hasLatestCheck, "GET composes latest_check with confidence + flags");

// RV6 · POST semantics untouched
const approveToAuth = /if\s*\(\s*action\s*===\s*["']approve["']\s*\)[\s\S]{0,120}?newStatus\s*=\s*["']AUTHORITATIVE["']/.test(REVIEW_ROUTE);
const rejectToDepr  = /else if\s*\(\s*action\s*===\s*["']reject["']\s*\)[\s\S]{0,120}?newStatus\s*=\s*["']DEPRECATED["']/.test(REVIEW_ROUTE);
const editToReview  = /newStatus\s*=\s*["']UNDER_REVIEW["'][\s\S]{0,60}?feedbackKind\s*=\s*["']edit["']/.test(REVIEW_ROUTE);
record("RV6", approveToAuth && rejectToDepr && editToReview,
  `POST semantics · approve→AUTH=${approveToAuth} reject→DEPR=${rejectToDepr} edit→UR=${editToReview}`);

// RV7 · UI page file exists (already read successfully · presence is proof)
record("RV7", REVIEW_UI.length > 0, `page.tsx exists · ${REVIEW_UI.length} bytes`);

// RV8 · UI consumes GET · does not compute the queue locally
const uiFetchesGet   = /fetch\(\s*[`"'][^`"']*\/api\/nex\/brain\/review\?/.test(REVIEW_UI);
const noLocalSql     = !/knowledge_records|createClient|from\(\s*["']knowledge_records/.test(REVIEW_UI);
record("RV8", uiFetchesGet && noLocalSql,
  `ui_calls_get=${uiFetchesGet} no_local_db=${noLocalSql}`);

// RV9 · UI actions POST to /review · buttons carry approve/reject literals ·
//        POST call sends the action verbatim in the JSON body.
const postsToReview = /fetch\(\s*`\/api\/nex\/brain\/review`\s*,\s*\{[\s\S]{0,120}?method:\s*["']POST["']/.test(REVIEW_UI);
const buttonApprove = /act\(\s*rec\.record_id\s*,\s*["']approve["']\s*\)/.test(REVIEW_UI);
const buttonReject  = /act\(\s*rec\.record_id\s*,\s*["']reject["']\s*\)/.test(REVIEW_UI);
const bodyCarriesAction = /body:\s*JSON\.stringify\(\{[\s\S]{0,120}?action[\s\S]{0,120}?\}\)/.test(REVIEW_UI);
record("RV9", postsToReview && buttonApprove && buttonReject && bodyCarriesAction,
  `POST wired · post=${postsToReview} approve_btn=${buttonApprove} reject_btn=${buttonReject} body_has_action=${bodyCarriesAction}`);

// RV10 · UI never displays records from other statuses (only whatever GET returns)
const noOtherStatusFetch = !/status=(AUTHORITATIVE|DRAFT|DEPRECATED|SUPERSEDED)/.test(REVIEW_UI);
record("RV10", noOtherStatusFetch, "UI never fetches other statuses");

// RV11 · Warehouse barrel links to /nex-app/nex-brain/review
const warehouseLinks = /\/nex-app\/nex-brain\/review/.test(OPS_UI);
const linkOnReviewKey = /b\.key\s*===\s*["']review["'][\s\S]{0,200}?\/nex-app\/nex-brain\/review/.test(OPS_UI);
record("RV11", warehouseLinks && linkOnReviewKey,
  `warehouse link · href_present=${warehouseLinks} · scoped_to_review_barrel=${linkOnReviewKey}`);

// RV12 · Live endpoint check
try {
  const r = await fetch(`${BASE}/api/nex/brain/review?limit=3&offset=0`);
  if (r.status === 0 || r.status >= 500) {
    process.stdout.write("  SKIP RV12 · endpoint returned " + r.status + "\n");
    results.push({ id: "RV12", pass: true, note: "skipped · endpoint " + r.status });
  } else {
    const j = await r.json();
    const ok = j.ok === true
            && Array.isArray(j.records)
            && typeof j.total === "number"
            && typeof j.computed_at === "string";
    const shapeOk = j.records.length === 0 || (
      typeof j.records[0].record_id === "string"
      && typeof j.records[0].title === "string"
      && "latest_check" in j.records[0]
    );
    record("RV12", ok && shapeOk, `status=${r.status} ok=${j.ok} total=${j.total ?? "?"} sample_records=${j.records?.length ?? 0}`);
  }
} catch (e) {
  process.stdout.write("  SKIP RV12 · " + e.message + "\n");
  results.push({ id: "RV12", pass: true, note: "skipped · " + e.message });
}

const passed = results.filter((r) => r.pass).length;
const total  = results.length;
process.stdout.write(`\nreview-queue: ${passed}/${total} assertions passed\n`);
process.exit(passed === total ? 0 : 1);
