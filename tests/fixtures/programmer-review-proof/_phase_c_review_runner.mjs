// NEX Programmer Agent · Phase C · REVIEW RUNNER
// Philip 2026-09-05 · AUTHORIZE · PHASE C
//
// Executes all 10 review cases end-to-end (A-H + REAL_NEX + REAL_DEFECT),
// asserts each verdict against expectation, and writes an evidence
// summary for the final report.
//
// SAFETY:
//   · Pure computation · no DB · no filesystem writes outside the
//     proof directory · no network.
//   · Reviewer is deterministic · same input → same output.

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

if (!process.env.__PHASE_C_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __PHASE_C_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { review } = await import("../../../src/lib/nex/programmer-review/reviewer.ts");
  const { ALL_CASES } = await import("./_phase_c_fixture_cases.ts");

  console.log("\n═══ NEX Programmer-Agent Phase C · Independent Review Runner ═══\n");

  const results = [];
  let pass = 0;
  let fail = 0;

  for (const c of ALL_CASES) {
    const response = review(c.request);
    const expectedVerdict = c.expectation.expected_verdict;
    const verdictOk = response.verdict === expectedVerdict;
    const categoriesOk = c.expectation.expected_finding_categories
      ? c.expectation.expected_finding_categories.every((cat) =>
          response.findings.some((f) => f.category === cat),
        )
      : true;
    const ok = verdictOk && categoriesOk;
    if (ok) pass += 1; else fail += 1;

    console.log(`${ok ? "🟢" : "🔴"} Case ${c.case_id} · ${c.label}`);
    console.log(`   expected=${expectedVerdict} · actual=${response.verdict} · confidence=${response.confidence}`);
    console.log(`   findings=${response.findings.length} (${Object.entries(tally(response.findings)).map(([k, v]) => `${k}=${v}`).join(" ")})`);
    if (c.expectation.expected_finding_categories) {
      const missing = c.expectation.expected_finding_categories.filter((cat) =>
        !response.findings.some((f) => f.category === cat),
      );
      if (missing.length > 0) console.log(`   ⚠ missing categories: ${missing.join(", ")}`);
    }
    if (response.findings.length > 0) {
      for (const f of response.findings.slice(0, 3)) {
        console.log(`     · ${f.severity} · ${f.category} · ${f.message.slice(0, 120)}`);
      }
    }
    console.log("");

    results.push({
      case_id: c.case_id,
      label: c.label,
      expected_verdict: expectedVerdict,
      actual_verdict: response.verdict,
      verdict_correct: verdictOk,
      confidence: response.confidence,
      findings: response.findings,
      evidence_inspected: response.evidence_inspected,
      knowledge_used: response.knowledge_used,
      reasoning_trace: response.reasoning_trace,
      expected_categories: c.expectation.expected_finding_categories ?? [],
      categories_ok: categoriesOk,
    });
  }

  console.log(`═══ Adversarial matrix result: ${pass}/${pass + fail} correct ═══\n`);

  const summary = {
    ran_at: new Date().toISOString(),
    total_cases: ALL_CASES.length,
    passed: pass,
    failed: fail,
    results,
  };
  const outPath = path.join(here, "_phase_c_review_run.json");
  writeFileSync(outPath, JSON.stringify(summary, null, 2) + "\n", "utf8");
  console.log(`→ ${outPath}`);

  if (fail > 0) {
    console.error(`\n🔴 ${fail} case(s) failed · Phase C is not GREEN`);
    process.exit(1);
  } else {
    console.log(`\n🟢 all ${pass} cases produced expected verdicts`);
    process.exit(0);
  }
}

function tally(findings) {
  const t = { INFO: 0, WARNING: 0, MATERIAL: 0, CRITICAL: 0 };
  for (const f of findings) t[f.severity] = (t[f.severity] ?? 0) + 1;
  return t;
}
