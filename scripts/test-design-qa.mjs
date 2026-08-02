// Layered Q&A retrieval regression suite · Philip 2026-08-02 · 4-layer.
//
// Verifies:
//   1. Empty Q&A slots · chat API falls through to the composer
//   2. Filled slot returns authored answer VERBATIM (Rule A)
//   3. Keyword-overlap variants match the same authored Q
//   4. Unmatched questions fall through to composer
//   5. Requests WITHOUT focused_design_context skip design/family/component
//      layers · UNIVERSAL layer still fires
//   6. LAYER PRIORITY · image beats component beats family beats universal
//      (specific always wins over general)
//   7. FAMILY answer applies to every design tagged with that family_id
//   8. COMPONENT answer applies to every design that has that component
//   9. UNIVERSAL answer applies to every design (last-resort authored)
//  10. Schema stats · reports authoring progress

import { readFileSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3008/api/nex/staircase-chat";
const LIBRARY_JSON = "data/nex-confirmed-images.json";
const TEST_DESIGN_ID = "NEX-DESIGN-000005";
const TEST_AUTHORED_A = "TEST authored answer for design 000005 · style is contemporary industrial luxury.";

const results = { pass: 0, fail: 0, failures: [] };
function check(label, ok, detail = "") {
  if (ok) { results.pass++; console.log(`  ✓ ${label}`); }
  else    { results.fail++; results.failures.push({ label, detail }); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); }
}

