// Full user journey validation · Philip 2026-08-02
//
// "Image → Understanding → Qualification → Supplier Preparation → Professional Connection"
//
// This is the "commercially different" test. It walks the complete journey
// end-to-end and asserts on the composition of the three newest intelligence
// layers: Regional Language Layer + Visual Brain Connection v1 + Supplier
// Preparation Workflow v1.1.
//
// PRINCIPLE (Philip 2026-08-02 · "Validate first, then extend"):
// This test is designed to SURFACE GAPS, not hide them. When a step doesn't
// yet compose correctly (e.g. image concept-caveat not carried into the
// supplier handoff), the test reports it as an INFO finding rather than
// silently succeeding. Passing this test is not the goal — accurate
// reporting is the goal.

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

function newConv() {
  return crypto.randomUUID();
}

function line(char = "─", n = 60) {
  return char.repeat(n);
}

const findings = { pass: [], gap: [], info: [] };
function pass(label)             { findings.pass.push(label); console.log(`  ✓ ${label}`); }
function gap(label, detail = "") { findings.gap.push({ label, detail }); console.log(`  ✗ GAP · ${label}${detail ? ` — ${detail}` : ""}`); }
function info(label, detail = "") { findings.info.push({ label, detail }); console.log(`  ℹ ${label}${detail ? ` — ${detail}` : ""}`); }

