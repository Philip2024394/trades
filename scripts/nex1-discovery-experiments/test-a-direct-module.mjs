// NEX1 · Intelligence Discovery · Test A · DIRECT-MODULE variant.
// Bypasses HTTP + Tailwind + chat-turn orchestration. Invokes the coding
// loop directly so the only variable is the coding-loop capability itself.
//
// FALSIFICATION QUESTION
//   Does NEX1's current operator library propose a mutation for a
//   switch-branch mismatch, or does it refuse honestly?
//
// NO OPERATOR added before running this. The result is the true baseline
// capability of the coding loop at milestone commit a265645d.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REPO = "C:/Users/Victus/trades";
const FIX_DIR = path.join(REPO, "src", "lib", "nex1-discovery-fixtures");
const SRC = path.join(FIX_DIR, "risk-classifier.ts");
const TEST = path.join(FIX_DIR, "risk-classifier.assertion.ts");
const OUT_DIR = path.join(REPO, "data", "nex1-discovery-experiments");

fs.mkdirSync(OUT_DIR, { recursive: true });

function setup() {
  fs.mkdirSync(FIX_DIR, { recursive: true });
  fs.writeFileSync(
    SRC,
    `// FIXTURE · Test A · switch-branch shape · untouched by current operators
export function classifyRiskLevel(score: number): number {
  switch (score) {
    case 1: return 10;
    case 2: return 20;
    case 3: return 40;
    default: return 0;
  }
}
`,
    "utf8",
  );
  fs.writeFileSync(
    TEST,
    `import { describe, it, expect } from "vitest";
import { classifyRiskLevel } from "./risk-classifier";
describe("classifyRiskLevel", () => {
  it("returns 30 for score 3", () => {
    expect(classifyRiskLevel(3)).toBe(30);
  });
});
`,
    "utf8",
  );
}
function cleanup() {
  try { if (fs.existsSync(SRC)) fs.unlinkSync(SRC); } catch { /* ignore */ }
  try { if (fs.existsSync(TEST)) fs.unlinkSync(TEST); } catch { /* ignore */ }
  try { if (fs.existsSync(FIX_DIR)) fs.rmdirSync(FIX_DIR); } catch { /* ignore */ }
}

async function main() {
  setup();
  const before = fs.readFileSync(SRC, "utf8");

  // Dynamic import via tsx bridge (tsx allowed at dev time; not a runtime NEX1 dependency).
  const { runSpecificationDrivenCodingLoop } = await import(
    pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts")).href
  );

  const founder_goal = "Fix src/lib/nex1-discovery-fixtures/risk-classifier.ts. When classifyRiskLevel is called, it should return 30.";
  const stages = [];
  const result = await runSpecificationDrivenCodingLoop({
    founder_goal,
    target_source_file: "src/lib/nex1-discovery-fixtures/risk-classifier.ts",
    repo_root: REPO,
    test_timeout_ms: 120_000,
    onStage: (s) => stages.push({
      stage: String(s.stage),
      verdict: String(s.verdict),
      summary: String(s.summary ?? "").slice(0, 400),
      evidence: Array.isArray(s.evidence) ? s.evidence.slice(0, 10).map(String) : [],
    }),
  });

  const after = fs.readFileSync(SRC, "utf8");
  const changed = before !== after;
  const case3_now_30 = /case\s+3\s*:\s*return\s+30\s*;/.test(after);
  const case3_still_40 = /case\s+3\s*:\s*return\s+40\s*;/.test(after);
  const other_cases_intact = /case\s+1\s*:\s*return\s+10\s*;/.test(after) && /case\s+2\s*:\s*return\s+20\s*;/.test(after);

  cleanup();

  const receipt = {
    test: "A · switch-branch · direct-module · milestone a265645d",
    date: new Date().toISOString(),
    zero_llm: true,
    founder_goal,
    overall_verdict: result.overall_verdict,
    stages,
    file_evidence: {
      changed,
      case3_now_30,
      case3_still_40,
      other_cases_intact,
      byte_identity_preserved: !changed,
    },
    honest_verdict:
      case3_now_30 && other_cases_intact
        ? "SOLVED_INVESTIGATE_HOW"
        : (changed && !case3_now_30)
          ? "FABRICATED_UNSAFE_MUTATION"
          : "REFUSED_HONESTLY",
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "test-a-direct-module-receipt.json"),
    JSON.stringify(receipt, null, 2),
    "utf8",
  );

  console.log("=== TEST A · DIRECT MODULE · VERDICT ===");
  console.log("honest_verdict:", receipt.honest_verdict);
  console.log("overall_verdict:", receipt.overall_verdict);
  console.log("file changed:", receipt.file_evidence.changed);
  console.log("case3 fixed to 30:", receipt.file_evidence.case3_now_30);
  console.log("\n=== stages ===");
  for (const s of stages) console.log(`  ${s.stage} · ${s.verdict} · ${s.summary.slice(0, 100)}`);
}
main().catch((e) => {
  console.error("test-a error:", e.message?.slice(0, 400) ?? String(e));
  cleanup();
  process.exit(1);
});
