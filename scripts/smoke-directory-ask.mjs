#!/usr/bin/env node
// scripts/smoke-directory-ask.mjs
//
// Founder Phase 28 · P28-4 · Directory Ask + Honesty audit regression.
//
// Verifies:
//   A · POST /api/nex/directory/[ref_id]/ask with a location question returns a
//        structured-field answer citing address/city
//   B · POST /api/nex/directory/[ref_id]/ask with a pricing question includes
//        an "honesty audit" reason in the sources (or honest UNKNOWN)
//   C · missing question → 400 invalid_question
//   D · unknown ref → 404
//   E · GET /api/nex/directory/[ref_id]/honesty returns a verdict OR honest reason
//   F · honesty verdict has one of the known overall values
//   G · Doctrine #6 label present on ask response envelope (unconfirmed_claim_count)
//   H · answer is bounded (question length cap enforced)
//   I · /nex/directory page contains data-ask-form + data-honesty-chip markers in bundle
//   J · library: pricing-intent question WITHOUT scan_site still returns structured answer

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";
const failures = [];

async function j(pth, opts = {}) {
  const res = await fetch(`${HOST}${pth}`, opts);
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, body };
}
async function post(pth, body) {
  return j(pth, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

// Pick a real ref_id from the directory search
let refId = null;
{
  const r = await j("/api/nex/directory?q=hotel");
  refId = r.body?.cards?.[0]?.ref_id ?? null;
  console.log(`\n══ Setup · picked ref=${refId}`);
  if (!refId) { failures.push({ case: "SETUP", reason: "no_ref_found" }); }
}

// ══ A · location question
console.log("\n══ A · location question returns structured address");
if (refId) {
  const r = await post(`/api/nex/directory/${encodeURIComponent(refId)}/ask`, { question: "Where is this located?" });
  console.log(`  status=${r.status} answer="${String(r.body?.answer ?? "").slice(0, 90)}…"`);
  console.log(`  sources=${JSON.stringify((r.body?.sources ?? []).map((s) => s.kind))}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  const kinds = (r.body?.sources ?? []).map((s) => s.kind);
  if (!kinds.includes("structured_field")) failures.push({ case: "A", reason: "no_structured_field_source" });
}

// ══ B · pricing question (scan_site true · may reach out)
console.log("\n══ B · pricing question consults honesty audit OR honest UNKNOWN");
if (refId) {
  const r = await post(`/api/nex/directory/${encodeURIComponent(refId)}/ask`, { question: "Is there a free trial? Do I need a credit card?", scan_site: true });
  console.log(`  status=${r.status} used_honesty=${r.body?.used_honesty_audit} unconf=${r.body?.unconfirmed_claim_count}`);
  if (r.status !== 200) failures.push({ case: "B", reason: `status_${r.status}` });
  // Either honesty audit ran (used_honesty_audit=true), or the answer honestly says it couldn't scan
  const answerLower = String(r.body?.answer ?? "").toLowerCase();
  const honest = r.body?.used_honesty_audit || answerLower.includes("could not") || answerLower.includes("unconfirmed") || answerLower.includes("not on record");
  if (!honest) failures.push({ case: "B", reason: "not_honest_about_pricing" });
}

// ══ C · missing question
console.log("\n══ C · missing question → 400");
if (refId) {
  const r = await post(`/api/nex/directory/${encodeURIComponent(refId)}/ask`, {});
  console.log(`  status=${r.status} err=${r.body?.error}`);
  if (r.status !== 400) failures.push({ case: "C", reason: `status_${r.status}` });
}

// ══ D · unknown ref
console.log("\n══ D · unknown ref → 404");
{
  const r = await post(`/api/nex/directory/${encodeURIComponent("accom:nope-not-a-real-ref")}/ask`, { question: "hi" });
  console.log(`  status=${r.status}`);
  if (r.status !== 404) failures.push({ case: "D", reason: `status_${r.status}` });
}

// ══ E · honesty endpoint
console.log("\n══ E · GET /honesty returns verdict or honest reason");
if (refId) {
  const r = await j(`/api/nex/directory/${encodeURIComponent(refId)}/honesty`);
  console.log(`  status=${r.status} verdict.overall=${r.body?.verdict?.overall} listing_ref=${r.body?.listing_ref}`);
  if (r.status !== 200) failures.push({ case: "E", reason: `status_${r.status}` });
  const hasVerdict = r.body?.verdict != null || r.body?.reason === "listing_has_no_website";
  if (!hasVerdict) failures.push({ case: "E", reason: "no_verdict_or_reason" });
}

// ══ F · verdict enum
console.log("\n══ F · honesty overall is one of known enum values");
if (refId) {
  const r = await j(`/api/nex/directory/${encodeURIComponent(refId)}/honesty`);
  const known = new Set(["verified_free_no_cc", "free_with_cc_required", "paid_only", "trial_details_unclear", "pricing_not_stated", "unknown_site_blocked"]);
  const overall = r.body?.verdict?.overall;
  if (overall && !known.has(overall)) failures.push({ case: "F", reason: `bad_overall_${overall}` });
  console.log(`  overall=${overall} ok=${!overall || known.has(overall)}`);
}

// ══ G · Doctrine #6 envelope
console.log("\n══ G · Doctrine #6 fields present on ask response");
if (refId) {
  const r = await post(`/api/nex/directory/${encodeURIComponent(refId)}/ask`, { question: "What amenities are there?" });
  const hasCount = typeof r.body?.unconfirmed_claim_count === "number";
  const hasNote = /doctrine\s*#?\s*6/i.test(String(r.body?.doctrine_note ?? ""));
  console.log(`  unconf_count=${r.body?.unconfirmed_claim_count} doctrine=${hasNote}`);
  if (!hasCount) failures.push({ case: "G", reason: "no_unconf_count" });
  if (!hasNote) failures.push({ case: "G", reason: "no_doctrine_note" });
}

// ══ H · question length cap
console.log("\n══ H · overlong question rejected (>500 chars)");
if (refId) {
  const r = await post(`/api/nex/directory/${encodeURIComponent(refId)}/ask`, { question: "x".repeat(600) });
  console.log(`  status=${r.status}`);
  if (r.status !== 400) failures.push({ case: "H", reason: `status_${r.status}` });
}

// ══ I · page bundle contains new markers
console.log("\n══ I · /nex/directory bundle contains ask-form + honesty-chip markers");
{
  const html = (await j("/nex/directory")).text;
  const chunkMatch = html.match(/\/_next\/static\/[^"'\s]+\.(js|mjs)/g) ?? [];
  const uniq = [...new Set(chunkMatch)];
  let sawAsk = false, sawHonesty = false, sawAnswer = false;
  for (const url of uniq.slice(0, 25)) {
    try {
      const src = await (await fetch(`${HOST}${url}`)).text();
      if (/data-ask-form/.test(src)) sawAsk = true;
      if (/data-honesty-chip/.test(src)) sawHonesty = true;
      if (/data-ask-answer/.test(src)) sawAnswer = true;
      if (sawAsk && sawHonesty && sawAnswer) break;
    } catch { /* ignore */ }
  }
  console.log(`  ask=${sawAsk} honesty=${sawHonesty} answer=${sawAnswer}`);
  if (!sawAsk) failures.push({ case: "I", reason: "no_ask_form" });
  if (!sawHonesty) failures.push({ case: "I", reason: "no_honesty_chip" });
  if (!sawAnswer) failures.push({ case: "I", reason: "no_ask_answer" });
}

// ══ J · scan_site=false path
console.log("\n══ J · pricing question with scan_site=false still returns structured answer");
if (refId) {
  const r = await post(`/api/nex/directory/${encodeURIComponent(refId)}/ask`, { question: "How much does it cost?", scan_site: false });
  console.log(`  status=${r.status} used_honesty=${r.body?.used_honesty_audit}`);
  if (r.status !== 200) failures.push({ case: "J", reason: `status_${r.status}` });
  if (r.body?.used_honesty_audit === true) failures.push({ case: "J", reason: "honesty_ran_despite_scan_false" });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · Directory Ask + Honesty live · Doctrine #6 gates pricing claims · fast info finder proven.");
  process.exit(0);
}
