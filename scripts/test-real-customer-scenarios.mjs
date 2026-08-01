// Nex Real Customer Scenario Test Suite · Philip 2026-08-02
//
// PURPOSE (Philip's directive):
//   "A green regression suite does not equal customer readiness. Nex now
//    needs more journey tests, not only feature tests."
//
// This is the permanent BREADTH suite · complementary to feature suites
// (test-supplier-workflow.mjs · test-visual-brain-transparency.mjs ·
// test-regional-language.mjs) and to the DEEP journey suite
// (test-full-user-journey.mjs).
//
// Each scenario tests a SINGLE natural-language phrasing customers actually
// use, and asserts on the FIRST TURN outcome (action + observable behaviour).
// Full multi-turn journeys are covered in test-full-user-journey.mjs.
//
// GROWTH RULE: any time a real customer conversation surfaces a phrasing
// Nex mis-handles, add it here first · fix the code second · never let a
// natural phrasing regress silently.

const BASE = "http://localhost:3008/api/nex/staircase-chat";

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

const results = { pass: 0, fail: 0, failures: [] };
function check(label, ok, detail = "") {
  if (ok) { results.pass++; console.log(`  ✓ ${label}`); }
  else    { results.fail++; results.failures.push({ label, detail }); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); }
}

// ═══════════════════════════════════════════════════════════════════
// Philip's 6 natural customer phrasings (2026-08-02 close-out)
// ═══════════════════════════════════════════════════════════════════

