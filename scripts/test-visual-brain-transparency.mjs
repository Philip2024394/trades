// Visual Brain Connection v1 · transparency layer regression
// Philip 2026-08-02 · Priority 2 intelligence layer.
//
// Verifies:
//   (1) every attached image carries image_state · image_state_badge · transparency_caption
//   (2) unset state defaults to "concept" (safest per Philip's transparency principle)
//   (3) badge + caption match the four Philip states
//   (4) composer never over-claims concept images as real products (soft check)
//
// End-to-end via the live chat endpoint · proves the wire, not the unit.

const BASE = "http://localhost:3008/api/nex/staircase-chat";

const VALID_STATES = new Set(["concept", "reference", "manufacturer", "customer_project"]);
const VALID_BADGES = new Set(["Concept", "Reference", "Manufacturer", "Customer project"]);

const CAPTION_BY_STATE = {
  concept:          "Nex generated design concept — showing possible appearance.",
  reference:        "Style direction reference — exact manufacture may vary.",
  manufacturer:     "Supplied product image from a manufacturer.",
  customer_project: "Real customer installation.",
};

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

  console.log("\n═══ VISUAL BRAIN CONNECTION v1 · transparency layer ═══\n");

  // ─── Trigger a message that reliably returns visual brain images ─
  console.log("── FETCHING TILES ──");
  const conv = newConv();
  // Establish enough state that Visual Brain retrieves something
  await send("Have you got straight stairs?", conv);
  await send("hallway", conv);
  const r = await send("modern", conv);

  const tiles = r?.visual_brain ?? [];
  console.log(`  Retrieved ${tiles.length} visual brain tiles`);
  if (tiles.length === 0) {
    console.log("  ✗ Expected at least one tile — cannot validate transparency layer");
    failed++;
    process.exit(1);
  }

  // ─── Every tile carries all three transparency fields ────────────
  console.log("\n── EVERY TILE CARRIES image_state · badge · transparency_caption ──");
  for (const t of tiles) {
    const hasState   = typeof t.image_state === "string" && VALID_STATES.has(t.image_state);
    const hasBadge   = typeof t.image_state_badge === "string" && VALID_BADGES.has(t.image_state_badge);
    const hasCaption = typeof t.transparency_caption === "string" && t.transparency_caption.length > 10;
    const ok = hasState && hasBadge && hasCaption;
    console.log(`  ${ok ? "✓" : "✗"} ${t.design_id} · state=${t.image_state ?? "MISSING"} · badge=${t.image_state_badge ?? "MISSING"}`);
    if (ok) passed++;
    else {
      failed++;
      failures.push({ design_id: t.design_id, hasState, hasBadge, hasCaption });
    }
  }

  // ─── Default state is "concept" (safest per Philip 2026-08-02) ─
  console.log("\n── DEFAULT STATE IS 'concept' ──");
  // Data file has no explicit image_state on any record, so every tile
  // must come back as concept.
  const allConcept = tiles.every((t) => t.image_state === "concept");
  console.log(`  ${allConcept ? "✓" : "✗"} All ${tiles.length} tiles default to 'concept' (unset records)`);
  if (allConcept) passed++; else { failed++; failures.push({ note: "default", states: tiles.map((t) => t.image_state) }); }

  // ─── Caption text matches the prescribed template ──────────────
  console.log("\n── TRANSPARENCY CAPTION MATCHES PRESCRIBED TEMPLATE ──");
  for (const t of tiles) {
    const expected = CAPTION_BY_STATE[t.image_state];
    const ok = t.transparency_caption === expected;
    console.log(`  ${ok ? "✓" : "✗"} ${t.design_id} · "${t.transparency_caption?.slice(0, 60)}..."`);
    if (ok) passed++;
    else {
      failed++;
      failures.push({ design_id: t.design_id, expected, actual: t.transparency_caption });
    }
  }

  // ─── Composer soft-check · does not over-claim concept as real ─
  console.log("\n── COMPOSER DOES NOT OVER-CLAIM CONCEPT IMAGES AS REAL (soft) ──");
  const answer = String(r?.answer ?? "").toLowerCase();
  // Any of these phrases would imply the image is a real photograph, not a concept
  const banned = [
    "we photographed",
    "we took this photo",
    "this real staircase",
    "this exact newel exists",
    "this is a real product",
    "we manufactured this",
  ];
  const violations = banned.filter((p) => answer.includes(p));
  const softOk = violations.length === 0;
  console.log(`  ${softOk ? "✓" : "✗"} answer contains no over-claim phrases (${violations.length} hits)`);
  if (softOk) passed++;
  else { failed++; failures.push({ note: "composer over-claim", violations }); }

  // ─── Summary ──────────────────────────────────────────────────
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
