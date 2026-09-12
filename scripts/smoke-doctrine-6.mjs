#!/usr/bin/env node
// scripts/smoke-doctrine-6.mjs
//
// Founder Doctrine #6 · P25-4 · "Truth or Unconfirmed" label enforcer.
//
// Verifies:
//   A · library: verified-backed text does NOT get labeled
//   B · library: unverified text about legends/spiritual/history DOES get labeled
//   C · library: idempotence — labeling twice does not double-prefix
//   D · library: language variants — French preferred_language uses "Non vérifié:"
//   E · library: greetings and clarifying questions are NOT prefixed
//   F · library: mixed verified paragraph with embedded legend gets ONLY the legend labeled
//   G · endpoint: chat-with-tools echoes unconfirmed_claim_count field
//   H · endpoint: doctrine_note names Doctrine #6
//   I · library: sentence-count round-trip · applying to already-labeled text is a no-op
//   J · library: doctrine6Note is descriptive when count>0 · concise when count=0

import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";
const failures = [];

// ══ Library-direct tests (via child process to load .ts) ══
function runLibScript(code, envExtras = {}) {
  const { spawnSync } = require("node:child_process");
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "-e", code], {
    encoding: "utf8",
    env: { ...process.env, ...envExtras },
  });
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

// ══ A · verified-backed text NOT labeled
console.log("\n══ A · verified-backed text does NOT get labeled");
{
  const script = `
import { applyDoctrine6 } from "./src/lib/nex/unconfirmed-labeler/index.ts";
const r = applyDoctrine6({
  text: "Based on what we have on record: the hotel has 42 rooms. It offers Wi-Fi.",
  has_verified_evidence: true,
  language: "en",
});
console.log(JSON.stringify({ count: r.unconfirmed_claim_count, has_prefix: r.labeled_text.includes("Unconfirmed:") }));
`;
  const out = runLibScript(script);
  const line = out.stdout.split(/\r?\n/).filter((l) => l.startsWith("{")).pop() ?? "";
  const parsed = (() => { try { return JSON.parse(line); } catch { return null; } })();
  console.log(`  ${line || out.stderr.slice(0, 120)}`);
  if (!parsed) failures.push({ case: "A", reason: "no_parse" });
  else {
    if (parsed.count !== 0) failures.push({ case: "A", reason: `count_${parsed.count}` });
    if (parsed.has_prefix) failures.push({ case: "A", reason: "prefix_on_verified" });
  }
}

// ══ B · unverified/legend text IS labeled
console.log("\n══ B · unverified legend/spiritual text IS labeled");
{
  const script = `
import { applyDoctrine6 } from "./src/lib/nex/unconfirmed-labeler/index.ts";
const r = applyDoctrine6({
  text: "The legend says the mountain was created by a dragon. It is believed that souls dwell in the trees.",
  has_verified_evidence: false,
  language: "en",
});
console.log(JSON.stringify({ count: r.unconfirmed_claim_count, text: r.labeled_text, reasons: r.reason_hints.slice(0, 3) }));
`;
  const out = runLibScript(script);
  const line = out.stdout.split(/\r?\n/).filter((l) => l.startsWith("{")).pop() ?? "";
  const parsed = (() => { try { return JSON.parse(line); } catch { return null; } })();
  console.log(`  ${line?.slice(0, 200) || out.stderr.slice(0, 120)}`);
  if (!parsed) failures.push({ case: "B", reason: "no_parse" });
  else {
    if (parsed.count < 1) failures.push({ case: "B", reason: `count_${parsed.count}` });
    if (!parsed.text.includes("Unconfirmed:")) failures.push({ case: "B", reason: "no_prefix" });
    if (parsed.reasons.length === 0) failures.push({ case: "B", reason: "no_reason_hints" });
  }
}

