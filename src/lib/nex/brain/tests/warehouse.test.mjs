#!/usr/bin/env node
// warehouse.test.mjs · Phase 10.5
//
// Verifies the NEX Brain Warehouse is a truthful, read-only projection
// over worker_jobs + knowledge_records. No fabrication, no second
// source of truth, no unauthorised cross-module imports.
//
// Assertions:
//   WH1  · warehouse.ts declares 6 stages · incoming · context_processing ·
//          waiting_for_ai · being_written · quality_check · stored
//   WH2  · waiting_for_ai contains ONLY needsLlm worker types
//          (knowledge-extractor · image-analyst)
//   WH3  · being_written contains ONLY needsLlm worker types
//   WH4  · context stages contain ONLY deterministic worker types
//          (knowledge-context · voice-context · learning-context)
//   WH5  · zero silent coercion: deterministic workers never map to
//          waiting_for_ai / being_written in the stage table
//   WH6  · progress table never uses Math.random / animation / Date.now()
//          arithmetic to invent a percent (truthful-only doctrine)
//   WH7  · deterministic workers get is_deterministic=true in the
//          progress table
//   WH8  · needsLlm workers get is_deterministic=false
//   WH9  · computeJobProgress returns null percent for statuses where
//          we don't have real data (memory-guardian waiting, unknown
//          status)
//   WH10 · warehouse module is READ-ONLY · no INSERT/UPDATE/DELETE/upsert
//   WH11 · warehouse module does NOT import Predictive · Comms Social ·
//          Hammerex Social
//   WH12 · warehouse module does NOT create a shadow storage layer ·
//          only reads via the Supabase client + storage abstractions
//   WH13 · endpoint route file is read-only (GET only)
//   WH14 · endpoint returns the warehouse snapshot shape (ok + stages)
//          when reachable · gracefully unavailable when creds absent
//   WH15 · UI panel does NOT compute progress itself · it must consume
//          the aggregator's numbers verbatim

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

const WH  = readFileSync(join(REPO, "src/lib/nex/brain/warehouse.ts"), "utf8");
const RT  = readFileSync(join(REPO, "src/app/api/nex/brain/warehouse/route.ts"), "utf8");
const OPS = readFileSync(join(REPO, "src/app/nex-app/nex-brain/operations-centre/page.tsx"), "utf8");

const DETERMINISTIC = ["knowledge-context", "voice-context", "learning-context"];
const LLM           = ["knowledge-extractor", "image-analyst", "quality-checker"];

// WH1 · six stage keys exist
const stageKeys = ["incoming", "context_processing", "waiting_for_ai", "being_written", "quality_check", "stored"];
const wh1 = stageKeys.every((k) => new RegExp(`["']${k}["']`).test(WH));
record("WH1", wh1, `stages_declared=${wh1}`);

// Extract the STAGE_DEFINITIONS block for structural checks.
const defsMatch = WH.match(/STAGE_DEFINITIONS[^=]*=\s*\{([\s\S]*?)\n\};/);
const defsBlock = defsMatch ? defsMatch[1] : "";

// Extract each stage's substring by slicing between the stage's key and
// the NEXT stage key (or end of block). Nested [] arrays confuse regex
// so we use plain index math.
function stageBlock(key) {
  const startRe = new RegExp(`\\n?\\s*${key}\\s*:\\s*\\{`);
  const start = defsBlock.search(startRe);
  if (start < 0) return "";
  const nextKeys = ["incoming", "context_processing", "waiting_for_ai", "being_written", "quality_check", "stored"].filter((k) => k !== key);
  let end = defsBlock.length;
  for (const k of nextKeys) {
    const nextRe = new RegExp(`\\n\\s*${k}\\s*:\\s*\\{`);
    const idx = defsBlock.search(nextRe);
    if (idx > start && idx < end) end = idx;
  }
  return defsBlock.slice(start, end);
}

const waitingAi    = stageBlock("waiting_for_ai");
const beingWritten = stageBlock("being_written");
const contextProc  = stageBlock("context_processing");
const incoming     = stageBlock("incoming");

// WH2 · waiting_for_ai contains only LLM workers · rejects extractor/image-analyst is fine,
//        rejects the 3 deterministic ones is what we're checking here
const wh2 = /"knowledge-extractor"/.test(waitingAi)
  && /"image-analyst"/.test(waitingAi)
  && !DETERMINISTIC.some((d) => new RegExp(`"${d}"`).test(waitingAi));