// ═══════════════════════════════════════════════════════════════════
// SCENARIO A · UK CUSTOMER · MODERN OAK + GLASS · HALLWAY RENOVATION
// ═══════════════════════════════════════════════════════════════════
async function scenarioA() {
  console.log(`\n${line("═")}`);
  console.log(`SCENARIO A · UK · modern oak + glass · hallway renovation`);
  console.log(`${line("═")}`);
  const conv = newConv();

  // ─── STAGE 1 · IMAGE + REGIONAL CONTEXT ─────────────────────────
  console.log(`\n[Stage 1 · Image + Regional context]`);
  const t1 = await send("I'm in the UK and we're renovating our hallway. I want a modern oak and glass staircase.", conv);
  const s1 = t1?.advisor?.state_snapshot ?? {};
  if (s1.user_country === "UK")            pass("Regional Layer: country=UK detected in one shot");
  else                                     gap("Regional Layer: country not detected", JSON.stringify(s1.user_country));
  if (s1.install_location)                 pass(`Advisor: install_location captured = "${s1.install_location}"`);
  else                                     info("Advisor: install_location not captured on first turn (may need design-enquiry trigger)");
  if (s1.style)                            pass(`Advisor: style captured = "${s1.style}"`);
  else                                     info("Advisor: style not captured on first turn");

  // ─── STAGE 2 · VISUAL BRAIN RETRIEVAL ───────────────────────────
  console.log(`\n[Stage 2 · Visual Brain retrieval]`);
  const t2 = await send("Show me some examples", conv);
  const tiles = t2?.visual_brain ?? [];
  if (tiles.length > 0)                    pass(`Visual Brain: ${tiles.length} tile(s) returned for "show me examples" follow-up`);
  else                                     gap("Visual Brain: no tiles returned when customer asked for examples");

  const allConcept = tiles.every((t) => t.image_state === "concept");
  if (tiles.length > 0 && allConcept)      pass("Visual Brain: every tile carries image_state=concept (safest default)");
  else if (tiles.length > 0)               info("Visual Brain: mixed image states present · promoted records exist");

  const captions = tiles.map((t) => t.transparency_caption).filter(Boolean);
  if (tiles.length > 0 && captions.length === tiles.length) pass("Visual Brain: every tile carries prescribed transparency caption");
  else if (tiles.length > 0)                                gap("Visual Brain: some tiles missing transparency caption", `${captions.length}/${tiles.length}`);

  // ─── STAGE 3 · SUPPLIER INTENT (REFERRING TO IMAGE) ─────────────
  console.log(`\n[Stage 3 · Supplier intent · "can someone build one like this"]`);
  const t3 = await send("Can someone build one like this for me?", conv);
  const a3 = t3?.advisor?.action;
  if (a3 === "supplier_collecting")        pass("Supplier Workflow: trigger detected · action=supplier_collecting");
  else                                     gap("Supplier Workflow: trigger NOT detected", `action=${a3}`);

  const hasExplanation = /before connecting you with a staircase professional/i.test(t3?.answer ?? "");
  if (hasExplanation)                      pass("Step 2: explanation line prepended on first workflow turn");
  else                                     gap("Step 2: explanation line missing on first workflow turn");

  // CROSS-LAYER: does the workflow acknowledge the concept-image caveat?
  // Philip 2026-08-02 · Opportunity 1 · Bridge v1 shipped · this assertion is
  // deferred to the FINAL-BRIEF stage (below) where the caveat lives · during
  // the collecting phase we only ask a question, no design references yet.
  info("Cross-layer BRIDGE: caveat assertion deferred to brief stage (bridge fires when brief assembles, not per collection turn)");

  // CROSS-LAYER: does the workflow already know country=UK from the Regional Layer?
  // If yes, it should NOT ask for country as its next question.
  const promptLower = (t3?.answer ?? "").toLowerCase();
  const asksCountry = /which country is the project in/.test(promptLower);
  if (!asksCountry)                        pass("Cross-layer: workflow skipped country question · Regional Layer pre-seed working");
  else                                     gap("Cross-layer: workflow asked for country despite Regional Layer knowing UK");

  // ─── STAGE 4 · QUALIFICATION LOOP ───────────────────────────────
  console.log(`\n[Stage 4 · Qualification loop]`);
  let latest = t3;
  let questionsAsked = 0;
  const askedFields = [];
  const guard = 12;
  while (latest?.advisor?.action === "supplier_collecting" && questionsAsked < guard) {
    questionsAsked++;
    const prompt = (latest.answer ?? "").toLowerCase();
    askedFields.push(prompt.split(".")[0].slice(0, 60));
    let reply;
    if      (/country/.test(prompt))                          reply = "UK";
    else if (/city|region/.test(prompt))                      reply = "Manchester";
    else if (/new build|renovation|replacement/.test(prompt)) reply = "renovation";
    else if (/residential|commercial/.test(prompt))           reply = "residential";
    else if (/layout|straight flight|quarter/.test(prompt))   reply = "straight flight";
    else if (/materials/.test(prompt))                        reply = "oak with glass balustrade";
    else if (/style/.test(prompt))                            reply = "modern";
    else if (/how many|quantity/.test(prompt))                reply = "one staircase";
    else if (/rise|size/.test(prompt))                        reply = "2.8m rise";
    else if (/when|timeframe/.test(prompt))                   reply = "within 3 months";
    else if (/planning|ready|installation/.test(prompt))      reply = "planning";
    else                                                       reply = "yes";
    latest = await send(reply, conv);
  }
  info(`Qualification took ${questionsAsked} turn(s) after trigger`);
  if (questionsAsked <= 4)                 pass("Qualification: 4 or fewer questions after trigger (pre-seeding effective)");
  else                                     info(`Qualification: ${questionsAsked} questions after trigger (Visual-Brain-→-Supplier bridge would collapse this to 1-2)`);

  // ─── STAGE 5 · SUPPLIER BRIEF + PROFESSIONAL CONNECTION ────────
  console.log(`\n[Stage 5 · Brief + Professional connection]`);
  if (latest?.advisor?.action === "supplier_brief_ready") pass("Workflow closed: action=supplier_brief_ready");
  else                                                    gap("Workflow did not close", `final action=${latest?.advisor?.action}`);

  const brief = latest?.supplier_brief;
  if (brief?.enquiry_id?.startsWith("NEX-ENQUIRY-")) pass(`Enquiry id issued: ${brief.enquiry_id}`);
  else                                                gap("No enquiry_id");

  const record = brief?.brief_record ?? {};
  if (record.country === "UK")                       pass("Brief: country=UK");
  else                                                gap("Brief: country wrong", JSON.stringify(record.country));
  if (Array.isArray(record.materials) && record.materials.some((m) => /oak/i.test(m)))
                                                     pass(`Brief: materials include oak · ${record.materials.join(", ")}`);
  else                                                gap("Brief: materials missing oak", JSON.stringify(record.materials));
  if (Array.isArray(record.materials) && record.materials.some((m) => /glass/i.test(m)))
                                                     pass("Brief: materials include glass");
  else                                                gap("Brief: materials missing glass", JSON.stringify(record.materials));
  if (record.staircase_type)                         pass(`Brief: staircase_type=${record.staircase_type}`);
  else                                                gap("Brief: staircase_type missing");
  if (record.design_style === "modern")              pass(`Brief: design_style=modern`);
  else                                                info(`Brief: design_style=${record.design_style} (expected 'modern' — style extraction from freeform text has limits)`);
  if (record.status === "customer_looking_for_manufacturer") pass("Brief: status=customer_looking_for_manufacturer");
  else                                                       gap("Brief: status wrong", JSON.stringify(record.status));

  const matches = brief?.matches ?? [];
  if (matches.some((m) => m.name === "Nex Stairplan")) pass("Professional connection: Nex Stairplan matched (UK verified supplier)");
  else                                                  gap("Professional connection: Nex Stairplan not matched for UK", JSON.stringify(matches.map((m) => m.name)));

  const answer = latest?.answer ?? "";
  const hasTrustCaveat = /final availability, pricing and suitability must be confirmed directly with the supplier/i.test(answer);
  if (hasTrustCaveat)                                pass("Trust caveat: appended verbatim at end of handoff");
  else                                                gap("Trust caveat: missing");

  const briefBlockPresent = /PROJECT TYPE:/.test(answer) && /LOCATION:/.test(answer) && /MATERIALS:/.test(answer) && /STATUS:/.test(answer);
  if (briefBlockPresent)                             pass("Brief block: PROJECT TYPE · LOCATION · MATERIALS · STATUS all present");
  else                                                gap("Brief block: malformed");

  // Philip 2026-08-02 · Opportunity 1 · Bridge v1 assertions.
  // When Visual Brain matches were retrievable during workflow, the brief now
  // carries a DESIGN REFERENCE block + the state-appropriate transparency caveat.
  // Assertions are SOFT · bridge only fires when visual matches were returned.
  const hasDesignRefBlock = /DESIGN REFERENCE:/.test(answer);
  const hasBridgeCaveat = /(exact manufacture requires supplier review|possible appearance only|style direction only)/i.test(answer);
  const bridgeRefsInPayload = Array.isArray(record.design_references) && record.design_references.length > 0;
  if (hasDesignRefBlock)                             pass("BRIDGE v1: DESIGN REFERENCE block rendered in brief");
  else                                                info("BRIDGE v1: no DESIGN REFERENCE block (no Visual Brain matches for this scenario · not a gap)");
  if (hasBridgeCaveat)                               pass("BRIDGE v1: state-appropriate transparency caveat present");
  else if (hasDesignRefBlock)                        gap("BRIDGE v1: DESIGN REFERENCE present but no caveat (should never happen)");
  if (bridgeRefsInPayload)                           pass(`BRIDGE v1: ${record.design_references.length} design_reference(s) in brief_record for CRM ingestion`);
  else if (hasDesignRefBlock)                        gap("BRIDGE v1: DESIGN REFERENCE in text but design_references missing from record");
  const noteInPayload = record.design_note && /not a specification/i.test(String(record.design_note));
  if (noteInPayload)                                 pass("BRIDGE v1: design_note in payload states 'not a specification'");
  else if (hasDesignRefBlock)                        gap("BRIDGE v1: design_note missing when references present");

  return { conv, questionsAsked, answer };
}

