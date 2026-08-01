// Business Brain · Supplier Preparation Workflow v1 regression
// Philip 2026-08-02 · Priority 3 intelligence layer.
//
// Verifies:
//   (1) supplier intent triggers the workflow (not grounded_composition)
//   (2) four-step conversation: collecting → explanation → brief → handoff
//   (3) Regional Language Layer country is honoured (UK/IE → Nex Stairplan · US → generic fallback)
//   (4) Supplier Brief carries every required field
//   (5) mid-workflow short answers ("oak", "3m rise") don't get bounced by scope classifier
//   (6) architecture rule: enquiry_id is issued and threads through the response

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

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  console.log("\n═══ SUPPLIER PREPARATION WORKFLOW v1 · Priority 3 intelligence layer ═══\n");

  // ─── UK customer · full workflow to Nex Stairplan handoff ─────
  console.log("── UK CUSTOMER · FULL WORKFLOW ──");
  {
    const conv = newConv();
    const r1 = await send("Im in the UK", conv);
    const r2 = await send("Who can make this oak and glass staircase?", conv);

    const action = r2?.advisor?.action;
    const t1Ok = action === "supplier_collecting";
    console.log(`  ${t1Ok ? "✓" : "✗"} Turn 2 action = ${action} (expected supplier_collecting)`);
    if (t1Ok) passed++; else { failed++; failures.push({ turn: 2, action }); }

    // Explanation line should appear on first workflow turn
    const hasExplanation = /before connecting you with a staircase professional/i.test(r2?.answer ?? "");
    console.log(`  ${hasExplanation ? "✓" : "✗"} Explanation line present on first workflow turn`);
    if (hasExplanation) passed++; else { failed++; failures.push({ turn: 2, note: "no explanation" }); }

    // Fill in the required fields step by step
    // country + oak seed already provided · workflow will ask remaining required fields
    let latest = r2;
    let guard = 0;
    while (latest?.advisor?.action === "supplier_collecting" && guard < 10) {
      guard++;
      // Sensible answer per prompt · uses keywords the extractor picks up
      const prompt = latest.answer.toLowerCase();
      let answer;
      if      (/country/.test(prompt))                          answer = "UK";
      else if (/city|region/.test(prompt))                      answer = "Manchester";
      else if (/new build|renovation|replacement/.test(prompt)) answer = "new build";
      else if (/layout|straight flight|quarter/.test(prompt))   answer = "straight flight";
      else if (/materials/.test(prompt))                        answer = "oak and glass balustrade";
      else if (/style/.test(prompt))                            answer = "modern";
      else if (/how many|quantity/.test(prompt))                answer = "1";
      else if (/size|rise/.test(prompt))                        answer = "single flight 2.8m rise";
      else if (/when|timeframe|3 months/.test(prompt))          answer = "within 3 months";
      else                                                       answer = "yes";
      latest = await send(answer, conv);
    }

    const briefOk = latest?.advisor?.action === "supplier_brief_ready";
    console.log(`  ${briefOk ? "✓" : "✗"} Workflow concludes with supplier_brief_ready (guard=${guard})`);
    if (briefOk) passed++; else { failed++; failures.push({ turn: "final", action: latest?.advisor?.action }); }

    // Brief record fields
    const brief = latest?.supplier_brief;
    const hasEnquiryId = typeof brief?.enquiry_id === "string" && brief.enquiry_id.startsWith("NEX-ENQUIRY-");
    const hasBriefRecord = brief?.brief_record?.country === "UK"
      && Array.isArray(brief?.brief_record?.materials)
      && brief.brief_record.materials.length > 0;
    console.log(`  ${hasEnquiryId ? "✓" : "✗"} Enquiry id issued: ${brief?.enquiry_id ?? "MISSING"}`);
    console.log(`  ${hasBriefRecord ? "✓" : "✗"} Brief record carries country + materials`);
    if (hasEnquiryId)   passed++; else { failed++; failures.push({ note: "no enquiry_id", brief }); }
    if (hasBriefRecord) passed++; else { failed++; failures.push({ note: "brief_record incomplete", brief }); }

    // Nex Stairplan primary match for UK
    const matches = brief?.matches ?? [];
    const hasNexStairplan = matches.some((m) => m.name === "Nex Stairplan");
    console.log(`  ${hasNexStairplan ? "✓" : "✗"} Nex Stairplan matched for UK customer`);
    if (hasNexStairplan) passed++; else { failed++; failures.push({ note: "no Nex Stairplan match", matches }); }

    // Brief text formatted verbatim per Philip's spec
    const answer = latest?.answer ?? "";
    const briefFieldsPresent = /PROJECT TYPE:/.test(answer)
      && /LOCATION:/.test(answer)
      && /MATERIALS:/.test(answer)
      && /STATUS:/.test(answer);
    console.log(`  ${briefFieldsPresent ? "✓" : "✗"} Supplier Brief block present (PROJECT TYPE · LOCATION · MATERIALS · STATUS)`);
    if (briefFieldsPresent) passed++; else { failed++; failures.push({ note: "brief block malformed", answer: answer.slice(0, 200) }); }
  }

  // ─── US customer · falls back to non-partnered message ────
  console.log("\n── US CUSTOMER · GENERIC FALLBACK ──");
  {
    const conv = newConv();
    await send("Im in California", conv);
    let latest = await send("who can make a modern oak staircase for me", conv);
    let guard = 0;
    while (latest?.advisor?.action === "supplier_collecting" && guard < 10) {
      guard++;
      const prompt = latest.answer.toLowerCase();
      let answer;
      if      (/country/.test(prompt))                          answer = "USA";
      else if (/city|region/.test(prompt))                      answer = "San Francisco";
      else if (/new build|renovation|replacement/.test(prompt)) answer = "renovation";
      else if (/layout|straight flight|quarter/.test(prompt))   answer = "quarter turn";
      else if (/materials/.test(prompt))                        answer = "oak and stainless";
      else if (/style/.test(prompt))                            answer = "modern";
      else if (/how many|quantity/.test(prompt))                answer = "1";
      else if (/size|rise/.test(prompt))                        answer = "3m rise";
      else if (/when|timeframe/.test(prompt))                   answer = "no fixed date";
      else                                                       answer = "yes";
      latest = await send(answer, conv);
    }
    const doneOk = latest?.advisor?.action === "supplier_brief_ready";
    console.log(`  ${doneOk ? "✓" : "✗"} US workflow concludes (guard=${guard})`);
    if (doneOk) passed++; else { failed++; failures.push({ note: "US workflow stuck", action: latest?.advisor?.action }); }

    const matches = latest?.supplier_brief?.matches ?? [];
    const usesFallback = matches.length === 0 && /don'?t\s+yet\s+have\s+a\s+partnered\s+us/i.test(latest?.answer ?? "");
    console.log(`  ${usesFallback ? "✓" : "✗"} US customer gets fallback message (no partnered supplier)`);
    if (usesFallback) passed++; else { failed++; failures.push({ note: "US fallback missing", matches, answer: latest?.answer?.slice(0, 200) }); }

    const briefUS = latest?.supplier_brief?.brief_record?.country;
    console.log(`  ${briefUS === "US" ? "✓" : "✗"} Brief records country=US`);
    if (briefUS === "US") passed++; else { failed++; failures.push({ note: "US brief country wrong", briefUS }); }
  }

  // ─── Supplier intent detection · a range of triggers ─────
  console.log("\n── SUPPLIER INTENT DETECTION ──");
  const intentTriggers = [
    "Who can make this staircase?",
    "Can I buy this?",
    "Find me a supplier",
    "Connect me with a manufacturer",
    "I need a stair specialist",
    "How do I get a quote?",
    "Can I order one of these?",
    "Recommend a supplier please",
  ];
  for (const trigger of intentTriggers) {
    const conv = newConv();
    await send("Im in the UK", conv);
    const r = await send(trigger, conv);
    const ok = r?.advisor?.action === "supplier_collecting"
        || r?.advisor?.action === "supplier_brief_ready";
    console.log(`  ${ok ? "✓" : "✗"} "${trigger}" → ${r?.advisor?.action}`);
    if (ok) passed++; else { failed++; failures.push({ trigger, action: r?.advisor?.action }); }
  }

  // ─── Supplier intent should NOT fire on ordinary knowledge questions ─
  console.log("\n── FALSE POSITIVE GUARD · knowledge questions never trigger workflow ──");
  const knowledgeQs = [
    "What size wood newel post do I need?",
    "How tall should a landing newel be?",
    "Whats the difference between oak and walnut?",
  ];
  for (const q of knowledgeQs) {
    const conv = newConv();
    const r = await send(q, conv);
    const ok = r?.advisor?.action !== "supplier_collecting"
        && r?.advisor?.action !== "supplier_brief_ready";
    console.log(`  ${ok ? "✓" : "✗"} "${q}" → ${r?.advisor?.action} (must not be supplier_*)`);
    if (ok) passed++; else { failed++; failures.push({ question: q, action: r?.advisor?.action }); }
  }

  // ─── v1.1 tightening · Philip 2026-08-02 · trust caveat + verified filter ─
  console.log("\n── v1.1 · TRUST CAVEAT ON HANDOFF ──");
  {
    const conv = newConv();
    await send("Im in the UK", conv);
    let latest = await send("who can make a modern oak staircase", conv);
    let guard = 0;
    while (latest?.advisor?.action === "supplier_collecting" && guard < 12) {
      guard++;
      const prompt = latest.answer.toLowerCase();
      let answer;
      if      (/country/.test(prompt))                          answer = "UK";
      else if (/city|region/.test(prompt))                      answer = "Manchester";
      else if (/new build|renovation|replacement/.test(prompt)) answer = "new build";
      else if (/residential|commercial/.test(prompt))           answer = "residential";
      else if (/layout|straight flight/.test(prompt))           answer = "straight flight";
      else if (/materials/.test(prompt))                        answer = "oak and glass";
      else if (/style/.test(prompt))                            answer = "modern";
      else if (/how many|quantity/.test(prompt))                answer = "1";
      else if (/rise|size/.test(prompt))                        answer = "2.8m rise";
      else if (/when|timeframe/.test(prompt))                   answer = "spring";
      else if (/planning|ready|installation/.test(prompt))      answer = "ready to purchase";
      else                                                       answer = "yes";
      latest = await send(answer, conv);
    }
    const hasCaveat = /final availability, pricing and suitability must be confirmed directly with the supplier/i.test(latest?.answer ?? "");
    console.log(`  ${hasCaveat ? "✓" : "✗"} Trust caveat present at end of handoff`);
    if (hasCaveat) passed++; else { failed++; failures.push({ note: "no trust caveat", answer: latest?.answer?.slice(-300) }); }
  }

  // ─── Summary ──────────────────────────────────────────
  console.log("\n═══ RESULT ═══");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(" ", JSON.stringify(f).slice(0, 300));
  }
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test run failed:", err);
  process.exit(1);
});
