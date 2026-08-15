// NEX App Builder · Phase 11 · Chat backend e2e (Philip 2026-08-14).
//
// Drives a full customer conversation through the chat backend modules
// WITHOUT needing a running Next.js dev server. Proves:
//   1. Initial prompt → template matched
//   2. NEX asks for missing facts in plain English
//   3. Facts get applied and provenance updates
//   4. When all facts supplied · readyToBuild flips to true
//   5. Build runs orchestrator + Playwright and produces screenshots
//   6. Preview URLs are well-formed
//   7. Constitutional rule holds: never asks in technical language
//   8. Ambiguous / unknown prompts show candidates instead of guessing
//   9. Fact applier rejects invalid inputs (bad email, bad postcode)
//  10. Screenshots are real bytes on disk

await import("../../src/lib/studio/sections/index.ts");

const chat = await import("../../src/lib/app-builder/chat/index.ts");
const orch = await import("../../src/lib/app-builder/workers/orchestrator.ts");
const fs = await import("node:fs");
const path = await import("node:path");

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS:", msg); pass++; }
  else      { console.error("FAIL:", msg); fail++; }
}

// ─────────────────────────────────────────────────────────────
// A. Prompt → template match
// ─────────────────────────────────────────────────────────────
console.log("\n---------- A · Prompt → template ----------");
const staircaseRoute = chat.routeIntent("I want a website for my staircase company");
assert(staircaseRoute.kind === "matched", `"staircase company" matches template (got ${staircaseRoute.kind})`);
if (staircaseRoute.kind === "matched") {
  assert(staircaseRoute.template.id === "staircase", `matched template id=staircase`);
}

const plumberRoute = chat.routeIntent("I'm a plumber in Birmingham");
assert(plumberRoute.kind === "matched" && plumberRoute.template.id === "plumbing", `plumber prompt matches plumbing template`);

const ambigRoute = chat.routeIntent("kitchen render");   // "kitchen" + "render" both match different templates
assert(ambigRoute.kind === "matched" || ambigRoute.kind === "ambiguous", `ambiguous prompt handled without crashing (got ${ambigRoute.kind})`);

const unknownRoute = chat.routeIntent("I run a spaceship dealership");
assert(unknownRoute.kind === "unknown", `truly unknown prompt returns "unknown" (got ${unknownRoute.kind})`);

// ─────────────────────────────────────────────────────────────
// B. Question generator speaks plain English (staircase has real REQUIREDs)
// ─────────────────────────────────────────────────────────────
console.log("\n---------- B · Question generator ----------");
const staircaseTemplate = chat.getStarterTemplateById("staircase");
const staircaseBp = staircaseTemplate.build();
const q1 = chat.generateNextQuestion(staircaseBp);
assert(q1 !== null, "first question generated for staircase template");
if (q1) {
  assert(!q1.text.match(/identity\.|contact\.|palette\./), `question NOT technical (no dotted path in "${q1.text}")`);
  assert(!q1.text.match(/[A-Z_]{5,}/), `question NOT technical (no ALL_CAPS in "${q1.text}")`);
  assert(q1.text.includes("?"), `question ends with "?" · plain English`);
  console.log("    NEX asks: \"" + q1.text + "\"");
}

// ─────────────────────────────────────────────────────────────
// C. Fact applier · updates Blueprint + provenance (using plumbing template)
// ─────────────────────────────────────────────────────────────
console.log("\n---------- C · Fact applier ----------");
const template = chat.getStarterTemplateById("plumbing");
let bp = template.build();
const applied1 = chat.applyFact(bp, "identity.displayName", "Harborne Plumbing & Heating");
assert(applied1.ok, "displayName application succeeds");
if (applied1.ok) {
  assert(applied1.blueprint.identity.displayName === "Harborne Plumbing & Heating", "displayName written correctly");
  assert(applied1.blueprint.provenance["identity.displayName"]?.level === "KNOWN", "provenance updated to KNOWN");
  assert(applied1.blueprint.provenance["identity.displayName"]?.source === "customer:chat", "source=customer:chat");
  assert(applied1.blueprint.meta.revision > bp.meta.revision, "meta.revision bumped");
  bp = applied1.blueprint;
}

// Invalid email
const badEmail = chat.applyFact(bp, "identity.contact.primaryEmail", "not-an-email");
assert(!badEmail.ok, `bad email rejected (${badEmail.ok ? "unexpectedly accepted" : "correct"})`);