// ═══════════════════════════════════════════════════════════════════
// SCENARIO B · US CUSTOMER · REGIONAL COMPOSITION · CALIFORNIA
// ═══════════════════════════════════════════════════════════════════
async function scenarioB() {
  console.log(`\n${line("═")}`);
  console.log(`SCENARIO B · US · "I need someone to make a staircase like this in California"`);
  console.log(`${line("═")}`);
  const conv = newConv();

  const t1 = await send("I need someone to make a staircase like this in California", conv);
  const s1 = t1?.advisor?.state_snapshot ?? {};
  if (s1.user_country === "US")            pass("Regional Layer: country=US detected in one shot (California signal)");
  else                                     gap("Regional Layer: US not detected from 'California'", JSON.stringify(s1.user_country));

  if (t1?.advisor?.action === "supplier_collecting") pass("Supplier Workflow: triggered by 'need someone to make'");
  else                                                gap("Supplier Workflow: not triggered", `action=${t1?.advisor?.action}`);

  const asksCountry = /which country is the project in/.test((t1?.answer ?? "").toLowerCase());
  if (!asksCountry)                                  pass("Cross-layer: workflow skipped country question · Regional Layer pre-seed working");
  else                                                gap("Cross-layer: workflow asked for country despite California signal");

  // Fill through
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
    else if (/layout|straight flight|quarter/.test(prompt))   reply = "curved";
    else if (/materials/.test(prompt))                        reply = "oak with stainless steel";
    else if (/style/.test(prompt))                            reply = "modern";
    else if (/how many|quantity/.test(prompt))                reply = "one";
    else if (/rise|size/.test(prompt))                        reply = "3.2m rise";
    else if (/when|timeframe/.test(prompt))                   reply = "summer 2026";
    else if (/planning|ready|installation/.test(prompt))      reply = "planning";
    else                                                       reply = "yes";
    latest = await send(reply, conv);
  }

  if (latest?.advisor?.action === "supplier_brief_ready") pass("US workflow closed");
  else                                                    gap("US workflow did not close", `final=${latest?.advisor?.action}`);

  const record = latest?.supplier_brief?.brief_record ?? {};
  if (record.country === "US")                       pass("US brief: country=US");
  else                                                gap("US brief: country wrong", JSON.stringify(record.country));

  const matches = latest?.supplier_brief?.matches ?? [];
  if (matches.length === 0)                          pass("US: no partnered supplier matched (correct · registry has none)");
  else                                                info(`US: matched ${matches.length} supplier(s) unexpectedly · check registry`);

  const answer = latest?.answer ?? "";
  const hasFallback = /don'?t\s+yet\s+have\s+a\s+partnered\s+us/i.test(answer);
  if (hasFallback)                                   pass("US: generic fallback message delivered (honest 'no partnered US supplier')");
  else                                                gap("US: fallback message missing");

  const noUkAssumption = !/part\s+k|building\s+regulations\s+part\s+k|the\s+uk\s+standard/i.test(answer);
  if (noUkAssumption)                                pass("US: answer avoids UK regulatory assumptions (Part K, 'the UK standard')");
  else                                                gap("US: answer leaked UK regulatory assumptions", answer.slice(0, 200));

  const noSupplierPromise = !/(will\s+definitely|guaranteed|we\s+promise|available\s+immediately)/i.test(answer);
  if (noSupplierPromise)                             pass("US: answer avoids over-promising supplier availability");
  else                                                gap("US: answer over-promised availability", answer.slice(0, 200));

  const hasTrustCaveat = /final availability, pricing and suitability must be confirmed directly with the supplier/i.test(answer);
  if (hasTrustCaveat)                                pass("US: trust caveat present");
  else                                                gap("US: trust caveat missing");
}

// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════
async function run() {
  console.log(`\n╔${line("═")}╗`);
  console.log(`║ NEX FULL USER JOURNEY VALIDATION · Philip 2026-08-02          ║`);
  console.log(`║ Image → Understanding → Qualification → Preparation →         ║`);
  console.log(`║                                    Professional Connection    ║`);
  console.log(`╚${line("═")}╝`);

  await scenarioA();
  await scenarioB();

  console.log(`\n${line("═")}`);
  console.log(`SUMMARY`);
  console.log(`${line("═")}`);
  console.log(`  ✓ Passing assertions:  ${findings.pass.length}`);
  console.log(`  ✗ Gaps surfaced:       ${findings.gap.length}`);
  console.log(`  ℹ Info findings:       ${findings.info.length}`);

  if (findings.gap.length > 0) {
    console.log(`\nGAPS TO REPORT (do NOT silently fix · surface for Philip's decision):`);
    for (const g of findings.gap) {
      console.log(`  ✗ ${g.label}${g.detail ? ` — ${g.detail}` : ""}`);
    }
  }
  if (findings.info.length > 0) {
    console.log(`\nINFO FINDINGS (context · not failures):`);
    for (const f of findings.info) {
      console.log(`  ℹ ${f.label}${f.detail ? ` — ${f.detail}` : ""}`);
    }
  }

  // Exit 0 · this is a validation report, not a pass/fail suite.
  // The whole point is to surface gaps honestly, not to gatekeep merges.
  process.exit(0);
}

run().catch((err) => {
  console.error("Journey validation crashed:", err);
  process.exit(1);
});
