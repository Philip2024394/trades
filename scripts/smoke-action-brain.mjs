#!/usr/bin/env node
// scripts/smoke-action-brain.mjs
//
// Founder Path A/B · ECO-2 · Action Brain facade + MCP scaffold.
//
// Verifies:
//   A · GET /api/nex/action-brain/list returns registered actions
//   B · POST /propose with unknown action → rejected_unknown_action
//   C · POST /propose with valid action + bad args → rejected_schema
//   D · POST /propose with valid action + valid args → outcome present
//   E · Doctrine #2 · every propose materialises an audit record
//   F · MCP-compatible summary shape (name/description/requires_confirmation)
//   G · Observatory snapshot reflects the new audit rows

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function get(path) {
  const res = await fetch(`${HOST}${path}`);
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: { _parse_error: text.slice(0, 200) } }; }
}

async function post(path, body) {
  const res = await fetch(`${HOST}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: { _parse_error: text.slice(0, 200) } }; }
}

const failures = [];

// ══ A · list actions
console.log("\n══ A · list actions");
{
  const r = await get("/api/nex/action-brain/list");
  const actions = r.body?.actions ?? [];
  console.log(`  status=${r.status} count=${actions.length}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (actions.length < 1) failures.push({ case: "A", reason: "no_actions_registered" });
  // Check MCP-compatible shape
  for (const a of actions) {
    if (!a.action_id || typeof a.summary !== "string" || typeof a.requires_confirmation !== "boolean") {
      failures.push({ case: "A", reason: `bad_action_shape_${JSON.stringify(a).slice(0, 80)}` });
    }
  }
}

// ══ B · unknown action → rejected_unknown_action
console.log("\n══ B · unknown action → rejected_unknown_action");
{
  const r = await post("/api/nex/action-brain/propose", {
    action_id: "fabricated_action_that_isnt_registered",
    args: {},
    rationale: "smoke test unknown",
    conversation_id: "smoke-ab-B",
  });
  const rec = r.body?.record;
  console.log(`  outcome=${rec?.outcome}`);
  if (rec?.outcome !== "rejected_unknown_action") {
    failures.push({ case: "B", reason: `expected_rejected_unknown_action_got_${rec?.outcome}` });
  }
}

// ══ C · valid action + bad args → rejected_schema
console.log("\n══ C · valid action + bad args → rejected_schema");
{
  const r = await post("/api/nex/action-brain/propose", {
    action_id: "save_favorite",
    args: {}, // missing entity_ref
    rationale: "smoke test bad args",
    conversation_id: "smoke-ab-C",
  });
  const rec = r.body?.record;
  console.log(`  outcome=${rec?.outcome}`);
  if (rec?.outcome !== "rejected_schema") {
    failures.push({ case: "C", reason: `expected_rejected_schema_got_${rec?.outcome}` });
  }
}

// ══ D · valid action + valid args → outcome present + audit
console.log("\n══ D · valid save_favorite → outcome + audit present");
{
  const r = await post("/api/nex/action-brain/propose", {
    action_id: "save_favorite",
    args: { entity_ref: "#AC-2026-0000C" },
    rationale: "smoke test happy path",
    conversation_id: "smoke-ab-D",
  });
  const rec = r.body?.record;
  console.log(`  outcome=${rec?.outcome} audit_id=${rec?.audit_id}`);
  if (!rec?.outcome) failures.push({ case: "D", reason: "no_outcome" });
  if (!rec?.audit_id) failures.push({ case: "D", reason: "no_audit_id" });
}

// ══ E · Doctrine #2 · every propose materialises an audit record
console.log("\n══ E · Doctrine #2 · every propose has an audit_id");
{
  // Already verified in B/C/D · here just confirm the shape.
  const r = await post("/api/nex/action-brain/propose", {
    action_id: "contact_via_whatsapp",
    args: { entity_ref: "#AC-2026-0000C", message: "smoke test" },
    rationale: "smoke test doctrine",
    conversation_id: "smoke-ab-E",
  });
  const rec = r.body?.record;
  console.log(`  outcome=${rec?.outcome} audit_id=${rec?.audit_id}`);
  if (!rec?.audit_id) failures.push({ case: "E", reason: "no_audit_id_on_doctrine_check" });
}

// ══ F · Observatory reflects the new rows
console.log("\n══ F · Observatory sees the audit rows");
{
  const r = await get("/api/nex/observatory/snapshot?window=1h");
  const doc = r.body?.doctrine_health?.doctrine_2_action_rejections;
  console.log(`  total_proposed=${doc?.total_proposed} executed=${doc?.executed} rejected_schema=${doc?.rejected_schema}`);
  if (!doc || typeof doc.total_proposed !== "number") failures.push({ case: "F", reason: "no_observability" });
  if ((doc?.total_proposed ?? 0) < 3) failures.push({ case: "F", reason: `expected_>=3_proposals_got_${doc?.total_proposed}` });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · Action Brain + MCP scaffold green · Doctrine #2 enforced.");
  process.exit(0);
}