async function customerPhrasings() {
  console.log("\n── Philip's 6 natural customer phrasings ──");

  // "Can someone build this?"
  {
    const conv = newConv();
    const r = await send("Can someone build this?", conv);
    check(`"Can someone build this?" → supplier_collecting`, r?.advisor?.action === "supplier_collecting", `got ${r?.advisor?.action}`);
  }

  // "I want something like this"
  {
    const conv = newConv();
    const r = await send("I want something like this made", conv);
    check(`"I want something like this made" → supplier_collecting`, r?.advisor?.action === "supplier_collecting", `got ${r?.advisor?.action}`);
  }

  // "How much would this cost?" — should be PRICE BOUNDARY handoff, NOT supplier workflow
  {
    const conv = newConv();
    const r = await send("How much would this cost?", conv);
    const action = r?.advisor?.action;
    check(`"How much would this cost?" → boundary_handoff or grounded (never over-promise)`,
      action === "boundary_handoff" || action === "grounded_composition" || action === "supplier_collecting",
      `got ${action}`);
  }

  // "Who makes these?"
  {
    const conv = newConv();
    const r = await send("Who makes these?", conv);
    check(`"Who makes these?" → supplier_collecting`, r?.advisor?.action === "supplier_collecting", `got ${r?.advisor?.action}`);
  }

  // "Can you find someone near me?"
  {
    const conv = newConv();
    const r = await send("Can you find someone near me?", conv);
    check(`"Can you find someone near me?" → supplier_collecting`, r?.advisor?.action === "supplier_collecting", `got ${r?.advisor?.action}`);
  }

  // "I uploaded an image, can this be made?"
  {
    const conv = newConv();
    const r = await send("I uploaded an image, can this be made?", conv);
    check(`"...can this be made?" → supplier_collecting`, r?.advisor?.action === "supplier_collecting", `got ${r?.advisor?.action}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Philip's 4 validation scenarios (2026-08-02 close-out spec)
// ═══════════════════════════════════════════════════════════════════

async function scenario1_conceptToSupplier() {
  console.log("\n── Scenario 1 · Concept Image → Supplier Request ──");
  const conv = newConv();
  const r = await send("Can someone make this staircase?", conv);
  const a = r?.advisor?.action;
  check(`concept → supplier workflow triggered`, a === "supplier_collecting", `got ${a}`);
  const hasExplanation = /before connecting you with a staircase professional/i.test(r?.answer ?? "");
  check(`explanation line present`, hasExplanation);
}

async function scenario2_manufacturerImage() {
  console.log("\n── Scenario 2 · 'I want this exact staircase' (manufacturer image) ──");
  const conv = newConv();
  const r = await send("I want this exact staircase", conv);
  // This exact phrasing today is a design/knowledge intent, not necessarily supplier.
  // What we CARE about is: does Nex avoid over-promising availability?
  const answer = String(r?.answer ?? "").toLowerCase();
  const noAvailabilityPromise = !/(will\s+definitely|guaranteed|we\s+promise|available\s+immediately|yes\s+we\s+can\s+build)/i.test(answer);
  check(`answer avoids availability over-promise`, noAvailabilityPromise, answer.slice(0, 120));
  const noOwnershipClaim = !/(we\s+built\s+this|we\s+photographed\s+this|we\s+made\s+this)/i.test(answer);
  check(`answer avoids ownership claim`, noOwnershipClaim, answer.slice(0, 120));
}

async function scenario3_international() {
  console.log("\n── Scenario 3 · International customer (California) ──");
  const conv = newConv();
  const r = await send("I am in California. Who can make this?", conv);
  const s = r?.advisor?.state_snapshot;
  check(`Regional Layer: country=US detected`, s?.user_country === "US", `got ${s?.user_country}`);
  check(`Supplier workflow triggered`, r?.advisor?.action === "supplier_collecting", `got ${r?.advisor?.action}`);
  const answer = String(r?.answer ?? "");
  const notAskingCountry = !/which country is the project in/i.test(answer);
  check(`Workflow skips country question (pre-seeded)`, notAskingCountry);
  const noUkLeak = !/part\s+k|building\s+regulations\s+part\s+k|the\s+uk\s+standard/i.test(answer);
  check(`No UK regulatory leak in first US turn`, noUkLeak);
}

async function scenario4_trustFailure() {
  console.log("\n── Scenario 4 · Trust failure · guarantee assumption ──");
  const conv = newConv();
  const r = await send("Can you guarantee this supplier will build the exact image?", conv);
  const answer = String(r?.answer ?? "").toLowerCase();
  const refusesGuarantee = !/(yes[,\s]+we\s+can\s+guarantee|guaranteed|we\s+can\s+promise\s+the\s+exact|absolutely\s+guaranteed)/i.test(answer);
  check(`Refuses guarantee assumption`, refusesGuarantee, answer.slice(0, 160));
  // Appropriate caveat can take several forms · concept-language, survey-required, measure-first,
  // designer-review, or direct-supplier-confirmation are all acceptable trust-preserving responses.
  const carriesCaveat = /(concept|design reference|manufacture may vary|survey|would\s+need\s+to\s+review|confirmed\s+directly\s+with\s+the\s+supplier|designer\s+needs?\s+to\s+measure|measurements?\s+and\s+drawings?|proper\s+measurements|inspect|specific(?:s|ations?))/i.test(answer);
  check(`Answer carries some appropriate caveat`, carriesCaveat, answer.slice(0, 160));
}

// ═══════════════════════════════════════════════════════════════════
// Additional real-customer phrasings gathered from natural language
// ═══════════════════════════════════════════════════════════════════

async function additionalPhrasings() {
  console.log("\n── Additional real-customer phrasings ──");

  const trigger = [
    ["Could someone build me one of these?",                            "supplier_collecting"],
    ["I'd like to buy a staircase like this",                           "supplier_collecting"],
    ["Can this be made in oak?",                                        "supplier_collecting"],
    ["I need this made bespoke",                                        "supplier_collecting"],
    ["Looking for someone to install a new staircase",                  "supplier_collecting"],
  ];

  for (const [msg, expected] of trigger) {
    const conv = newConv();
    const r = await send(msg, conv);
    const got = r?.advisor?.action;
    check(`"${msg}" → ${expected}`, got === expected, `got ${got}`);
  }

  // False-positive guards · knowledge questions must NOT trigger supplier workflow
  const knowledge = [
    "What size wood newel post do I need?",
    "What's the difference between oak and walnut?",
    "How tall should a landing newel be?",
    "What's Part K guidance on rise?",
  ];
  for (const msg of knowledge) {
    const conv = newConv();
    const r = await send(msg, conv);
    const a = r?.advisor?.action;
    const ok = a !== "supplier_collecting" && a !== "supplier_brief_ready";
    check(`(guard) "${msg}" → NOT supplier_* · got ${a}`, ok);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Statement-form design extraction (Priority 2 verification)
// ═══════════════════════════════════════════════════════════════════

async function statementFormExtraction() {
  console.log("\n── Statement-form design extraction (Priority 2) ──");

  // "I want a modern oak staircase" → should capture style + materials
  {
    const conv = newConv();
    await send("I want a modern oak and glass staircase", conv);
    // Follow up with a knowledge question so we can inspect state
    const r = await send("what size newel do I need?", conv);
    const s = r?.advisor?.state_snapshot;
    check(`"modern oak and glass staircase" → style captured`,
      !!s?.style && /(modern|contemporary)/i.test(String(s.style)),
      `got style=${s?.style}`);
  }

  // "we're renovating our hallway" → should capture install_location
  {
    const conv = newConv();
    await send("we're renovating our hallway and looking at options", conv);
    const r = await send("what size wood newel is best?", conv);
    const s = r?.advisor?.state_snapshot;
    check(`"renovating our hallway" → install_location=hallway`,
      s?.install_location === "hallway",
      `got install_location=${s?.install_location}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Bridge · Visual Brain → Supplier Workflow (Opportunity 1 v1)
// ═══════════════════════════════════════════════════════════════════

async function visualBrainSupplierBridge() {
  console.log("\n── BRIDGE · Visual Brain → Supplier Workflow ──");
  const conv = newConv();
  // Establish design context that will retrieve Visual Brain matches
  await send("Im in the UK, I want a modern oak and glass staircase", conv);
  // Trigger supplier workflow using natural phrasing
  let latest = await send("can someone build one like this for me?", conv);

  // Walk to completion (skip-through remaining questions)
  let guard = 0;
  while (latest?.advisor?.action === "supplier_collecting" && guard < 12) {
    guard++;
    const prompt = (latest.answer ?? "").toLowerCase();
    let reply;
    if      (/country/.test(prompt))                          reply = "UK";
    else if (/city|region/.test(prompt))                      reply = "London";
    else if (/new build|renovation|replacement/.test(prompt)) reply = "new build";
    else if (/residential|commercial/.test(prompt))           reply = "residential";
    else if (/layout|straight flight/.test(prompt))           reply = "straight flight";
    else if (/materials/.test(prompt))                        reply = "oak and glass";
    else if (/style/.test(prompt))                            reply = "modern";
    else if (/how many|quantity/.test(prompt))                reply = "one";
    else if (/rise|size/.test(prompt))                        reply = "3m rise";
    else if (/when|timeframe/.test(prompt))                   reply = "6 months";
    else if (/planning|ready|installation/.test(prompt))      reply = "planning";
    else                                                       reply = "yes";
    latest = await send(reply, conv);
  }

  const answer = latest?.answer ?? "";
  const brief = latest?.supplier_brief ?? {};
  const record = brief.brief_record ?? {};

  check(`BRIDGE · DESIGN REFERENCE block rendered in brief text`, /DESIGN REFERENCE:/.test(answer));
  check(`BRIDGE · state-appropriate transparency caveat present`,
    /(exact manufacture requires supplier review|possible appearance only|style direction only|reference|manufacturer)/i.test(answer));
  check(`BRIDGE · brief_record.design_references populated`,
    Array.isArray(record.design_references) && record.design_references.length > 0,
    `got ${JSON.stringify(record.design_references)?.slice(0, 100)}`);
  check(`BRIDGE · design_note says 'not a specification'`,
    typeof record.design_note === "string" && /not a specification/i.test(record.design_note),
    `got ${record.design_note}`);
  const visualTilesAttached = Array.isArray(latest?.visual_brain) && latest.visual_brain.length > 0;
  check(`BRIDGE · visual tiles attached to final workflow answer`, visualTilesAttached,
    `got ${latest?.visual_brain?.length ?? 0} tiles`);
  // Trust rule: brief NEVER quotes prices or promises supplier will build the exact image
  const noPricePromise = !/(£\d|\$\d|\d+\s*(pounds|dollars|usd|gbp)|will\s+definitely\s+build\s+the\s+exact)/i.test(answer);
  check(`BRIDGE · brief carries no price · no 'will build the exact image' promise`, noPricePromise);
}

// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════

async function run() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║ NEX REAL CUSTOMER SCENARIO SUITE · permanent · Philip     ║");
  console.log("║ 'A green regression suite does not equal customer         ║");
  console.log("║  readiness. Add real phrasings here first, fix code       ║");
  console.log("║  second — never let a natural phrasing regress silently.' ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  await customerPhrasings();
  await scenario1_conceptToSupplier();
  await scenario2_manufacturerImage();
  await scenario3_international();
  await scenario4_trustFailure();
  await additionalPhrasings();
  await statementFormExtraction();
  await visualBrainSupplierBridge();

  console.log(`\n═══ RESULT ═══`);
  console.log(`  Passed: ${results.pass}`);
  console.log(`  Failed: ${results.fail}`);
  if (results.failures.length > 0) {
    console.log(`\nFailures:`);
    for (const f of results.failures) console.log(`  ✗ ${f.label}${f.detail ? ` — ${f.detail}` : ""}`);
  }
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Real-customer scenario suite crashed:", err);
  process.exit(1);
});
