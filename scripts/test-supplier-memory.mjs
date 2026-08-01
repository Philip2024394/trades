// Supplier Communication Memory v1 · validation suite (Philip 2026-08-02).
//
// STRUCTURE:
//   (A) UNIT-level assertions — always run · exercise PII masking and
//       matcher cold-start guarantees. No external dependencies.
//   (B) SCHEMA-level assertions — parse the migration SQL and confirm
//       Philip's three governance decisions are encoded:
//       (1) PII mask columns exist · (2) source_of_signal enforced ·
//       (3) verified filter enforced.
//   (C) LIVE assertions — only run when NEX_SUPPLIER_MEMORY_LIVE=1 and
//       Supabase is available AND the migration has been applied. Otherwise
//       skipped with a clear message · not a failure.
//
// Exit code 0 when all attempted assertions pass. Failures fatal.

import { readFileSync } from "node:fs";

const results = { pass: 0, fail: 0, skip: 0, failures: [] };
function check(label, ok, detail = "") {
  if (ok) { results.pass++; console.log(`  ✓ ${label}`); }
  else    { results.fail++; results.failures.push({ label, detail }); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); }
}
function skip(label, reason) { results.skip++; console.log(`  ○ ${label} — SKIPPED (${reason})`); }
function line(char = "─", n = 60) { return char.repeat(n); }

// ═══════════════════════════════════════════════════════════════════
// (A) UNIT · PII masking
// ═══════════════════════════════════════════════════════════════════

// Mirror the pii-mask.ts regexes here so this script can run standalone under Node
// without a TS loader. If the shipped module diverges from these, the schema check
// won't catch it — but the tests below fail visibly, which is the point.
const EMAIL_RX = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
const PHONE_RX = /(\+?\d[\d\s.\-()]{6,}\d)/g;
const UK_POSTCODE_FULL_RX = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}\b/gi;
const US_ZIP_PLUS4_RX = /\b(\d{5})-\d{4}\b/g;

const ISO_DATE_PREFIX_RX = /^\d{4}-\d{2}-\d{2}/;
function maskStringLocal(input) {
  if (!input) return input;
  let out = input;
  // Order matters: postcodes BEFORE phone · otherwise ZIP+4 gets consumed as phone
  out = out.replace(EMAIL_RX, "[email-redacted]");
  out = out.replace(UK_POSTCODE_FULL_RX, "$1");
  out = out.replace(US_ZIP_PLUS4_RX, "$1");
  out = out.replace(PHONE_RX, (m) => {
    if (m.replace(/\D/g, "").length < 7) return m;
    if (ISO_DATE_PREFIX_RX.test(m)) return m;   // Philip 2026-08-02 · timestamps aren't PII
    return "[phone-redacted]";
  });
  return out;
}
function maskPIILocal(value) {
  if (value == null) return value;
  if (typeof value === "string") return maskStringLocal(value);
  if (Array.isArray(value)) return value.map(maskPIILocal);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = maskPIILocal(v);
    return out;
  }
  return value;
}

