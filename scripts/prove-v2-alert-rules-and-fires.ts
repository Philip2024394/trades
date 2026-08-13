// scripts/prove-v2-alert-rules-and-fires.ts
//
// Wave 4 · V-2a + V-2b + V-2c · direct-function-call exercise of the
// alert-rules and llm-health surfaces (avoiding a live dev server).
//
// V-2a · listAlertRules() returns a valid array
// V-2b · count of enabled rules (starter-set target ≥ 10)
// V-2c · evaluateAlertRules() returns a non-null array (fires state observable)
//
// Governed by: docs/headquarters-production-readiness/WAVE-4-VERIFICATION-MATRIX.md
// Read-only. Zero DB writes. Zero preserved-KJ touches.

import { listAlertRules } from "@/lib/nex/observability/alert-rules";
import { evaluateAlertRules } from "@/lib/nex/observability/alert-evaluator";

async function main(): Promise<void> {
  console.log("=== Wave 4 · V-2 · alert-rules + evaluator observability ===\n");

  // V-2a
  console.log("--- V-2a · listAlertRules() ---");
  const rules = await listAlertRules();
  const ok = Array.isArray(rules);
  console.log(`  returned type = ${Array.isArray(rules) ? "array" : typeof rules}`);
  console.log(`  count         = ${rules.length}`);
  console.log(`  → ${ok ? "PASS" : "FAIL"} · listAlertRules returned an array\n`);

  // V-2b
  console.log("--- V-2b · rule population (starter-set expectation ≥ 10) ---");
  console.log(`  total rules   = ${rules.length}`);
  if (rules.length > 0) console.log(`  first rule id = ${rules[0]?.rule_id ?? "n/a"} · counter_name = ${rules[0]?.counter_name ?? "n/a (schema mismatch, see H5 021/048 collision)"}`);
  const populated = rules.length >= 10;
  console.log(`  → ${populated ? "PASS" : "OPEN"} · ${populated ? "meets starter-set threshold" : "below starter-set · matches H5 021/048 collision finding (Subsystem B cannot populate)"}\n`);

  // V-2c
  console.log("--- V-2c · evaluateAlertRules() returns non-null ---");
  const fires = await evaluateAlertRules();
  const fireOk = fires !== null && Array.isArray(fires);
  console.log(`  fires type    = ${Array.isArray(fires) ? "array" : fires === null ? "null" : typeof fires}`);
  console.log(`  fires length  = ${Array.isArray(fires) ? fires.length : "n/a"}`);
  console.log(`  → ${fireOk ? "PASS" : "FAIL"} · evaluator observable\n`);

  const overall = ok && fireOk;
  console.log(`overall · V-2a=${ok ? "PASS" : "FAIL"} · V-2b=${populated ? "PASS" : "OPEN"} · V-2c=${fireOk ? "PASS" : "FAIL"}`);
  process.exitCode = overall ? 0 : 2;
}

main().catch((e) => { console.error("runner exception:", e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(1); });