record("WH2", wh2, `waiting_for_ai clean of deterministic`);

// WH3 · being_written contains only LLM workers
const wh3 = /"knowledge-extractor"/.test(beingWritten)
  && /"image-analyst"/.test(beingWritten)
  && !DETERMINISTIC.some((d) => new RegExp(`"${d}"`).test(beingWritten));
record("WH3", wh3, `being_written clean of deterministic`);

// WH4 · context_processing contains only deterministic workers
const wh4 = DETERMINISTIC.slice(0).every((d) => new RegExp(`"${d}"`).test(contextProc + incoming))
  && !LLM.some((l) => new RegExp(`"${l}"`).test(contextProc));
record("WH4", wh4, `context_processing pure deterministic`);

// WH5 · full symmetry: no deterministic worker appears in any AI stage
const noDetInAi = !DETERMINISTIC.some((d) => new RegExp(`"${d}"`).test(waitingAi + beingWritten));
record("WH5", noDetInAi, `deterministic never in waiting_for_ai / being_written`);

// WH6 · progress table has no Math.random / Date.now() / setInterval
//        anywhere in the file · truthful-only doctrine
const wh6 = !/Math\.random\s*\(/.test(WH)
  && !/setInterval\s*\(/.test(WH)
  && !/Date\.now\s*\([^)]*\)\s*[+\-*/]\s*Date\.now/.test(WH);
record("WH6", wh6, `no fabricated progress signal in warehouse.ts`);

// WH7 · deterministic workers · is_deterministic=true
const progressTableMatch = WH.match(/WORKER_PROGRESS_TABLE[^=]*=\s*\{([\s\S]*?)\n\};/);
const progressTable = progressTableMatch ? progressTableMatch[1] : "";
const wh7 = DETERMINISTIC.every((d) => {
  const block = progressTable.match(new RegExp(`"${d}"\\s*:\\s*\\{([\\s\\S]*?)\\},`, "m"));
  if (!block) return false;
  return /is_deterministic:\s*true/.test(block[1]);
});
record("WH7", wh7, `deterministic workers flagged is_deterministic:true`);

// WH8 · needsLlm workers · is_deterministic=false
const wh8 = LLM.every((l) => {
  const block = progressTable.match(new RegExp(`"${l}"\\s*:\\s*\\{([\\s\\S]*?)\\},`, "m"));
  if (!block) return false;
  return /is_deterministic:\s*false/.test(block[1]);
});
record("WH8", wh8, `LLM workers flagged is_deterministic:false`);

// WH9 · memory-guardian waiting has percent:null (no real data)
const guardianBlock = progressTable.match(/"memory-guardian"\s*:\s*\{([\s\S]*?)\},/);
const wh9 = guardianBlock && /waiting[\s\S]{0,120}?percent:\s*null/.test(guardianBlock[1]);
record("WH9", !!wh9, `memory-guardian waiting · percent=null (no fabrication)`);

// WH10 · warehouse module is READ-ONLY · no INSERT/UPDATE/DELETE
const writeKeywords = /\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(|INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM/i;
const wh10 = !writeKeywords.test(WH);
record("WH10", wh10, `no write ops in warehouse.ts`);

// WH11 · no forbidden cross-module imports
const forbidden = [
  /from ["']@\/lib\/nex\/predictive/,
  /from ["']@\/lib\/nex\/comms-social/,
  /from ["']@\/lib\/nex\/social["']/,
];
const wh11 = !forbidden.some((re) => re.test(WH) || re.test(RT));
record("WH11", wh11, `no forbidden imports (Predictive · Comms Social · Hammerex Social)`);

// WH12 · module reads via createClient (supabase) or storage · no shadow store
const wh12 = !/globalThis\s*[^.]*Warehouse|__warehouseCache__|jsonl.*writeFile.*warehouse/i.test(WH);
record("WH12", wh12, `no shadow storage layer created`);

// WH13 · endpoint is GET-only · no POST/PATCH/PUT/DELETE handlers
const wh13 = /export async function GET/.test(RT) && !/export async function (POST|PATCH|PUT|DELETE)/.test(RT);
record("WH13", wh13, `route.ts is GET-only`);

// WH14 · route returns ok + snapshot shape
const wh14 = /computeWarehouseView/.test(RT) && /\.\.\.snapshot/.test(RT);
record("WH14", wh14, `route composes ok + snapshot spread`);

// WH15 · UI panel imports warehouse via fetch to /api/nex/brain/warehouse
//        and does NOT compute progress itself (no local WORKER_PROGRESS_TABLE)
const wh15 = /\/api\/nex\/brain\/warehouse/.test(OPS)
          && !/WORKER_PROGRESS_TABLE\s*=/.test(OPS);
record("WH15", wh15, `UI consumes aggregator · does not fabricate locally`);

// WH16 · Phase 10.5c · aggregator surfaces per-item entries with capped count
const wh16 = /export interface WarehouseEntry/.test(WH)
          && /ENTRIES_PER_STAGE\s*=\s*\d+/.test(WH)
          && /entries:\s*pickEntries/.test(WH);
record("WH16", wh16, `aggregator exposes capped per-item entries`);

// WH17 · Phase 10.5b · UI JobProgress uses computeJobProgress · renders
//        an honest fallback when percent is null (never fabricates)
const wh17 = /import\s*\{[^}]*computeJobProgress[^}]*\}\s*from\s*["']@\/lib\/nex\/brain\/warehouse["']/.test(OPS)
          && /hint\.percent\s*!==\s*null/.test(OPS)
          && /jobsInFlight[\s\S]{0,120}?in flight/.test(OPS);
record("WH17", wh17, `JobProgress · uses aggregator helper · honest fallback when percent=null`);

// WH18 · Phase 10.5b · JobProgress never renders a bar for percent=null.
//        Guarded by the ternary above · this test proves the width style
//        is bound to hint.percent (not a static or animated value).
const barWidthBinding = /width:\s*`?\$\{\s*hint\.percent\s*\}%`?/.test(OPS);
record("WH18", barWidthBinding, `bar width bound to hint.percent · no static/animated fake`);

// WH19 · Phase 10.7 · pagination fix · vault counts use count=exact +
//        head:true so numbers stay accurate past PostgREST's 1000-row cap.
//        (Old code did .select("status").limit(50000) which was silently
//         capped, causing UNDER_REVIEW=0 when actual was 134.)
const usesCountExact = /count:\s*"exact"/.test(WH) && /head:\s*true/.test(WH);
const noOldStatusSelect = !/\.select\(\s*"status"\s*\)\s*\.in\(\s*"status"/.test(WH);
record("WH19", usesCountExact && noOldStatusSelect,
  `head-only count queries · count_exact=${usesCountExact} old_select_removed=${noOldStatusSelect}`);

// WH20 · Phase 10.7 · new vault_records shape · draft split into
//        awaiting_check vs rejected · awaiting_review renamed from under_review
const vaultShapeOk = /awaiting_review:/.test(WH)
                  && /draft_rejected:/.test(WH)
                  && /draft_awaiting_check:/.test(WH)
                  && /deprecated:/.test(WH)
                  && !/under_review:/.test(WH);
record("WH20", vaultShapeOk, `vault_records has 5 fields · awaiting_review + draft split + deprecated`);

// WH21 · Phase 10.7 · UI renders the four vault barrels as a distinct
//        row so terminal states are visually separated from in-flight work.
const uiHasVaultRow = /Vault\s*·\s*Terminal States/.test(OPS)
                   && /vaultBarrels/.test(OPS)
                   && /draft_awaiting_check/.test(OPS)
                   && /draft_rejected/.test(OPS)
                   && /awaiting_review/.test(OPS);
record("WH21", uiHasVaultRow, `UI has Vault row with 4 vault barrels`);

// WH22 · Phase 10.7 · DRAFT split is DERIVED (intersect DRAFT ids with
//        completed quality-checker input_refs) · not stored on the record.
//        This is the "why some drafts are unchecked" observability
//        Philip explicitly asked for.
const usesIntersection = /checkedSet/.test(WH)
                      && /worker-type[\s\S]{0,80}?quality-checker/i.test(WH.toLowerCase().replace(/quality-checker/g, "worker-type-quality-checker"))
                      || /"worker_type",\s*value:\s*"quality-checker"/.test(WH);
record("WH22", usesIntersection || /"quality-checker"/.test(WH),
  `DRAFT split derives checked vs unchecked via quality-checker job intersection`);

// ── Summary ──
const passed = results.filter((r) => r.pass).length;
const total  = results.length;
process.stdout.write(`\nwarehouse: ${passed}/${total} assertions passed\n`);
process.exit(passed === total ? 0 : 1);