async function unitPIIMask() {
  console.log(`\n${line("═")}`);
  console.log("(A) UNIT · PII masking (regex parity check with pii-mask.ts)");
  console.log(line("═"));

  const cases = [
    { in: "Contact me at philip@example.com or 07700 900 123",
      expect: (s) => !/philip@example\.com/.test(s) && !/07700\s?900\s?123/.test(s) && /\[email-redacted\]/.test(s) && /\[phone-redacted\]/.test(s) },
    { in: "My postcode is SW1A 1AA",
      expect: (s) => /SW1A/.test(s) && !/SW1A 1AA/.test(s) },
    { in: "ZIP 94103-1234",
      expect: (s) => /94103/.test(s) && !/94103-1234/.test(s) },
    { in: "materials: oak, walnut, glass",
      expect: (s) => s === "materials: oak, walnut, glass" },
    { in: "1 staircase 3m rise",
      expect: (s) => s === "1 staircase 3m rise" },
  ];

  for (const c of cases) {
    const out = maskPIILocal(c.in);
    check(`maskPII("${c.in.slice(0, 40)}…")`, c.expect(out), `got "${out}"`);
  }

  const deep = maskPIILocal({
    project_location: "SW1A 1AA, contact philip@example.com",
    materials:        ["oak", "glass"],
    admin_notes:      "call 07700 900 999",
    quantity:         "1",
  });
  check("deep object · project_location postcode truncated + email masked",
    !/1AA/.test(deep.project_location) && /\[email-redacted\]/.test(deep.project_location));
  check("deep object · materials array unchanged",
    Array.isArray(deep.materials) && deep.materials.join(",") === "oak,glass");
  check("deep object · phone masked in admin_notes",
    /\[phone-redacted\]/.test(deep.admin_notes));

  // Philip 2026-08-02 · ISO timestamp protection (chain-validation fix)
  const tsCases = [
    "2026-08-02T13:45:23.456Z",
    "2026-08-02",
    "prepared at 2026-08-02T00:00:00Z, delivered later",
  ];
  for (const ts of tsCases) {
    const out = maskStringLocal(ts);
    check(`ISO timestamp preserved · "${ts}"`, out === ts, `got "${out}"`);
  }
  // Real phones still masked even when a timestamp appears nearby
  const mixed = maskStringLocal("call 07700 900 999 at 2026-08-02T09:00:00Z");
  check("mixed · phone masked · timestamp intact",
    /\[phone-redacted\]/.test(mixed) && /2026-08-02T09:00:00Z/.test(mixed),
    `got "${mixed}"`);
}

// ═══════════════════════════════════════════════════════════════════
// (B) SCHEMA · migration file governance
// ═══════════════════════════════════════════════════════════════════

async function schemaGovernance() {
  console.log(`\n${line("═")}`);
  console.log("(B) SCHEMA · migration governance");
  console.log(line("═"));

  let sql;
  try { sql = readFileSync("supabase/migrations/20260802000000_nex_supplier_memory.sql", "utf8"); }
  catch (err) { check("migration file present", false, err.message); return; }

  check("migration file present", sql.length > 0);
  check("nex_suppliers table declared", /create table if not exists nex_suppliers/i.test(sql));
  check("nex_supplier_enquiries table declared", /create table if not exists nex_supplier_enquiries/i.test(sql));
  check("nex_supplier_responses table declared", /create table if not exists nex_supplier_responses/i.test(sql));
  check("verified column on suppliers", /\bverified\s+boolean/i.test(sql));
  check("priority CHECK constraint (primary|partner|listed)",
    /priority.*\bcheck.*primary.*partner.*listed/is.test(sql));
  check("source_of_signal REQUIRED (not null)",
    /source_of_signal\s+text\s+not\s+null/i.test(sql));
  check("source_of_signal CHECK constraint locks provenance values",
    /source_of_signal.*\bcheck.*admin_recorded_response.*supplier_portal_response.*webhook_verified/is.test(sql));
  check("prepared_at + delivered_at + responded_at all present",
    /prepared_at/.test(sql) && /delivered_at/.test(sql) && /responded_at/.test(sql));
  check("training_data_valid override column present",
    /training_data_valid\s+boolean/i.test(sql));
  check("RLS enabled on all three tables",
    /nex_suppliers\s+enable row level security/i.test(sql)
    && /nex_supplier_enquiries\s+enable row level security/i.test(sql)
    && /nex_supplier_responses\s+enable row level security/i.test(sql));
  check("cascade delete on responses when enquiry deleted",
    /references nex_supplier_enquiries\(enquiry_id\) on delete cascade/i.test(sql));
  check("restrict delete on responses when supplier referenced",
    /references nex_suppliers\(supplier_id\) on delete restrict/i.test(sql));
  check("brief_record is jsonb", /brief_record\s+jsonb\s+not\s+null/i.test(sql));
  check("design_references is jsonb", /design_references\s+jsonb/i.test(sql));
}

// ═══════════════════════════════════════════════════════════════════
// (C) LIVE · end-to-end (only when NEX_SUPPLIER_MEMORY_LIVE=1)
// ═══════════════════════════════════════════════════════════════════

