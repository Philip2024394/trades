// Regional Language Layer regression · Philip 2026-08-02
//
// Priority 1 intelligence layer test.
//
// Verifies:
//   (1) detectCountry() picks up common phrasings (Ireland · California · London · etc.)
//   (2) advisor state.user_country becomes sticky across turns
//   (3) composer receives the country hint (surfaced via state_snapshot)
//
// End-to-end via the live chat endpoint so we prove the wire, not the unit.

const BASE = "http://localhost:3008/api/nex/staircase-chat";

const detectionSuites = [
  { message: "I'm in Ireland and need a new staircase",           expect: "IE" },
  { message: "Based in California, planning a loft conversion",    expect: "US" },
  { message: "We are living in London and renovating",             expect: "UK" },
  { message: "My project is in Dublin",                            expect: "IE" },
  { message: "Im in the USA",                                      expect: "US" },
  { message: "im in australia",                                    expect: "AU" },
  { message: "from Toronto, need staircase advice",                expect: "CA" },
  { message: "based in Sydney with a new build",                   expect: "AU" },
  { message: "im in new zealand",                                  expect: "NZ" },
  { message: "based in the united kingdom",                        expect: "UK" },
  { message: "im in ireland",                                      expect: "IE" },
  { message: "located in Massachusetts",                           expect: "US" },
];

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

  console.log("\n═══ REGIONAL LANGUAGE LAYER · Priority 1 intelligence layer ═══\n");

  // ─── Detection ────────────────────────────────────────────────────
  console.log("── COUNTRY DETECTION ──");
  for (const t of detectionSuites) {
    const conv = newConv();
    const r = await send(t.message, conv);
    const detected = r?.advisor?.state_snapshot?.user_country;
    const ok = detected === t.expect;
    console.log(`  ${ok ? "✓" : "✗"} "${t.message}" → ${detected ?? "(none)"} (expected ${t.expect})`);
    if (ok) passed++;
    else { failed++; failures.push({ message: t.message, expected: t.expect, actual: detected }); }
  }

  // ─── Stickiness ───────────────────────────────────────────────────
  console.log("\n── COUNTRY STICKINESS ACROSS TURNS ──");
  const conv = newConv();
  const t1 = await send("I'm in the USA, planning a new staircase", conv);
  const t2 = await send("Have you got straight stairs?", conv);
  const t3 = await send("hallway", conv);
  const c1 = t1?.advisor?.state_snapshot?.user_country;
  const c2 = t2?.advisor?.state_snapshot?.user_country;
  const c3 = t3?.advisor?.state_snapshot?.user_country;
  const stickyOk = c1 === "US" && c2 === "US" && c3 === "US";
  console.log(`  ${stickyOk ? "✓" : "✗"} Turn 1=${c1}, Turn 2=${c2}, Turn 3=${c3} (all should be US)`);
  if (stickyOk) passed++; else { failed++; failures.push({ note: "stickiness", turns: [c1, c2, c3] }); }

  // ─── Correction ───────────────────────────────────────────────────
  console.log("\n── COUNTRY CORRECTION ──");
  const conv2 = newConv();
  const r1 = await send("Im in the UK", conv2);
  const r2 = await send("Actually Im in Australia", conv2);
  const cor1 = r1?.advisor?.state_snapshot?.user_country;
  const cor2 = r2?.advisor?.state_snapshot?.user_country;
  const correctOk = cor1 === "UK" && cor2 === "AU";
  console.log(`  ${correctOk ? "✓" : "✗"} Turn 1=${cor1}, Turn 2=${cor2} (should switch UK → AU)`);
  if (correctOk) passed++; else { failed++; failures.push({ note: "correction", turns: [cor1, cor2] }); }

  // ─── Composer terminology (best-effort · depends on Claude output) ─
  console.log("\n── COMPOSER US TERMINOLOGY (best-effort assertion) ──");
  const conv3 = newConv();
  await send("Im in the USA", conv3);
  const r = await send("What size wood newel post do I need?", conv3);
  const answer = String(r?.answer ?? "");
  // If the country hint reached the composer, "baluster" should appear more
  // naturally than "spindle" · this is a soft check because Claude output varies.
  const usesBaluster = /\bbaluster/i.test(answer);
  const usesSpindle  = /\bspindle/i.test(answer);
  const softOk = usesBaluster || !usesSpindle; // pass if baluster present OR spindle absent
  console.log(`  ${softOk ? "✓" : "?"} US customer answer · baluster=${usesBaluster} · spindle=${usesSpindle}`);
  console.log(`    (soft check · answer preview: "${answer.slice(0, 120)}...")`);
  if (softOk) passed++; else failed++;

  // ─── Summary ──────────────────────────────────────────────────────
  console.log("\n═══ RESULT ═══");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(" ", JSON.stringify(f));
  }
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test run failed:", err);
  process.exit(1);
});
