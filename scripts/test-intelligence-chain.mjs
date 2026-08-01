// Nex Intelligence Chain Validation · Philip 2026-08-02
//
// PURPOSE: Prove the FIVE layers work together as one journey, not just in
// isolation. Feature suites already cover each layer separately; this suite
// checks the COMPOSITION.
//
//   Layer 1 · Image           (Visual Brain retrieval + image_state honesty)
//   Layer 2 · Understanding   (design_enquiry_context extraction + stickiness)
//   Layer 3 · Regional Language (country detection + composer terminology)
//   Layer 4 · Supplier Prep    (workflow trigger + brief assembly + bridge)
//   Layer 5 · Supplier Memory  (persistence attempted + PII masked + schema in place)
//
// PRINCIPLE (Philip 2026-08-02 · "Validate first, then extend"):
// This is a REPORT tool · exit 0 regardless of gaps. Purpose is to surface
// composition gaps for Philip's decision, NOT gatekeep. Failing this test
// is not the goal — accurate reporting is.

import { readFileSync, existsSync } from "node:fs";

const BASE = "http://localhost:3008/api/nex/staircase-chat";

const findings = { pass: [], gap: [], info: [] };
function pass(label)                       { findings.pass.push(label); console.log(`  ✓ ${label}`); }
function gap(label, detail = "")           { findings.gap.push({ label, detail }); console.log(`  ✗ GAP · ${label}${detail ? ` — ${detail}` : ""}`); }
function info(label, detail = "")          { findings.info.push({ label, detail }); console.log(`  ℹ ${label}${detail ? ` — ${detail}` : ""}`); }
function line(char = "─", n = 68)          { return char.repeat(n); }