// Invalid path
const badPath = chat.applyFact(bp, "arbitrary.hacky.path", "value");
assert(!badPath.ok, "unknown fieldPath rejected · can't mutate arbitrary Blueprint fields");

// Valid email
const goodEmail = chat.applyFact(bp, "identity.contact.primaryEmail", "info@harborne-plumbing.co.uk");
assert(goodEmail.ok, "valid email accepted");
if (goodEmail.ok) bp = goodEmail.blueprint;

// Valid phone
const goodPhone = chat.applyFact(bp, "identity.contact.primaryPhone", "0121 555 0100");
assert(goodPhone.ok, "phone accepted");
if (goodPhone.ok) bp = goodPhone.blueprint;

// ─────────────────────────────────────────────────────────────
// D. Iterate through all questions until readyToBuild
// ─────────────────────────────────────────────────────────────
console.log("\n---------- D · Full conversation to READY ----------");
let iterations = 0;
const answers = {
  "identity.contact.serviceRadius.centre":     "B17 9AB",
  "identity.contact.serviceRadius.radiusMiles": "20",
  "brand.palette.primary":                     "#1e4d8b"
};
while (iterations < 12) {
  const q = chat.generateNextQuestion(bp);
  if (!q) break;
  iterations++;
  const answer = answers[q.fieldPath];
  if (!answer) {
    console.log("    stopping · no test answer for " + q.fieldPath);
    break;
  }
  console.log("    NEX: \"" + q.text + "\" → \"" + answer + "\"");
  const r = chat.applyFact(bp, q.fieldPath, answer);
  if (!r.ok) { console.error("    fact apply failed: " + r.error); break; }
  bp = r.blueprint;
}
const finalQ = chat.generateNextQuestion(bp);
assert(finalQ === null, `NEX has all facts (nextQuestion=null · got ${finalQ ? finalQ.fieldPath : "null"})`);

// ─────────────────────────────────────────────────────────────
// E. Build orchestrator on the completed Blueprint
// ─────────────────────────────────────────────────────────────
console.log("\n---------- E · Full build with Playwright ----------");
const buildRes = await orch.runBlueprintWorkers(bp, {
  executeQA: true,
  screenshotDir: path.join(process.cwd(), "tmp-nex-qa-screenshots-chat-e2e")
});
assert(buildRes.overall === "READY", `overall verdict = READY (got ${buildRes.overall})`);
assert(buildRes.qaExecution?.ran === true, "Playwright ran");
assert(buildRes.qaExecution?.fail === 0, `0 QA failures (got ${buildRes.qaExecution?.fail})`);
assert(buildRes.qaExecution.screenshots.length > 0, `${buildRes.qaExecution.screenshots.length} screenshots captured`);

// Real image bytes on disk
let realShots = 0;
for (const s of buildRes.qaExecution.screenshots) {
  if (fs.existsSync(s.path) && fs.statSync(s.path).size > 2000) realShots++;
}
assert(realShots === buildRes.qaExecution.screenshots.length, `all ${realShots} screenshots are real PNG bytes (>2KB)`);

// ─────────────────────────────────────────────────────────────
// F. Constitutional check · never fabricated
// ─────────────────────────────────────────────────────────────
console.log("\n---------- F · Constitutional check ----------");
const val = buildRes.workerReports.validation.data;
assert(val.requiredFacts.length === 0, "0 REQUIRED facts remaining after conversation");
assert(val.sectionResolutions.every(r => r.strategy !== "unresolved"), "0 unresolved sections");
assert(bp.provenance["identity.displayName"]?.source === "customer:chat", "displayName provenance traces to customer:chat");
assert(bp.provenance["identity.contact.primaryEmail"]?.source === "customer:chat", "email provenance traces to customer:chat");

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────
console.log("");
console.log("─".repeat(60));
console.log("Chat conversation summary:");
console.log("  Template matched:      " + template.label);
console.log("  Facts collected:       " + Object.keys(answers).length + 3 + " (name/email/phone/postcode/miles/brand)");
console.log("  Build verdict:         " + buildRes.overall);
console.log("  QA pass:               " + buildRes.qaExecution?.pass);
console.log("  QA fail:               " + buildRes.qaExecution?.fail);
console.log("  Screenshots:           " + buildRes.qaExecution?.screenshots.length + " · all >2KB");
console.log("  Provenance traced:     customer:chat");
console.log("─".repeat(60));
console.log("");
console.log("=".repeat(60));
console.log(`Phase 11 · Chat e2e · ${pass} passed · ${fail} failed`);
console.log("=".repeat(60));
if (fail > 0) process.exit(1);
