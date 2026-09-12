#!/usr/bin/env node
// scripts/smoke-code-interpreter.mjs
//
// Founder Phase 20 · P20-4 · Code interpreter regression.
//
// Verifies:
//   A · trivial arithmetic returns correct primitive
//   B · console.log captured to stdout · not stderr
//   C · console.error captured to stderr
//   D · syntax error caught with error_class=SyntaxError · ok=false
//   E · runtime error caught with error_class=TypeError · ok=false
//   F · timeout enforced · timed_out=true when infinite loop hits budget
//   G · sandbox escape blocked: `require` is undefined
//   H · sandbox escape blocked: `process` is undefined
//   I · sandbox escape blocked: `globalThis` does NOT expose host globals
//   J · code_generation.strings=false blocks `eval` + `new Function`
//   K · hash stability: same code → same execution_id
//   L · code >20KB rejected at Zod validation (400)
//   M · doctrine_note present

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";
const failures = [];

async function exec(code, extra = {}) {
  const res = await fetch(`${HOST}/api/nex/code/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, ...extra }),
  });
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, body };
}

// ══ A · arithmetic
console.log("\n══ A · trivial arithmetic");
let firstId;
{
  const r = await exec("return 2 + 2;");
  console.log(`  status=${r.status} return=${r.body?.return_value} kind=${r.body?.return_kind}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (r.body?.return_value !== 4) failures.push({ case: "A", reason: `return_${r.body?.return_value}` });
  if (!r.body?.ok) failures.push({ case: "A", reason: "not_ok" });
  firstId = r.body?.execution_id;
  if (!firstId?.startsWith("code:")) failures.push({ case: "A", reason: "no_code_id" });
}

// ══ B · stdout capture
console.log("\n══ B · console.log → stdout");
{
  const r = await exec(`console.log("hello");console.log("world");`);
  console.log(`  stdout="${r.body?.stdout?.replace(/\n/g, "\\n")}" stderr="${r.body?.stderr}"`);
  if (!r.body?.stdout?.includes("hello")) failures.push({ case: "B", reason: "no_hello" });
  if (!r.body?.stdout?.includes("world")) failures.push({ case: "B", reason: "no_world" });
  if (r.body?.stderr && r.body.stderr.length > 0) failures.push({ case: "B", reason: "stderr_leaked" });
}

// ══ C · stderr capture
console.log("\n══ C · console.error → stderr");
{
  const r = await exec(`console.error("boom");`);
  console.log(`  stdout="${r.body?.stdout}" stderr="${r.body?.stderr?.replace(/\n/g, "\\n")}"`);
  if (!r.body?.stderr?.includes("boom")) failures.push({ case: "C", reason: "no_boom" });
}

// ══ D · syntax error
console.log("\n══ D · syntax error caught");
{
  const r = await exec(`return 1 +;`);
  console.log(`  ok=${r.body?.ok} class=${r.body?.error_class}`);
  if (r.body?.ok !== false) failures.push({ case: "D", reason: "should_not_ok" });
  if (r.body?.error_class !== "SyntaxError") failures.push({ case: "D", reason: `class_${r.body?.error_class}` });
}

// ══ E · runtime type error
console.log("\n══ E · runtime error caught");
{
  const r = await exec(`return null.foo;`);
  console.log(`  ok=${r.body?.ok} class=${r.body?.error_class}`);
  if (r.body?.ok !== false) failures.push({ case: "E", reason: "should_not_ok" });
  if (r.body?.error_class !== "TypeError") failures.push({ case: "E", reason: `class_${r.body?.error_class}` });
}

// ══ F · timeout
console.log("\n══ F · timeout enforced on infinite loop");
{
  const r = await exec(`while(true){}`, { budget_ms: 500 });
  console.log(`  ok=${r.body?.ok} timed_out=${r.body?.timed_out} ms=${r.body?.request_ms}`);
  if (r.body?.timed_out !== true) failures.push({ case: "F", reason: "not_timed_out" });
  if (r.body?.ok !== false) failures.push({ case: "F", reason: "ok_after_timeout" });
  if ((r.body?.request_ms ?? 0) > 1200) failures.push({ case: "F", reason: `overshot_${r.body?.request_ms}` });
}

// ══ G · require blocked
console.log("\n══ G · require is undefined in sandbox");
{
  const r = await exec(`return typeof require;`);
  console.log(`  return=${r.body?.return_value}`);
  if (r.body?.return_value !== "undefined") failures.push({ case: "G", reason: `require=${r.body?.return_value}` });
}

// ══ H · process blocked
console.log("\n══ H · process is undefined in sandbox");
{
  const r = await exec(`return typeof process;`);
  console.log(`  return=${r.body?.return_value}`);
  if (r.body?.return_value !== "undefined") failures.push({ case: "H", reason: `process=${r.body?.return_value}` });
}

// ══ I · globalThis not host
console.log("\n══ I · globalThis does not expose host globals");
{
  // Even if `globalThis` exists inside the vm context, it must NOT contain
  // require, process, Buffer, fetch, etc.
  const r = await exec(`
    const g = typeof globalThis !== "undefined" ? globalThis : {};
    return {
      hasRequire: typeof g.require !== "undefined",
      hasProcess: typeof g.process !== "undefined",
      hasBuffer:  typeof g.Buffer  !== "undefined",
      hasFetch:   typeof g.fetch   !== "undefined",
    };
  `);
  console.log(`  ${JSON.stringify(r.body?.return_value)}`);
  const v = r.body?.return_value ?? {};
  if (v.hasRequire) failures.push({ case: "I", reason: "leaked_require" });
  if (v.hasProcess) failures.push({ case: "I", reason: "leaked_process" });
  if (v.hasBuffer)  failures.push({ case: "I", reason: "leaked_buffer"  });
  if (v.hasFetch)   failures.push({ case: "I", reason: "leaked_fetch"   });
}

// ══ J · eval + new Function blocked
console.log("\n══ J · eval + new Function blocked");
{
  const r1 = await exec(`return eval("2+2");`);
  const r2 = await exec(`return new Function("return 2+2")();`);
  console.log(`  eval.ok=${r1.body?.ok} class=${r1.body?.error_class}`);
  console.log(`  fn.ok=${r2.body?.ok} class=${r2.body?.error_class}`);
  if (r1.body?.ok !== false) failures.push({ case: "J", reason: "eval_ran" });
  if (r2.body?.ok !== false) failures.push({ case: "J", reason: "new_function_ran" });
}

// ══ K · hash stability
console.log("\n══ K · same code → same execution_id");
{
  const r = await exec("return 2 + 2;");
  console.log(`  first=${firstId} again=${r.body?.execution_id} match=${r.body?.execution_id === firstId}`);
  if (r.body?.execution_id !== firstId) failures.push({ case: "K", reason: "hash_unstable" });
}

// ══ L · code too large
console.log("\n══ L · >20KB code rejected");
{
  const big = "let x=0;".repeat(3000);      // ~24KB
  const r = await exec(big);
  console.log(`  status=${r.status} err=${r.body?.error}`);
  if (r.status !== 400) failures.push({ case: "L", reason: `status_${r.status}` });
}

// ══ M · doctrine_note
console.log("\n══ M · doctrine_note present");
{
  const r = await exec(`return 1;`);
  const has = String(r.body?.doctrine_note ?? "").toUpperCase().includes("COMPUTED OUTPUT IS INPUT");
  console.log(`  doctrine=${r.body?.doctrine_note?.slice(0, 40)}…`);
  if (!has) failures.push({ case: "M", reason: "no_doctrine" });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · code interpreter live · sandbox holds · timeout enforced · escapes blocked.");
  process.exit(0);
}