// ══ C · idempotence
console.log("\n══ C · idempotent labeling (no double-prefix)");
{
  const script = `
import { applyDoctrine6 } from "./src/lib/nex/unconfirmed-labeler/index.ts";
const first = applyDoctrine6({
  text: "The legend says the mountain was created by a dragon.",
  has_verified_evidence: false,
  language: "en",
});
const second = applyDoctrine6({
  text: first.labeled_text,
  has_verified_evidence: false,
  language: "en",
});
const doubles = (second.labeled_text.match(/Unconfirmed: Unconfirmed:/g) ?? []).length;
console.log(JSON.stringify({ first_count: first.unconfirmed_claim_count, second_count: second.unconfirmed_claim_count, doubles }));
`;
  const out = runLibScript(script);
  const line = out.stdout.split(/\r?\n/).filter((l) => l.startsWith("{")).pop() ?? "";
  const parsed = (() => { try { return JSON.parse(line); } catch { return null; } })();
  console.log(`  ${line || out.stderr.slice(0, 120)}`);
  if (!parsed) failures.push({ case: "C", reason: "no_parse" });
  else if (parsed.doubles > 0) failures.push({ case: "C", reason: `${parsed.doubles}_double_prefixes` });
}

// ══ D · French language variant
console.log("\n══ D · French preferred_language uses 'Non vérifié:'");
{
  const script = `
import { applyDoctrine6, prefixForLanguage } from "./src/lib/nex/unconfirmed-labeler/index.ts";
const r = applyDoctrine6({
  text: "La légende raconte que la montagne fut créée par un dragon.",
  has_verified_evidence: false,
  language: "fr",
});
console.log(JSON.stringify({ prefix: prefixForLanguage("fr"), used: r.prefix_used, text: r.labeled_text }));
`;
  const out = runLibScript(script);
  const line = out.stdout.split(/\r?\n/).filter((l) => l.startsWith("{")).pop() ?? "";
  const parsed = (() => { try { return JSON.parse(line); } catch { return null; } })();
  console.log(`  ${line?.slice(0, 160) || out.stderr.slice(0, 120)}`);
  if (!parsed) failures.push({ case: "D", reason: "no_parse" });
  else {
    if (parsed.prefix !== "Non vérifié:") failures.push({ case: "D", reason: `prefix_${parsed.prefix}` });
    if (!parsed.text.includes("Non vérifié:")) failures.push({ case: "D", reason: "no_fr_prefix_applied" });
  }
}

// ══ E · greetings NOT prefixed
console.log("\n══ E · greetings + clarifying questions NOT prefixed");
{
  const script = `
import { applyDoctrine6 } from "./src/lib/nex/unconfirmed-labeler/index.ts";
const r = applyDoctrine6({
  text: "Hi! Which property did you mean?",
  has_verified_evidence: false,
  language: "en",
});
console.log(JSON.stringify({ count: r.unconfirmed_claim_count, text: r.labeled_text }));
`;
  const out = runLibScript(script);
  const line = out.stdout.split(/\r?\n/).filter((l) => l.startsWith("{")).pop() ?? "";
  const parsed = (() => { try { return JSON.parse(line); } catch { return null; } })();
  console.log(`  ${line || out.stderr.slice(0, 120)}`);
  if (!parsed) failures.push({ case: "E", reason: "no_parse" });
  else if (parsed.count > 0) failures.push({ case: "E", reason: `labeled_greeting_${parsed.count}` });
}

// ══ F · mixed: verified paragraph with embedded legend
console.log("\n══ F · verified paragraph with embedded legend · ONLY legend labeled");
{
  const script = `
import { applyDoctrine6 } from "./src/lib/nex/unconfirmed-labeler/index.ts";
const r = applyDoctrine6({
  text: "Based on what we have on record: the hotel has 42 rooms. The legend says a phoenix once nested on the roof.",
  has_verified_evidence: true,
  language: "en",
});
const prefixed_sentences = (r.labeled_text.match(/Unconfirmed:/g) ?? []).length;
console.log(JSON.stringify({ count: r.unconfirmed_claim_count, prefixed: prefixed_sentences, text: r.labeled_text }));
`;
  const out = runLibScript(script);
  const line = out.stdout.split(/\r?\n/).filter((l) => l.startsWith("{")).pop() ?? "";
  const parsed = (() => { try { return JSON.parse(line); } catch { return null; } })();
  console.log(`  ${line?.slice(0, 200) || out.stderr.slice(0, 120)}`);
  if (!parsed) failures.push({ case: "F", reason: "no_parse" });
  else {
    if (parsed.count !== 1) failures.push({ case: "F", reason: `count_${parsed.count}` });
    if (parsed.prefixed !== 1) failures.push({ case: "F", reason: `prefixed_${parsed.prefixed}` });
    if (!parsed.text.startsWith("Based on what")) failures.push({ case: "F", reason: "verified_lead_altered" });
  }
}