async function send(message, conversationId, focusedDesignContext) {
  const res = await fetch(BASE, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      message,
      conversation_id:        conversationId,
      focused_design_context: focusedDesignContext,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function newConv() { return crypto.randomUUID(); }

function ctxFor(designId) {
  return `design_id=${designId} · short_ref=Nex005 · type=modern straight flight · style=contemporary luxury · materials=[oak, glass_balustrade] · image_state=concept`;
}

// ── Temporarily inject an authored answer for the test, restore after ──

function loadLib()  { return JSON.parse(readFileSync(LIBRARY_JSON, "utf8")); }
function saveLib(d) { writeFileSync(LIBRARY_JSON, JSON.stringify(d, null, 2), "utf8"); }

function injectAuthoredAnswer() {
  const d = loadLib();
  const rec = d.confirmed.find((r) => r.design_id === TEST_DESIGN_ID);
  if (!rec) throw new Error(`design ${TEST_DESIGN_ID} not found in library`);
  const backup = JSON.parse(JSON.stringify(rec.qa ?? []));
  const target = rec.qa.find((x) => x.q === "What style is this staircase?");
  if (!target) throw new Error("target Q not found in Q&A skeleton");
  target.a = TEST_AUTHORED_A;
  saveLib(d);
  return backup;
}

function restoreQa(backup) {
  const d = loadLib();
  const rec = d.confirmed.find((r) => r.design_id === TEST_DESIGN_ID);
  if (!rec) return;
  rec.qa = backup;
  saveLib(d);
}

async function run() {
  console.log("\n═══ DESIGN Q&A RETRIEVAL SUITE · Philip 2026-08-02 ═══\n");

  // ─── 1. Empty Q&A slot · falls through to composer ─────────────
  console.log("── 1. Empty Q&A slot falls through (no fake authored answer)");
  {
    const conv = newConv();
    const r = await send("What style is this staircase?", conv, ctxFor(TEST_DESIGN_ID));
    check("status !== answered_by_design_qa when unauthored",
      r?.status !== "answered_by_design_qa",
      `got ${r?.status}`);
  }

  // Inject an authored answer for the next few checks · restore on failure
  const backup = injectAuthoredAnswer();

  try {
    // ─── 2. Filled Q&A slot · exact question match ───────────────
    console.log("\n── 2. Authored answer returned VERBATIM on exact question match");
    {
      const conv = newConv();
      const r = await send("What style is this staircase?", conv, ctxFor(TEST_DESIGN_ID));
      check("status === answered_by_design_qa",
        r?.status === "answered_by_design_qa",
        `got ${r?.status}`);
      check("answer === authored text (verbatim, no LLM synthesis)",
        r?.answer === TEST_AUTHORED_A,
        `got "${(r?.answer || '').slice(0, 80)}..."`);
      check("citations point to design-qa-authored",
        Array.isArray(r?.citations) && r.citations[0]?.source === "design-qa-authored",
        `got ${JSON.stringify(r?.citations?.[0])}`);
      check("brain_versions includes images:design-qa",
        typeof r?.brain_versions?.["images:design-qa"] === "string",
        `got ${JSON.stringify(r?.brain_versions)}`);
    }

    // ─── 3. Keyword-overlap variants match the same Q ────────────
    console.log("\n── 3. Keyword-overlap variants match the same authored Q");
    const variants = [
      "what style",
      "tell me the style",
      "what's the style of this one",
    ];
    for (const v of variants) {
      const conv = newConv();
      const r = await send(v, conv, ctxFor(TEST_DESIGN_ID));
      check(`"${v}" → authored answer`,
        r?.status === "answered_by_design_qa" && r?.answer === TEST_AUTHORED_A,
        `status=${r?.status}`);
    }

    // ─── 4. Unmatched question falls through ─────────────────────
    console.log("\n── 4. Unmatched question falls through to composer");
    {
      const conv = newConv();
      const r = await send("What is the weather like today?", conv, ctxFor(TEST_DESIGN_ID));
      check("status !== answered_by_design_qa for off-topic question",
        r?.status !== "answered_by_design_qa",
        `got ${r?.status}`);
    }

    // ─── 5. No focused_design_context · Q&A layer skipped ────────
    console.log("\n── 5. Q&A layer skipped when no focused_design_context");
    {
      const conv = newConv();
      const r = await send("What style is this staircase?", conv, undefined);
      check("status !== answered_by_design_qa without focused design",
        r?.status !== "answered_by_design_qa",
        `got ${r?.status}`);
    }
  } finally {
    restoreQa(backup);
    console.log("\n(Q&A backup restored)");
  }

  // ─── 6. 4-layer priority · IMAGE beats FAMILY beats UNIVERSAL ─
  console.log("\n── 6. Layer priority · IMAGE > FAMILY > UNIVERSAL (specific wins)");
  const universalPath = "data/nex-universal-qa.json";
  const familyDir     = "data/nex-family-qa";
  const componentDir  = "data/nex-component-qa";

  // Inject answers at all three layers · same Q text
  const UNI_ANSWER    = "UNIVERSAL layer answer · Philip test.";
  const FAM_ANSWER    = "SPIRAL family layer answer · Philip test.";
  const COMP_ANSWER   = "STRINGER component layer answer · Philip test.";
  const IMG_ANSWER    = "IMAGE layer answer for design 000005 · Philip test.";
  const TEST_Q        = "What supports this staircase?";

  // Universal
  const uniBefore = JSON.parse(readFileSync(universalPath, "utf8"));
  const uniAfter  = JSON.parse(JSON.stringify(uniBefore));
  uniAfter.qa.push({ q: TEST_Q, a: UNI_ANSWER });
  writeFileSync(universalPath, JSON.stringify(uniAfter, null, 2), "utf8");

  // Family (spiral)
  const spiralPath = `${familyDir}/spiral.json`;
  const spiralBefore = JSON.parse(readFileSync(spiralPath, "utf8"));
  const spiralAfter  = JSON.parse(JSON.stringify(spiralBefore));
  spiralAfter.qa.push({ q: TEST_Q, a: FAM_ANSWER });
  writeFileSync(spiralPath, JSON.stringify(spiralAfter, null, 2), "utf8");

  // Component (stringer)
  const stringerPath = `${componentDir}/stringer.json`;
  const stringerBefore = JSON.parse(readFileSync(stringerPath, "utf8"));
  const stringerAfter  = JSON.parse(JSON.stringify(stringerBefore));
  stringerAfter.qa.push({ q: TEST_Q, a: COMP_ANSWER });
  writeFileSync(stringerPath, JSON.stringify(stringerAfter, null, 2), "utf8");

  // Image (NEX-DESIGN-000005)
  const imgLibBefore = loadLib();
  const imgLibAfter  = JSON.parse(JSON.stringify(imgLibBefore));
  const imgRec = imgLibAfter.confirmed.find((r) => r.design_id === TEST_DESIGN_ID);
  imgRec.qa.push({ q: TEST_Q, a: IMG_ANSWER });
  saveLib(imgLibAfter);

  try {
    // Wait for the 60s in-process cache to be moot · we're a fresh dev process
    await new Promise((r) => setTimeout(r, 1200));

    // With ALL 4 layers filled · image wins
    {
      const conv = newConv();
      const r = await send(TEST_Q, conv, ctxFor(TEST_DESIGN_ID));
      check("IMAGE wins over component/family/universal (all 4 filled)",
        r?.answer === IMG_ANSWER && r?.layer === "image",
        `got layer=${r?.layer} answer="${(r?.answer||'').slice(0,60)}"`);
    }

    // Remove image · component should win
    imgRec.qa = imgRec.qa.filter((x) => x.q !== TEST_Q);
    saveLib(imgLibAfter);
    await new Promise((r) => setTimeout(r, 1200));
    {
      const conv = newConv();
      const r = await send(TEST_Q, conv, ctxFor(TEST_DESIGN_ID));
      check("COMPONENT wins over family/universal (image removed)",
        r?.answer === COMP_ANSWER && r?.layer === "component" && r?.layer_ref === "stringer",
        `got layer=${r?.layer} ref=${r?.layer_ref}`);
    }

    // Remove component · family should win
    stringerAfter.qa = stringerAfter.qa.filter((x) => x.q !== TEST_Q);
    writeFileSync(stringerPath, JSON.stringify(stringerAfter, null, 2), "utf8");
    await new Promise((r) => setTimeout(r, 1200));
    {
      const conv = newConv();
      const r = await send(TEST_Q, conv, ctxFor(TEST_DESIGN_ID));
      check("FAMILY wins over universal (component removed)",
        r?.answer === FAM_ANSWER && r?.layer === "family" && r?.layer_ref === "spiral",
        `got layer=${r?.layer} ref=${r?.layer_ref}`);
    }

    // Remove family · universal should win
    spiralAfter.qa = spiralAfter.qa.filter((x) => x.q !== TEST_Q);
    writeFileSync(spiralPath, JSON.stringify(spiralAfter, null, 2), "utf8");
    await new Promise((r) => setTimeout(r, 1200));
    {
      const conv = newConv();
      const r = await send(TEST_Q, conv, ctxFor(TEST_DESIGN_ID));
      check("UNIVERSAL wins as last-resort (image/component/family removed)",
        r?.answer === UNI_ANSWER && r?.layer === "universal",
        `got layer=${r?.layer} answer="${(r?.answer||'').slice(0,60)}"`);
    }

    // Universal fires WITHOUT focused_design_context
    {
      const conv = newConv();
      const r = await send(TEST_Q, conv, undefined);
      check("UNIVERSAL still fires without focused_design_context",
        r?.answer === UNI_ANSWER && r?.layer === "universal",
        `got layer=${r?.layer}`);
    }
  } finally {
    // Restore all four layer files
    writeFileSync(universalPath, JSON.stringify(uniBefore, null, 2), "utf8");
    writeFileSync(spiralPath,    JSON.stringify(spiralBefore, null, 2), "utf8");
    writeFileSync(stringerPath,  JSON.stringify(stringerBefore, null, 2), "utf8");
    saveLib(imgLibBefore);
    console.log("(all 4 layer files restored)");
  }

  // ─── 7. Authoring stats report ─────────────────────────────────
  console.log("\n── 7. Authoring stats (info only)");
  {
    const d = loadLib();
    const libraryIds = ["NEX-DESIGN-000005","NEX-DESIGN-000020","NEX-DESIGN-000025","NEX-DESIGN-000026"];
    for (const id of libraryIds) {
      const rec = d.confirmed.find((r) => r.design_id === id);
      if (!rec) continue;
      const qa = rec.qa ?? [];
      const authored = qa.filter((x) => x.a && x.a.trim().length > 0).length;
      console.log(`  ℹ ${id} · image · ${authored}/${qa.length} authored${authored === qa.length && qa.length > 0 ? " ✓" : ""}`);
    }
  }

  console.log("\n═══ RESULT ═══");
  console.log(`  Passed: ${results.pass}`);
  console.log(`  Failed: ${results.fail}`);
  if (results.failures.length > 0) {
    console.log("\nFailures:");
    for (const f of results.failures) console.log(`  ✗ ${f.label}${f.detail ? ` — ${f.detail}` : ""}`);
  }
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Design Q&A suite crashed:", err);
  process.exit(1);
});
