// Staircase adapter integration regression.
//
// Exercises the staircase TradeAdapter + the engine's assemble() wrapper
// with an INLINE MerchantDefaults so the eval runs without Supabase env
// vars (like every other nex-conv eval). Full engine + defaults resolver
// is covered by vitest — this .mjs proves the doctrine:
//
//   1. Adapter recognises staircase briefs (parse) + returns a
//      structured TradeBase (compute).
//   2. Every material + labour line has total_pence: 0 (no fabricated
//      prices).
//   3. assemble() wraps £0 lines with £0 waste/overhead/profit/VAT →
//      Estimate.total_pence === 0.
//   4. The top warning explicitly declares PRICING NOT CONFIGURED.
//   5. Derived geometry is present and shape-correct for a typical UK
//      domestic staircase.
//   6. Same input twice produces byte-identical output (ignoring
//      per-call timestamps).
//   7. The adapter is registered in the engine's ADAPTERS array (so
//      buildEstimate() would route to it in production).
//
// Chained into `npm run nex:conv:test` so the doctrine can't silently
// regress.
//
// Env vars: this eval must not require a live Supabase config, because
// the standard nex-conv eval chain runs against jsonl backend + no
// server. The engine's defaults resolver (defaults.ts) transitively
// imports supabaseAdmin which throws at module-load when the vars are
// absent. We stub them here BEFORE any import — the stubs are never
// used because our tests inline MerchantDefaults directly. This is
// eval-scoped only; production paths still get real env values.

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost.eval/nex-staircase-adapter-stub";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "eval-only-service-key-not-a-secret";

const { staircaseAdapter } = await import("../../src/lib/nex/est/trades/staircase.ts");
const { assemble }         = await import("../../src/lib/nex/est/engine.ts");
const { ADAPTERS }         = await import("../../src/lib/nex/est/registry.ts");

// Inline defaults · matches ENGINE_DEFAULTS in src/lib/nex/est/defaults.ts
// but does NOT import that file (transitive supabaseAdmin dep would throw).
const DEFAULTS = {
  labour_rate_pence_per_hour: 4500,
  overhead_pct:               12,
  profit_margin_pct:          20,
  default_waste_pct:          10,
  vat_pct:                    20,
  currency:                   "GBP",
  region:                     "UK",
  source: {
    labour_rate:   "engine",
    overhead:      "engine",
    profit_margin: "engine",
    default_waste: "engine",
    vat:           "engine",
  },
};

function assert(cond, label, evidence) {
  return { pass: !!cond, label, evidence: cond ? null : evidence };
}

function stripTimestamps(estimate) {
  const scrub = (l) => ({ ...l, evidence: { source: l.evidence?.source, tables: l.evidence?.tables } });
  return {
    ...estimate,
    lines: estimate.lines.map(scrub),
    computed_at: null,
  };
}

function computeEstimate(brief, tradeHint = undefined) {
  const adapter = tradeHint
    ? ADAPTERS.find(a => a.trade === tradeHint || a.aliases.includes(tradeHint))
    : ADAPTERS.find(a => a.parse(brief) !== null);
  if (!adapter) throw new Error(`no adapter matched brief: "${brief}"`);
  const parsed = adapter.parse(brief);
  if (!parsed) throw new Error(`adapter ${adapter.trade} could not parse: "${brief}"`);
  const base = adapter.compute({ natural: brief, parameters: parsed }, DEFAULTS, {});
  return { adapter, estimate: assemble(adapter.trade, adapter.label, base, DEFAULTS), base };
}

function computeFromDesign(design) {
  const base = staircaseAdapter.compute({ parameters: { design } }, DEFAULTS, {});
  return { estimate: assemble(staircaseAdapter.trade, staircaseAdapter.label, base, DEFAULTS), base };
}

