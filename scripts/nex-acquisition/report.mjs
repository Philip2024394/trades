// NEX Universal Acquisition Engine · audit report writer.
//
// Writes a machine-readable JSON report per run (for HQ ingestion later) AND
// a human-readable summary to stdout. Report format matches the spec Philip
// gave 2026-08-21: discovered / matched / new / enriched / contactable /
// eligible / rejected / ambiguous · plus per-source and per-error detail.

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = join(__dirname, ".cache", "runs");

export async function writeReport(audit) {
  if (!existsSync(RUNS_DIR)) mkdirSync(RUNS_DIR, { recursive: true });
  const filename = `${audit.jobId}.json`;
  const path = join(RUNS_DIR, filename);
  writeFileSync(path, JSON.stringify(audit, null, 2), "utf8");
  return path;
}

export function printHumanReport(audit) {
  const c = audit.counts;
  const line = (s = "") => console.log(s);
  line("");
  line("═".repeat(72));
  line(`NEX ACQUISITION · RUN REPORT`);
  line("═".repeat(72));
  line(`  job:      ${audit.jobId}`);
  line(`  vertical: ${audit.vertical}`);
  line(`  city:     ${audit.city}`);
  line(`  bbox:     ${JSON.stringify(audit.bbox)}`);
  line(`  mode:     ${audit.smokeMode ? "SMOKE" : "PRODUCTION"} · ${audit.dryRun ? "DRY RUN" : "APPLY"}`);
  line(`  started:  ${audit.startedAt}`);
  line(`  finished: ${audit.finishedAt}`);
  line("");
  line("── FUNNEL ──");
  line(`  DISCOVERED     : ${c.discovered}`);
  line(`  MATCHED exact  : ${c.matched_exact}`);
  line(`  MATCHED fuzzy  : ${c.matched_high}`);
  line(`  AMBIGUOUS      : ${c.ambiguous}     (needs admin review)`);
  line(`  UNNAMED        : ${c.unnamed}       (skipped · no name)`);
  line(`  NEW            : ${c.new_candidates}`);
  line(`  ENRICHED       : ${c.enriched}       (from official website)`);
  line(`  CONTACTABLE    : ${c.gate3_contactable}    (Gate 3 pass)`);
  line(`  ELIGIBLE       : ${c.gate4_eligible}       (Gate 4 pass)`);
  line(`  OUTREACH sent  : ${c.gate5_outreach_sent}       (Gate 5 · production only)`);
  line(`  OUTREACH blocked by SMOKE : ${c.gate5_outreach_blocked_by_smoke}`);
  line(`  REJECTED by any gate     : ${c.rejected_by_gate}`);
  line(`  ERRORS         : ${c.errors}`);
  line("");
  if (audit.sources.length > 0) {
    line("── PER-SOURCE ──");
    for (const s of audit.sources) {
      line(`  ${s.name.padEnd(20)} discovered=${s.discovered}  errors=${s.errors.length}`);
    }
    line("");
  }
  if (audit.samples.new.length > 0) {
    line("── SAMPLE · new records ──");
    for (const n of audit.samples.new) {
      line(`  ${n.publicRef}  ${(n.name ?? "").slice(0, 42).padEnd(42)}  [${n.category ?? "-"}]  coord=${n.hasCoord?"Y":"n"} contact=${n.hasContact?"Y":"n"}`);
    }
    line("");
  }
  if (audit.samples.contactable.length > 0) {
    line("── SAMPLE · contactable records ──");
    for (const n of audit.samples.contactable) {
      const c = n.whatsapp ? `wa=${n.whatsapp}` : n.phone ? `tel=${n.phone}` : "(none)";
      line(`  ${n.publicRef}  ${(n.name ?? "").slice(0, 42).padEnd(42)}  ${c}`);
    }
    line("");
  }
  if (audit.samples.ambiguous.length > 0) {
    line("── SAMPLE · ambiguous matches (admin review) ──");
    for (const a of audit.samples.ambiguous) {
      line(`  score=${a.score}  candidate "${a.candidateName}"  ↔  existing ${a.existingRef} "${a.existingName}"`);
    }
    line("");
  }
  if (audit.samples.rejected.length > 0) {
    line("── SAMPLE · rejected by gate ──");
    for (const r of audit.samples.rejected) {
      line(`  ${r.publicRef}  "${r.name}"  reason: ${r.reason}`);
    }
    line("");
  }
  if (audit.errors.length > 0) {
    line("── ERRORS ──");
    for (const e of audit.errors) {
      line(`  [${e.phase}${e.source ? "·" + e.source : ""}${e.ref ? "·" + e.ref : ""}] ${e.message}`);
    }
    line("");
  }
  line("── DOCTRINE CHECK ──");
  line(`  Discovery ≠ Outreach:            ${c.gate5_outreach_sent === 0 ? "HELD ✓" : "VIOLATED ✗"}`);
  line(`  Provenance recorded on every new: ${audit.samples.new.every((n) => n.publicRef) ? "HELD ✓" : "VIOLATED ✗"}`);
  line(`  Smoke mode outreach hard-noop:   ${audit.smokeMode && c.gate5_outreach_sent === 0 ? "HELD ✓" : (audit.smokeMode ? "VIOLATED ✗" : "n/a")}`);
  line("═".repeat(72));
  line("");
}