// ══ G · endpoint echoes unconfirmed_claim_count
console.log("\n══ G · chat-with-tools returns unconfirmed_claim_count field");
{
  const res = await fetch(`${HOST}/api/nex-conv/chat-with-tools`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "hello", conversation_id: randomUUID() }),
  });
  const j = await res.json().catch(() => ({}));
  console.log(`  status=${res.status} unconfirmed_claim_count=${j?.unconfirmed_claim_count}`);
  if (res.status !== 200) failures.push({ case: "G", reason: `status_${res.status}` });
  if (typeof j?.unconfirmed_claim_count !== "number") failures.push({ case: "G", reason: "no_count_field" });
}

// ══ H · doctrine_note names Doctrine #6
console.log("\n══ H · doctrine_note names Doctrine #6");
{
  const res = await fetch(`${HOST}/api/nex-conv/chat-with-tools`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "hello", conversation_id: randomUUID() }),
  });
  const j = await res.json().catch(() => ({}));
  const note = String(j?.doctrine_note ?? "");
  const names6 = /doctrine\s*#?\s*6/i.test(note);
  console.log(`  names_6=${names6} note="${note.slice(0, 80)}…"`);
  if (!names6) failures.push({ case: "H", reason: "doctrine_6_not_named" });
}

// ══ I · labeling already-labeled text is safe
console.log("\n══ I · labeling already-labeled text is idempotent no-op");
{
  const script = `
import { applyDoctrine6 } from "./src/lib/nex/unconfirmed-labeler/index.ts";
const seed = "Unconfirmed: The legend says the mountain was created by a dragon.";
const r = applyDoctrine6({ text: seed, has_verified_evidence: false, language: "en" });
console.log(JSON.stringify({ text: r.labeled_text, doubled: r.labeled_text.includes("Unconfirmed: Unconfirmed:") }));
`;
  const out = runLibScript(script);
  const line = out.stdout.split(/\r?\n/).filter((l) => l.startsWith("{")).pop() ?? "";
  const parsed = (() => { try { return JSON.parse(line); } catch { return null; } })();
  console.log(`  ${line?.slice(0, 160) || out.stderr.slice(0, 120)}`);
  if (!parsed) failures.push({ case: "I", reason: "no_parse" });
  else if (parsed.doubled) failures.push({ case: "I", reason: "double_prefix_seed" });
}

// ══ J · doctrine6Note behavior
console.log("\n══ J · doctrine6Note is descriptive when count>0, concise when count=0");
{
  const script = `
import { doctrine6Note } from "./src/lib/nex/unconfirmed-labeler/index.ts";
console.log(JSON.stringify({ zero: doctrine6Note(0), three: doctrine6Note(3) }));
`;
  const out = runLibScript(script);
  const line = out.stdout.split(/\r?\n/).filter((l) => l.startsWith("{")).pop() ?? "";
  const parsed = (() => { try { return JSON.parse(line); } catch { return null; } })();
  console.log(`  ${line?.slice(0, 180) || out.stderr.slice(0, 120)}`);
  if (!parsed) failures.push({ case: "J", reason: "no_parse" });
  else {
    if (!parsed.zero.toLowerCase().includes("nothing labeled")) failures.push({ case: "J", reason: "zero_wording" });
    if (!parsed.three.includes("3 unverified")) failures.push({ case: "J", reason: "three_wording" });
  }
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · Doctrine #6 live · verified vs unconfirmed labeled at last mile · never presented as fact.");
  process.exit(0);
}