async function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log("STAIRCASE ADAPTER · integration via engine.assemble()");
  console.log("════════════════════════════════════════════════════════");

  const assertions = [];

  // ─── Test 0: adapter is REGISTERED in the engine ──────────────────
  const registered = ADAPTERS.find(a => a.trade === "staircase");
  assertions.push(assert(!!registered, "staircaseAdapter is registered in ADAPTERS[] (buildEstimate would route to it)", ADAPTERS.map(a => a.trade)));

  // ─── Test 1: parse + compute a straight staircase brief ───────────
  const { adapter: a1, estimate: e1 } = computeEstimate("quote me a straight staircase 2700 floor to floor in oak");
  assertions.push(assert(a1.trade === "staircase", `adapter matched === "staircase" · got "${a1.trade}"`, a1.trade));

  // ─── Test 2: no fabricated prices ─────────────────────────────────
  const priced = e1.lines.filter(l => (l.category === "material" || l.category === "labour") && l.total_pence !== 0);
  assertions.push(assert(priced.length === 0, "every material + labour line has total_pence = 0 (no fabricated prices)", priced.map(l => ({ label: l.label, total_pence: l.total_pence }))));
  assertions.push(assert(e1.materials_pence === 0, `materials_pence === 0 · got ${e1.materials_pence}`, e1.materials_pence));
  assertions.push(assert(e1.labour_pence === 0, `labour_pence === 0 · got ${e1.labour_pence}`, e1.labour_pence));
  assertions.push(assert(e1.total_pence === 0, `total_pence === 0 · got ${e1.total_pence}`, e1.total_pence));
  assertions.push(assert(e1.vat_pence === 0, `vat_pence === 0 · got ${e1.vat_pence}`, e1.vat_pence));
  assertions.push(assert(e1.waste_pence === 0, `waste_pence === 0 (engine wraps £0 correctly) · got ${e1.waste_pence}`, e1.waste_pence));

  // ─── Test 3: PRICING NOT CONFIGURED warning is present ────────────
  const pricingWarn = e1.warnings.find(w => /PRICING NOT CONFIGURED/i.test(w));
  assertions.push(assert(!!pricingWarn, "PRICING NOT CONFIGURED warning is present", e1.warnings));

  // ─── Test 4: derived geometry populated ───────────────────────────
  const derived = e1.parameters.derived;
  assertions.push(assert(derived, "estimate.parameters.derived block is populated", e1.parameters));
  assertions.push(assert(derived.riser_count >= 13 && derived.riser_count <= 16, `riser_count in reasonable range · got ${derived.riser_count}`, derived));
  assertions.push(assert(derived.tread_count === derived.riser_count - 1, `tread_count === riser_count - 1 · got ${derived.tread_count} vs ${derived.riser_count}`, derived));
  assertions.push(assert(derived.stringer_length_mm > 3000 && derived.stringer_length_mm < 5000, `stringer_length_mm reasonable for 2700mm floor-to-floor · got ${derived.stringer_length_mm}`, derived));
  assertions.push(assert(derived.newel_count === 2, `straight geometry → 2 newels · got ${derived.newel_count}`, derived));
  assertions.push(assert(derived.landing_count === 0, `straight geometry → 0 landings · got ${derived.landing_count}`, derived));
  assertions.push(assert(e1.parameters.pricing_available === false, "pricing_available === false (honest signal for Worker)", e1.parameters.pricing_available));

  // ─── Test 5: quarter-turn produces different newel/landing counts ─
  const { estimate: e2 } = computeFromDesign({ geometry: "quarter_turn", floor_to_floor_mm: 2700 });
  assertions.push(assert(e2.parameters.derived.newel_count === 3, `quarter_turn → 3 newels · got ${e2.parameters.derived.newel_count}`, e2.parameters.derived));
  assertions.push(assert(e2.parameters.derived.landing_count === 1, `quarter_turn → 1 landing · got ${e2.parameters.derived.landing_count}`, e2.parameters.derived));

  // ─── Test 6: adapter returns something useful without measurements ─
  const { estimate: e3 } = computeFromDesign({ geometry: "straight" });  // no floor-to-floor
  const missWarn = e3.warnings.find(w => /floor_to_floor_mm not provided/i.test(w));
  assertions.push(assert(!!missWarn, "warns when floor_to_floor_mm missing (silence-over-fabrication)", e3.warnings));
  const dimensional = e3.lines.filter(l => l.category === "material" && ["Treads", "Risers", "Stringer", "Handrail", "Balustrade"].some(k => l.label.startsWith(k)));
  assertions.push(assert(dimensional.length === 0, "no dimensional lines emitted when floor_to_floor_mm absent", dimensional));

  // ─── Test 7: compatibility rule surfaces (spiral + glass) ─────────
  const { estimate: e4 } = computeFromDesign({ geometry: "spiral", materialFamily: "glass", floor_to_floor_mm: 2700 });
  const compatWarn = e4.warnings.find(w => /spiral_glass_only|specialist_review/i.test(w));
  assertions.push(assert(!!compatWarn, "compatibility rule 'spiral_glass_only' surfaces as warning", e4.warnings));

  // ─── Test 8: determinism across two runs (ignoring timestamps) ────
  const { estimate: rA } = computeFromDesign({ geometry: "straight", floor_to_floor_mm: 2700, wood: "oak" });
  const { estimate: rB } = computeFromDesign({ geometry: "straight", floor_to_floor_mm: 2700, wood: "oak" });
  const jsonA = JSON.stringify(stripTimestamps(rA));
  const jsonB = JSON.stringify(stripTimestamps(rB));
  assertions.push(assert(jsonA === jsonB, "same design → identical estimate structure (determinism)", jsonA === jsonB ? null : { lenA: jsonA.length, lenB: jsonB.length }));

  // ─── Test 9: existing adapters still work (regression proof) ──────
  const { adapter: aP, estimate: eP } = computeEstimate("estimate 42m² of plastering");
  assertions.push(assert(aP.trade === "plastering", `plastering brief routes to plastering adapter · got "${aP.trade}"`, aP.trade));
  assertions.push(assert(eP.total_pence > 0, `plastering total_pence > 0 (existing adapter unaffected) · got ${eP.total_pence}`, eP.total_pence));

  const { adapter: aV, estimate: eV } = computeEstimate("block paving driveway 8m x 5m");
  assertions.push(assert(aV.trade === "paving", `paving brief routes to paving adapter · got "${aV.trade}"`, aV.trade));
  assertions.push(assert(eV.total_pence > 0, `paving total_pence > 0 (existing adapter unaffected) · got ${eV.total_pence}`, eV.total_pence));

  // ─── Print + summarise ────────────────────────────────────────────
  console.log("");
  let passed = 0, failed = 0;
  for (const a of assertions) {
    console.log(`  ${a.pass ? "✓" : "✗"} ${a.label}`);
    if (!a.pass && a.evidence) console.log(`      evidence: ${JSON.stringify(a.evidence).slice(0, 300)}`);
    a.pass ? passed++ : failed++;
  }
  console.log("");
  console.log("════════════════════════════════════════════════════════");
  console.log(`SUMMARY · passed: ${passed} · failed: ${failed}`);
  console.log("════════════════════════════════════════════════════════");
  process.exit(failed === 0 ? 0 : 2);
}

main().catch(e => {
  console.error(e instanceof Error ? e.stack ?? e.message : String(e));
  process.exit(1);
});