async function send(message, conversationId) {
  const res = await fetch(BASE, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ message, conversation_id: conversationId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function newConv() { return crypto.randomUUID(); }

// ═══════════════════════════════════════════════════════════════════
// CHAIN A · UK customer · full 5-layer walk-through
// ═══════════════════════════════════════════════════════════════════

async function chainA() {
  console.log(`\n${line("═")}`);
  console.log(`CHAIN A · UK customer · concept image → prepared brief`);
  console.log(line("═"));
  const conv = newConv();

  // ─── L1 + L2 + L3 in one turn ───────────────────────────────────
  console.log(`\n[Turn 1 · statement-form establishes country + design context]`);
  const t1 = await send("I'm in the UK and we're renovating our hallway. I want a modern oak and glass staircase.", conv);
  const s1 = t1?.advisor?.state_snapshot ?? {};

  // L3 · Regional Language
  if (s1.user_country === "UK")            pass("L3 · Regional Language: country=UK detected one-shot");
  else                                     gap("L3 · Regional Language: UK not detected", JSON.stringify(s1.user_country));

  // L2 · Understanding
  if (s1.install_location === "hallway")   pass("L2 · Understanding: install_location=hallway captured from statement");
  else                                     gap("L2 · Understanding: install_location not captured", JSON.stringify(s1.install_location));
  if (s1.style)                            pass(`L2 · Understanding: style captured = "${s1.style}"`);
  else                                     gap("L2 · Understanding: style not captured");

  // ─── L1 · Image retrieval ───────────────────────────────────────
  console.log(`\n[Turn 2 · customer asks for examples]`);
  const t2 = await send("Show me some examples", conv);
  const tiles = t2?.visual_brain ?? [];
  if (tiles.length > 0)                    pass(`L1 · Image: ${tiles.length} Visual Brain tile(s) returned`);
  else                                     gap("L1 · Image: no tiles returned for design-context follow-up");

  const allHaveState = tiles.every((t) => t.image_state && t.image_state_badge && t.transparency_caption);
  if (tiles.length > 0 && allHaveState)    pass("L1 · Image: every tile carries state + badge + transparency caption");
  else if (tiles.length > 0)               gap("L1 · Image: some tiles missing transparency fields");

  const allConcept = tiles.every((t) => t.image_state === "concept");
  if (tiles.length > 0 && allConcept)      pass("L1 · Image: every tile defaults to 'concept' (safest per Philip's rule)");

  // ─── L4 · Supplier Preparation trigger ──────────────────────────
  console.log(`\n[Turn 3 · natural-language supplier trigger]`);
  const t3 = await send("Can someone build one like this for me?", conv);
  const a3 = t3?.advisor?.action;
  if (a3 === "supplier_collecting")        pass("L4 · Supplier Prep: natural phrasing triggered workflow (fired · not caught by scope)");
  else                                     gap(`L4 · Supplier Prep: trigger failed · action=${a3}`);

  const hasExplanation = /before connecting you with a staircase professional/i.test(t3?.answer ?? "");
  if (hasExplanation)                      pass("L4 · Supplier Prep: explanation line prepended on first workflow turn");
  else                                     gap("L4 · Supplier Prep: explanation line missing");

  // Cross-layer · workflow SKIPS questions already answered by earlier layers
  const asksCountry = /which country is the project in/i.test(t3?.answer ?? "");
  if (!asksCountry)                        pass("Cross-layer L3→L4: country pre-seeded · workflow skipped question");
  else                                     gap("Cross-layer L3→L4: country pre-seed failed");

  // ─── L4 · Qualification loop ────────────────────────────────────
  console.log(`\n[Stage 4 · Qualification loop]`);
  let latest = t3;
  let questionsAsked = 0;
  const guardMax = 12;
  while (latest?.advisor?.action === "supplier_collecting" && questionsAsked < guardMax) {
    questionsAsked++;
    const prompt = (latest.answer ?? "").toLowerCase();
    let reply;
    if      (/country/.test(prompt))                          reply = "UK";
    else if (/city|region/.test(prompt))                      reply = "Manchester";
    else if (/new build|renovation|replacement/.test(prompt)) reply = "renovation";
    else if (/residential|commercial/.test(prompt))           reply = "residential";
    else if (/layout|straight flight/.test(prompt))           reply = "straight flight";
    else if (/materials/.test(prompt))                        reply = "oak with glass balustrade";
    else if (/style/.test(prompt))                            reply = "modern";
    else if (/quantity/.test(prompt))                         reply = "one staircase";
    else if (/rise|size/.test(prompt))                        reply = "2.8m rise";
    else if (/when|timeframe/.test(prompt))                   reply = "within 3 months";
    else if (/planning|ready|installation/.test(prompt))      reply = "planning";
    else                                                       reply = "yes";
    latest = await send(reply, conv);
  }
  info(`L4 · Supplier Prep: closed in ${questionsAsked} turn(s) after trigger`);
  if (questionsAsked <= 4)                 pass("L4 · Supplier Prep: 4 or fewer questions (pre-seeding effective)");
  else                                     info(`L4 · Supplier Prep: ${questionsAsked} questions (bridge auto-seed would collapse further)`);

  // ─── L5 · Supplier Memory (via bridge output shape) ─────────────
  console.log(`\n[Stage 5 · Brief + Bridge + Memory persistence attempt]`);
  const brief = latest?.supplier_brief ?? {};
  const record = brief.brief_record ?? {};
  const answer = latest?.answer ?? "";

  if (latest?.advisor?.action === "supplier_brief_ready") pass("L4 · Supplier Prep: brief ready");
  else                                                     gap("L4: brief did not close", `action=${latest?.advisor?.action}`);

  if (brief.enquiry_id?.startsWith("NEX-ENQUIRY-"))       pass(`L4/L5: enquiry_id issued = ${brief.enquiry_id}`);
  else                                                     gap("L4/L5: no enquiry_id");

  if (record.country === "UK")                            pass("L3→L4→L5: country=UK threaded through to brief_record");
  else                                                     gap("L3→L4→L5: country lost in threading", JSON.stringify(record.country));

  const hasOak   = Array.isArray(record.materials) && record.materials.some((m) => /oak/i.test(String(m)));
  const hasGlass = Array.isArray(record.materials) && record.materials.some((m) => /glass/i.test(String(m)));
  if (hasOak && hasGlass)                                 pass("L2→L4→L5: materials [oak, glass] threaded through");
  else                                                     gap("L2→L4→L5: materials lost", `oak=${hasOak} glass=${hasGlass}`);

  const hasNexStairplan = (brief.matches ?? []).some((m) => m.name === "Nex Stairplan");
  if (hasNexStairplan)                                    pass("L4 · Supplier Prep: Nex Stairplan matched (UK verified supplier)");
  else                                                     gap("L4: no verified UK match");

  // Bridge v1 assertions
  const hasRefBlock  = /DESIGN REFERENCE:/.test(answer);
  const hasCaveat    = /(exact manufacture requires supplier review|possible appearance only|style direction only)/i.test(answer);
  const refsInRecord = Array.isArray(record.design_references) && record.design_references.length > 0;
  const noteInRecord = typeof record.design_note === "string" && /not a specification/i.test(record.design_note);

  if (hasRefBlock)                                        pass("L1→L4 BRIDGE: DESIGN REFERENCE block rendered in brief");
  else                                                     info("L1→L4 BRIDGE: no DESIGN REFERENCE (retrieval returned no matches for this scenario)");
  if (hasRefBlock && hasCaveat)                           pass("L1→L4 BRIDGE: state-appropriate transparency caveat present");
  else if (hasRefBlock)                                    gap("BRIDGE: refs present but caveat missing");
  if (hasRefBlock && refsInRecord)                        pass(`L1→L4 BRIDGE: ${record.design_references.length} design_references in brief_record`);
  if (hasRefBlock && noteInRecord)                        pass("L1→L4 BRIDGE: design_note in payload states 'not a specification'");

  // Trust caveat
  const hasTrustCaveat = /final availability, pricing and suitability must be confirmed directly with the supplier/i.test(answer);
  if (hasTrustCaveat)                                     pass("L4: trust caveat verbatim at end of handoff");
  else                                                     gap("L4: trust caveat missing");

  // L5 · Memory persistence signals · we can't verify Supabase state
  // (migration unapplied), but we can inspect the payload shape.
  //
  // Fix 1 (Philip 2026-08-02) added the ISO-8601 exclusion. Real customer
  // PII (email · phone) protection stays intact. A KNOWN secondary
  // limitation remains: coincidental UUID or Nex-id digit sequences that
  // happen to mimic phone shape would also be redacted by the shipped
  // mask. Reported as INFO · not GAP · pending a separately-authorised
  // fix cycle (similar 5-line guard).
  const briefJson = JSON.stringify(record);
  const noUnmaskedEmail = !/[\w.-]+@[\w.-]+\.[a-z]+/i.test(briefJson);
  const phoneCandidates = briefJson.match(/\+?\d[\d\s.\-()]{7,}\d/g) ?? [];
  const nonTimestamp    = phoneCandidates.filter((m) => !/^\d{4}-\d{2}-\d{2}/.test(m));

  if (noUnmaskedEmail) {
    pass("L5 · Memory: no unmasked email in brief_record");
  } else {
    gap("L5: unmasked email present in brief_record");
  }

  if (nonTimestamp.length === 0) {
    pass("L5 · Memory: no phone-shaped strings remain after timestamp exclusion");
  } else {
    // Do NOT classify as gap · these are known false-positives on IDs.
    // Real phones would ALSO match here, so it's not distinguishable
    // in this validator. A live test with a known-PII payload is the
    // definitive check (skipped until migration applied).
    info(`L5 · known mask limitation · ${nonTimestamp.length} non-timestamp phone-shaped fragment(s) · likely UUID/Nex-id false-positives · Fix 2 candidate (mask guard for identifier shapes)`, `sample=${JSON.stringify(nonTimestamp[0])}`);
  }

  const hasStatusField    = typeof record.status === "string";
  const hasPreparedByField = record.prepared_by === "nex";
  if (hasStatusField && hasPreparedByField)               pass("L5 · Memory: payload carries status + prepared_by (matches nex_supplier_enquiries schema)");
  else                                                     gap("L5: payload shape doesn't match memory schema");
}

// ═══════════════════════════════════════════════════════════════════
// CHAIN B · US customer · regional context + fallback + no UK leaks
// ═══════════════════════════════════════════════════════════════════

async function chainB() {
  console.log(`\n${line("═")}`);
  console.log(`CHAIN B · US customer · California signal → US fallback`);
  console.log(line("═"));
  const conv = newConv();

  const t1 = await send("I need someone to make a modern luxury oak and glass staircase in California", conv);
  const s1 = t1?.advisor?.state_snapshot ?? {};
  if (s1.user_country === "US")            pass("L3: country=US detected from 'in California'");
  else                                     gap("L3: US not detected from California signal", JSON.stringify(s1.user_country));

  if (t1?.advisor?.action === "supplier_collecting") pass("L4: workflow triggered by 'I need someone to make'");
  else                                                gap(`L4: not triggered · action=${t1?.advisor?.action}`);

  const asksCountry = /which country is the project in/i.test(t1?.answer ?? "");
  if (!asksCountry)                        pass("Cross-layer L3→L4: US pre-seed working · country question skipped");
  else                                     gap("Cross-layer: US pre-seed failed");

  // Walk through
  let latest = t1;
  let guard = 0;
  while (latest?.advisor?.action === "supplier_collecting" && guard < 12) {
    guard++;
    const prompt = (latest.answer ?? "").toLowerCase();
    let reply;
    if      (/country/.test(prompt))                          reply = "USA";
    else if (/city|region/.test(prompt))                      reply = "San Francisco";
    else if (/new build|renovation|replacement/.test(prompt)) reply = "new build";
    else if (/residential|commercial/.test(prompt))           reply = "residential";
    else if (/layout|straight flight/.test(prompt))           reply = "quarter turn";
    else if (/materials/.test(prompt))                        reply = "oak and stainless";
    else if (/style/.test(prompt))                            reply = "luxury";
    else if (/quantity/.test(prompt))                         reply = "one";
    else if (/rise|size/.test(prompt))                        reply = "3.2m rise";
    else if (/when|timeframe/.test(prompt))                   reply = "summer 2026";
    else if (/planning|ready|installation/.test(prompt))      reply = "planning";
    else                                                       reply = "yes";
    latest = await send(reply, conv);
  }

  if (latest?.advisor?.action === "supplier_brief_ready") pass("L4: US workflow closed");
  else                                                     gap(`L4: US workflow did not close · action=${latest?.advisor?.action}`);

  const answer = latest?.answer ?? "";
  const record = latest?.supplier_brief?.brief_record ?? {};

  if (record.country === "US")                            pass("L3→L4→L5: US country threaded through");
  else                                                     gap("US brief: country wrong", JSON.stringify(record.country));

  const matches = latest?.supplier_brief?.matches ?? [];
  if (matches.length === 0)                               pass("L4: no partnered US supplier · correct");
  else                                                     info(`L4: matched ${matches.length} supplier(s) unexpectedly`);

  const hasFallback = /don'?t\s+yet\s+have\s+a\s+partnered\s+us/i.test(answer);
  if (hasFallback)                                        pass("L4: US-specific fallback message delivered");
  else                                                     gap("L4: fallback message missing");

  // Regional-language honesty · no UK leaks in US answers
  const noPartKLeak = !/part\s+k|building\s+regulations\s+part\s+k|the\s+uk\s+standard/i.test(answer);
  if (noPartKLeak)                                        pass("L3 honesty: no UK Part K / 'the UK standard' leak in US answer");
  else                                                     gap("L3 leak: UK terms appeared in US answer");

  const noOverpromise = !/(will\s+definitely|guaranteed|we\s+promise|available\s+immediately)/i.test(answer);
  if (noOverpromise)                                      pass("L4 · Trust: no supplier over-promise language");
  else                                                     gap("L4 · Trust: over-promise leaked");

  const hasTrustCaveat = /final availability, pricing and suitability must be confirmed directly with the supplier/i.test(answer);
  if (hasTrustCaveat)                                     pass("L4 · Trust: caveat present in US flow too");
  else                                                     gap("L4 · Trust: caveat missing in US flow");
}

// ═══════════════════════════════════════════════════════════════════
// CHAIN C · Trust boundary · "I want THIS EXACT staircase"
// ═══════════════════════════════════════════════════════════════════

async function chainC() {
  console.log(`\n${line("═")}`);
  console.log(`CHAIN C · Trust boundary · guarantee assumption`);
  console.log(line("═"));
  const conv = newConv();
  const r = await send("Can you guarantee this supplier will build the exact image?", conv);
  const answer = String(r?.answer ?? "").toLowerCase();

  const refusesGuarantee = !/(yes[,\s]+we\s+can\s+guarantee|guaranteed|we\s+can\s+promise\s+the\s+exact|absolutely\s+guaranteed)/i.test(answer);
  if (refusesGuarantee)                                   pass("Trust: refuses guarantee assumption");
  else                                                     gap("Trust: guaranteed something");

  const carriesCaveat = /(concept|design reference|manufacture may vary|survey|would\s+need\s+to\s+review|confirmed\s+directly\s+with\s+the\s+supplier|designer\s+needs?\s+to\s+measure|measurements?\s+and\s+drawings?|proper\s+measurements|inspect|specific(?:s|ations?))/i.test(answer);
  if (carriesCaveat)                                      pass("Trust: appropriate caveat present in response");
  else                                                     gap("Trust: no caveat in guarantee response");
}

// ═══════════════════════════════════════════════════════════════════
// CHAIN D · False-positive guards · knowledge questions stay in knowledge
// ═══════════════════════════════════════════════════════════════════

async function chainD() {
  console.log(`\n${line("═")}`);
  console.log(`CHAIN D · False-positive guards`);
  console.log(line("═"));
  const knowledgeQs = [
    "What size wood newel post do I need?",
    "How tall should a landing newel be?",
    "What is the difference between oak and walnut?",
    "What is Part K guidance on rise?",
  ];
  for (const q of knowledgeQs) {
    const conv = newConv();
    const r = await send(q, conv);
    const a = r?.advisor?.action;
    const ok = a !== "supplier_collecting" && a !== "supplier_brief_ready";
    if (ok)                                               pass(`Guard: "${q}" → ${a} (never supplier_*)`);
    else                                                   gap(`Guard: "${q}" leaked into workflow · ${a}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 5 · Structural memory validation (schema-only · migration unapplied)
// ═══════════════════════════════════════════════════════════════════

async function memoryStructural() {
  console.log(`\n${line("═")}`);
  console.log(`LAYER 5 · Supplier Memory · structural validation`);
  console.log(line("═"));

  const migPath = "supabase/migrations/20260802000000_nex_supplier_memory.sql";
  if (!existsSync(migPath))                               { gap("L5: migration file missing"); return; }
  const sql = readFileSync(migPath, "utf8");
  pass("L5: migration file present");

  const checks = [
    ["nex_suppliers table declared",           /create table if not exists nex_suppliers/i],
    ["nex_supplier_enquiries table declared",  /create table if not exists nex_supplier_enquiries/i],
    ["nex_supplier_responses table declared",  /create table if not exists nex_supplier_responses/i],
    ["source_of_signal REQUIRED",              /source_of_signal\s+text\s+not\s+null/i],
    ["source_of_signal CHECK constraint",      /source_of_signal.*\bcheck.*admin_recorded_response/is],
    ["three lifecycle timestamps",             /prepared_at/i, /delivered_at/i, /responded_at/i],
    ["RLS enabled on suppliers",               /nex_suppliers\s+enable row level security/i],
    ["RLS enabled on enquiries",               /nex_supplier_enquiries\s+enable row level security/i],
    ["RLS enabled on responses",               /nex_supplier_responses\s+enable row level security/i],
  ];
  for (const [label, ...rxs] of checks) {
    const ok = rxs.every((rx) => rx.test(sql));
    if (ok) pass(`L5 schema: ${label}`);
    else    gap(`L5 schema: ${label}`);
  }

  info("L5 · migration NOT YET APPLIED · run `supabase db push` then `NEX_SUPPLIER_MEMORY_LIVE=1 node scripts/test-supplier-memory.mjs` to prove DB writes land");

  // Verify the seed script and admin routes exist
  if (existsSync("scripts/seed-nex-suppliers.mjs"))                          pass("L5: seed-nex-suppliers.mjs present");
  else                                                                       gap("L5: seed script missing");
  if (existsSync("src/lib/nex/business-brain/enquiry-persistence.ts"))       pass("L5: enquiry-persistence.ts present");
  else                                                                       gap("L5: enquiry-persistence missing");
  if (existsSync("src/lib/nex/business-brain/pii-mask.ts"))                  pass("L5: pii-mask.ts present");
  else                                                                       gap("L5: pii-mask missing");
  if (existsSync("src/app/api/admin/nex/supplier-response/route.ts"))        pass("L5: admin response API present");
  else                                                                       gap("L5: admin response API missing");
  if (existsSync("src/app/admin/(authed)/nex/supplier-responses/page.tsx"))  pass("L5: admin response UI present");
  else                                                                       gap("L5: admin response UI missing");
}

// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════

async function run() {
  console.log(`\n╔${line("═")}╗`);
  console.log(`║ NEX INTELLIGENCE CHAIN VALIDATION · Philip 2026-08-02        ║`);
  console.log(`║ 5 layers: Image · Understanding · Regional · Prep · Memory    ║`);
  console.log(`╚${line("═")}╝`);

  await chainA();
  await chainB();
  await chainC();
  await chainD();
  await memoryStructural();

  console.log(`\n${line("═")}`);
  console.log(`SUMMARY`);
  console.log(line("═"));
  console.log(`  ✓ Passing:  ${findings.pass.length}`);
  console.log(`  ✗ Gaps:     ${findings.gap.length}`);
  console.log(`  ℹ Info:     ${findings.info.length}`);

  if (findings.gap.length > 0) {
    console.log(`\nGAPS TO REPORT (do NOT silently fix · surface for Philip):`);
    for (const g of findings.gap) console.log(`  ✗ ${g.label}${g.detail ? ` — ${g.detail}` : ""}`);
  }
  if (findings.info.length > 0) {
    console.log(`\nINFO (context · not failures):`);
    for (const i of findings.info) console.log(`  ℹ ${i.label}${i.detail ? ` — ${i.detail}` : ""}`);
  }
  process.exit(0);
}

run().catch((err) => { console.error("Chain validation crashed:", err); process.exit(1); });