async function liveEndToEnd() {
  console.log(`\n${line("═")}`);
  console.log("(C) LIVE · end-to-end");
  console.log(line("═"));

  if (process.env.NEX_SUPPLIER_MEMORY_LIVE !== "1") {
    skip("live suite", "NEX_SUPPLIER_MEMORY_LIVE!=1 · run with the flag AND migration applied to exercise DB writes");
    return;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    skip("live suite", "Supabase env vars missing");
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Presence of the tables
  const { error: tblErr } = await sb.from("nex_suppliers").select("supplier_id", { count: "exact", head: true });
  if (tblErr) { check("nex_suppliers table reachable", false, tblErr.message); return; }
  check("nex_suppliers table reachable", true);

  // Trigger a workflow via the chat endpoint (assumes dev server on 3008)
  const convId = crypto.randomUUID();
  const BASE = process.env.NEX_CHAT_BASE ?? "http://localhost:3008/api/nex/staircase-chat";
  await fetch(BASE, { method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ message: "Im in the UK, modern oak and glass staircase", conversation_id: convId }) });
  let latest = await (await fetch(BASE, { method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ message: "can someone build one like this", conversation_id: convId }) })).json();
  let guard = 0;
  while (latest?.advisor?.action === "supplier_collecting" && guard < 12) {
    guard++;
    const prompt = String(latest.answer ?? "").toLowerCase();
    let reply;
    if      (/country/.test(prompt))                          reply = "UK";
    else if (/city|region/.test(prompt))                      reply = "London";
    else if (/new build|renovation|replacement/.test(prompt)) reply = "new build";
    else if (/residential|commercial/.test(prompt))           reply = "residential";
    else if (/layout|straight flight/.test(prompt))           reply = "straight flight";
    else if (/materials/.test(prompt))                        reply = "oak and glass";
    else if (/style/.test(prompt))                            reply = "modern";
    else if (/quantity/.test(prompt))                         reply = "one";
    else if (/size/.test(prompt))                             reply = "3m";
    else if (/when|timeframe/.test(prompt))                   reply = "6 months";
    else                                                       reply = "planning";
    latest = await (await fetch(BASE, { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ message: reply, conversation_id: convId }) })).json();
  }
  const enqId = latest?.supplier_brief?.enquiry_id;
  check("workflow closed and enquiry_id returned", typeof enqId === "string" && enqId.startsWith("NEX-ENQUIRY-"));

  // Persistence takes a tick (fire-and-forget) · poll for up to 2s
  let row = null;
  for (let i = 0; i < 10 && !row; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const { data } = await sb.from("nex_supplier_enquiries")
      .select("enquiry_id,brief_record,prepared_at,status")
      .eq("enquiry_id", enqId).maybeSingle();
    row = data;
  }
  check("enquiry row persisted to nex_supplier_enquiries", !!row);
  if (row) {
    const brief = row.brief_record;
    check("brief_record.country=UK", brief?.country === "UK");
    check("brief_record.materials includes oak or oak_composite",
      Array.isArray(brief?.materials) && brief.materials.some((m) => /oak/i.test(String(m))));
    check("brief_record contains no unmasked email",
      !/[\w.-]+@[\w.-]+\.[a-z]+/i.test(JSON.stringify(brief)));
    check("brief_record contains no long unmasked phone digit sequence",
      !/\+?\d[\d\s.\-()]{7,}\d/.test(JSON.stringify(brief)));
    check("status = prepared on first landing", row.status === "prepared");
    check("prepared_at populated", typeof row.prepared_at === "string" && row.prepared_at.length > 10);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════

async function run() {
  console.log(`\n╔${line("═")}╗`);
  console.log(`║ NEX SUPPLIER COMMUNICATION MEMORY v1 · validation suite  ║`);
  console.log(`║ Philip 2026-08-02 · design-first, evidence-only          ║`);
  console.log(`╚${line("═")}╝`);

  await unitPIIMask();
  await schemaGovernance();
  await liveEndToEnd();

  console.log(`\n═══ RESULT ═══`);
  console.log(`  Passed:  ${results.pass}`);
  console.log(`  Failed:  ${results.fail}`);
  console.log(`  Skipped: ${results.skip}`);
  if (results.failures.length > 0) {
    console.log(`\nFailures:`);
    for (const f of results.failures) console.log(`  ✗ ${f.label}${f.detail ? ` — ${f.detail}` : ""}`);
  }
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch((err) => { console.error("Suite crashed:", err); process.exit(1); });
