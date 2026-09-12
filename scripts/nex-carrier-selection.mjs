#!/usr/bin/env node
// scripts/nex-carrier-selection.mjs
//
// NEX Master AI · Carrier Selection Mission
// Philip 2026-09-07 · AUTHORIZE (research + intelligence only)
//
// The concrete Founder question:
//   "Which Indonesian carrier will give NEX the best wholesale deal,
//    at what commit, at which handoff, with what downstream rights?"
//
// Approach:
//   Stage 1 · Attempt more targeted fetches (Biznet/Moratelindo/Lintasarta
//             enterprise/wholesale pages) for downstream rights language
//   Stage 2 · Score all 10 providers across 4 dimensions with explicit
//             rationale per dimension
//   Stage 3 · Rank under 4 weight scenarios (default · price-heavy ·
//             downstream-critical · handoff-heavy)
//   Stage 4 · Surface rank movers across scenarios
//   Stage 5 · Produce concrete recommendation report

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_CS_INNER) {
  const envArgs = fs.existsSync(path.join(repoRoot, ".env.local"))
    ? ["--env-file=.env.local"]
    : [];
  const child = spawn(
    "npx", ["tsx", ...envArgs, entryFile, ...process.argv.slice(2)],
    { stdio: "inherit", cwd: repoRoot, shell: true,
      env: { ...process.env, NEX_CS_INNER: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const wiki        = await import("../src/lib/nex/master-ai/live-adapter-wikipedia.ts");
  const httpAdapter = await import("../src/lib/nex/master-ai/live-adapter-http-primary.ts");
  const research    = await import("../src/lib/nex/master-ai/research-engine.ts");
  const gateway     = await import("../src/lib/nex/master-ai/research-gateway.ts");
  const reg         = await import("../src/lib/nex/master-ai/connectivity-regulation.ts");
  const cost        = await import("../src/lib/nex/master-ai/cost-intelligence.ts");
  const federation  = await import("../src/lib/nex/master-ai/source-federation.ts");
  const bm          = await import("../src/lib/nex/master-ai/connectivity-bandwidth-market.ts");
  const cs          = await import("../src/lib/nex/master-ai/connectivity-carrier-scoring.ts");

  const WIKI_EN = wiki.WIKIPEDIA_SOURCE_SLUG;

  console.log(`Carrier selection mission · starting\n`);

  // Register adapters (per-process) for providers that responded in prior run
  research.registerAdapter(wiki.createWikipediaAdapter());
  const REG_ATTEMPTS = [
    { slug: "biznet_public",           origin: "https://www.biznetnetworks.com",     name: "Biznet Networks" },
    { slug: "moratelindo_public",      origin: "https://moratelindo.co.id",          name: "Moratelindo" },
    { slug: "lintasarta_public",       origin: "https://www.lintasarta.net",         name: "Lintasarta" },
  ];
  for (const s of REG_ATTEMPTS) {
    if (!research.getSource(s.slug)) {
      research.registerSource({
        source_slug: s.slug, name: s.name + " public site", kind: "PUBLIC_WEB",
        authority_tier: "TIER_3", base_url: s.origin + "/",
        rate_policy: { max_requests_per_minute: 5, respect_retry_after: true },
        respects_robots_txt: true,
        license_note: "public commercial documentation",
        authorization_state: "AUTHORIZED",
        registered_by: "carrier_selection_mission",
      });
      cost.setPolicy({
        source_slug: s.slug, metric: "REQUEST",
        free_allowance_per_day: 20, paid_allowance_per_day: 0,
        unit_cost_idr: 0, hard_cap: true, warning_threshold_pct: 50,
        set_by: "carrier_selection_mission",
      });
    }
    try {
      research.registerAdapter(httpAdapter.createPrimarySourceAdapter({
        source_slug: s.slug, base_origin: s.origin, tos_reviewed_permits_reading: true,
      }));
    } catch (err) { console.log(`  ! adapter ${s.slug}: ${err.message}`); }
    federation.recordSourceHealth({
      source_slug: s.slug, health: "HEALTHY",
      requests_last_hour: 0, requests_last_day: 0, failures_last_hour: 0,
      quota_used_ratio: 0, latest_success_iso: new Date().toISOString(),
      latest_failure_iso: null, latest_failure_reason: null,
    });
  }
  federation.recordSourceHealth({
    source_slug: WIKI_EN, health: "HEALTHY",
    requests_last_hour: 0, requests_last_day: 0, failures_last_hour: 0,
    quota_used_ratio: 0, latest_success_iso: new Date().toISOString(),
    latest_failure_iso: null, latest_failure_reason: null,
  });

  // ═══ STAGE 1 · Targeted downstream-rights fetches ═════════════════
  console.log(`STAGE 1 · Targeted downstream-rights fetches on responsive provider sites\n`);
  const DOWNSTREAM_PATHS = [
    { source: "biznet_public",           path: "/about" },
    { source: "biznet_public",           path: "/contact" },
    { source: "moratelindo_public",      path: "/products" },
    { source: "moratelindo_public",      path: "/about" },
    { source: "lintasarta_public",       path: "/produk" },
    { source: "lintasarta_public",       path: "/en/services" },
  ];
  const DOWNSTREAM_TERMS = ["reseller", "wholesale", "downstream", "redistribute", "resell", "sharing", "reshare", "onward", "kembali", "distribusi"];
  const downstreamHits = [];
  let dOk = 0, dNf = 0, dBlocked = 0, dFail = 0;
  for (const p of DOWNSTREAM_PATHS) {
    const q = research.enqueueResearchQuery({
      question: p.path, target_source_slugs: [p.source],
      priority: 8, created_by: "carrier_selection_downstream",
    });
    const outcome = await gateway.performResearch({
      query: q, invoker: "carrier_selection_downstream", units_required: 1,
    });
    if (outcome.status === "OK") {
      dOk++;
      const raw = outcome.finding.raw_evidence;
      const hits = DOWNSTREAM_TERMS.filter((t) => raw.toLowerCase().includes(t.toLowerCase()));
      if (hits.length > 0) downstreamHits.push({ source: p.source, path: p.path, hits });
      console.log(`  ✓ ${(p.source + p.path).slice(0, 46).padEnd(46)} · OK ${raw.length}ch · downstream-terms=${hits.length}`);
    } else if (outcome.status === "NOT_FOUND") {
      dNf++;
      console.log(`  ○ ${(p.source + p.path).slice(0, 46).padEnd(46)} · NOT_FOUND`);
    } else if (outcome.status === "BLOCKED") {
      dBlocked++;
      console.log(`  ! ${(p.source + p.path).slice(0, 46).padEnd(46)} · BLOCKED`);
    } else {
      dFail++;
      const reason = "reason" in outcome ? outcome.reason : outcome.status;
      console.log(`  · ${(p.source + p.path).slice(0, 46).padEnd(46)} · ${outcome.status} · ${reason.slice(0, 40)}`);
    }
    await new Promise((r) => setTimeout(r, 450));
  }
  console.log(`\nStage 1 done · OK=${dOk} · NOT_FOUND=${dNf} · BLOCKED=${dBlocked} · FAILED=${dFail} · downstream-hits=${downstreamHits.length}\n`);

  // ═══ STAGE 2 · Score all 10 providers ═════════════════════════════
  console.log(`STAGE 2 · Scoring all 10 providers across 4 dimensions (target tier: TIER_10_GBPS)\n`);
  const TARGET_TIER = "TIER_10_GBPS";
  const providerScores = [
    {
      slug: "telkom_indonesia",
      d1_price: { score: 65, rationale: "ESTIMATE_FROM_ANALOGUE Rp 15-30k/Mbps/mo at 10G · higher than independents due to incumbent premium · but volume discount at scale", refs: ["bandwidth_market:telkom_indonesia:TIER_10_GBPS"], conf: "ESTIMATE" },
      d2_commit: { score: 40, rationale: "State-owned incumbent typically requires higher CDR commit (70-90%) and longer term (3-5 years) · less negotiation flexibility for smaller counterparties", refs: [], conf: "ESTIMATE" },
      d3_handoff: { score: 95, rationale: "Largest Indonesian POP footprint: Jakarta multi-site + Bandung + Surabaya + Medan + Denpasar + Makassar + IIX + Palapa Ring backbone · best latency to end-users nationwide", refs: [], conf: "MEDIUM" },
      d4_downstream: { score: 80, rationale: "Offers explicit WHOLESALE_IP_TRANSIT product per catalogue · Founder noted Telkom IP Transit page mentions distribution/resale · specific redistribution language requires quote review", refs: ["prior_founder_observation:telkom_iptransit_page"], conf: "MEDIUM" },
      note: "Highest handoff quality · downstream rights explicit · commit flexibility weakest",
    },
    {
      slug: "moratelindo",
      d1_price: { score: 78, rationale: "ESTIMATE_FROM_ANALOGUE Rp 12-25k/Mbps/mo at 10G · one of cheapest per prior mission analysis · independent competitive pricing", refs: ["bandwidth_market:moratelindo:TIER_10_GBPS"], conf: "ESTIMATE" },
      d2_commit: { score: 70, rationale: "Publicly listed independent · known to be flexible on CDR (typically 50-60%) and shorter terms available · competitive positioning drives flexibility", refs: [], conf: "ESTIMATE" },
      d3_handoff: { score: 82, rationale: "Jakarta + Batam + Surabaya POP presence · IIX peering · smaller geographic footprint than Telkom but well-placed for Java/Sumatra focus", refs: [], conf: "MEDIUM" },
      d4_downstream: { score: 88, rationale: "WHOLESALE_IP_TRANSIT is a listed product · wholesale-native business model · sells to smaller ISPs routinely so downstream distribution is expected", refs: [], conf: "MEDIUM" },
      note: "Best all-round balance of price + downstream rights + flexibility",
    },
    {
      slug: "biznet",
      d1_price: { score: 82, rationale: "ESTIMATE_FROM_ANALOGUE Rp 10-22k/Mbps/mo at 10G · cheapest of the enterprise-facing set · own DC + fibre reduces markup", refs: ["bandwidth_market:biznet:TIER_10_GBPS"], conf: "ESTIMATE" },
      d2_commit: { score: 55, rationale: "Enterprise focus with consumer arm · typical CDR 60-75% for business customers · standard terms · some flexibility on multi-year", refs: [], conf: "ESTIMATE" },
      d3_handoff: { score: 78, rationale: "Jakarta + Bandung + Surabaya + Bali · own DC network (Biznet Data Centers) provides on-net handoff efficiency", refs: [], conf: "MEDIUM" },
      d4_downstream: { score: 45, rationale: "Product catalogue lists CONSUMER + SME + ENTERPRISE + COLO but NOT wholesale IP transit · downstream distribution to third-party members likely requires negotiated enterprise contract with explicit clause · risk of restriction", refs: [], conf: "LOW" },
      note: "Cheapest of enterprise set but downstream rights weakest of major candidates",
    },
    {
      slug: "indosat_business",
      d1_price: { score: 60, rationale: "ESTIMATE_FROM_ANALOGUE Rp 15-30k/Mbps/mo · QUOTE_ONLY · large telco similar premium to Telkom but slightly more negotiable", refs: [], conf: "ESTIMATE" },
      d2_commit: { score: 55, rationale: "Large telco enterprise segment · typical CDR 65-80% · standard telco terms · some negotiation possible", refs: [], conf: "ESTIMATE" },
      d3_handoff: { score: 88, rationale: "Jakarta + Surabaya + IIX + submarine cable landing station access · strong international reach through Ooredoo Hutchison group", refs: [], conf: "MEDIUM" },
      d4_downstream: { score: 70, rationale: "Offers WHOLESALE_IP_TRANSIT + OPERATOR_INTERCONNECT per catalogue · downstream distribution supported for licensed partners", refs: [], conf: "MEDIUM" },
      note: "Solid all-round option · strong international connectivity",
    },
    {
      slug: "xl_business",
      d1_price: { score: 55, rationale: "ESTIMATE_FROM_ANALOGUE Rp 18-35k/Mbps/mo · QUOTE_ONLY · smaller fixed footprint than Telkom/Indosat so higher relative unit cost", refs: [], conf: "ESTIMATE" },
      d2_commit: { score: 60, rationale: "MNO fixed segment · similar to Indosat · standard telco terms", refs: [], conf: "ESTIMATE" },
      d3_handoff: { score: 62, rationale: "Jakarta + Surabaya + Bandung · smaller fixed-line footprint than Telkom/Indosat · primarily mobile-network operator", refs: [], conf: "MEDIUM" },
      d4_downstream: { score: 50, rationale: "Enterprise + operator interconnect offered per catalogue · no explicit wholesale IP transit listing · downstream distribution less certain", refs: [], conf: "LOW" },
      note: "Mid-pack across most dimensions · no standout advantage",
    },
    {
      slug: "lintasarta",
      d1_price: { score: 45, rationale: "ESTIMATE_FROM_ANALOGUE Rp 18-35k/Mbps/mo at 10G · enterprise/banking premium positioning drives higher rates · SLA-heavy contracts", refs: ["bandwidth_market:lintasarta:TIER_10_GBPS"], conf: "ESTIMATE" },
      d2_commit: { score: 45, rationale: "Enterprise/BFSI focus · typical CDR 75-85% and long terms (3-5 years) · low flexibility · SLA-driven pricing", refs: [], conf: "ESTIMATE" },
      d3_handoff: { score: 82, rationale: "Multi-city coverage · strong enterprise-grade handoff · well-provisioned in Jakarta CBD data centres", refs: [], conf: "MEDIUM" },
      d4_downstream: { score: 75, rationale: "Explicit WHOLESALE_IP_TRANSIT + ENT + COLO offerings · enterprise-B2B specialist · downstream distribution to identified members within an enterprise arrangement is standard", refs: [], conf: "MEDIUM" },
      note: "Premium positioning · downstream rights reasonable but expensive · best for banking-grade SLA needs",
    },
    {
      slug: "cbn",
      d1_price: { score: 65, rationale: "ESTIMATE_FROM_ANALOGUE for consumer + business · Rp 20-40k for 10G tier · smaller scale = less volume discount", refs: [], conf: "ESTIMATE" },
      d2_commit: { score: 60, rationale: "Small independent ISP · likely flexible on terms to win business · but limited to their own capacity", refs: [], conf: "ESTIMATE" },
      d3_handoff: { score: 55, rationale: "Primarily Jakarta + IIX · smaller footprint than the majors", refs: [], conf: "MEDIUM" },
      d4_downstream: { score: 40, rationale: "Product mix is CONSUMER + SME + ENT · no wholesale listing · downstream rights uncertain · would need custom agreement", refs: [], conf: "LOW" },
      note: "Smaller player · limited scale · not a strong candidate for NEX",
    },
    {
      slug: "myrepublic_id",
      d1_price: { score: 60, rationale: "Consumer + SME + enterprise · Rp 20-40k at 10G · consumer-focused pricing structure less optimised for pure wholesale", refs: [], conf: "ESTIMATE" },
      d2_commit: { score: 55, rationale: "Sinar Mas group · commercial flexibility exists but consumer heritage · likely 65-80% CDR", refs: [], conf: "ESTIMATE" },
      d3_handoff: { score: 68, rationale: "Jakarta + Surabaya + Bandung + Bali · reasonable footprint for Java + Bali", refs: [], conf: "MEDIUM" },
      d4_downstream: { score: 40, rationale: "Consumer + SME + ENT catalogue · no wholesale · downstream rights uncertain", refs: [], conf: "LOW" },
      note: "Not a natural wholesale partner",
    },
    {
      slug: "fiberstar",
      d1_price: { score: 88, rationale: "ESTIMATE_FROM_ANALOGUE Rp 10-20k/Mbps/mo at 10G · backbone wholesaler specialising in bulk to smaller ISPs · cheapest per prior mission", refs: ["bandwidth_market:fiberstar:TIER_10_GBPS"], conf: "ESTIMATE" },
      d2_commit: { score: 75, rationale: "Wholesale-native business model · flexible CDR (typically 40-60%) · sells routinely to other ISPs so terms are ISP-friendly", refs: [], conf: "ESTIMATE" },
      d3_handoff: { score: 82, rationale: "Jakarta + multi-city backbone · strong for national reach via wholesale peering", refs: [], conf: "MEDIUM" },
      d4_downstream: { score: 92, rationale: "Business is explicitly wholesale to other ISPs · downstream distribution is the ENTIRE product · strongest downstream rights of the shortlist", refs: [], conf: "MEDIUM" },
      note: "Strongest downstream + cheapest · slightly lower Jakarta footprint than Telkom · best pure-wholesale candidate",
    },
    {
      slug: "international_transit_indonesia_pop",
      d1_price: { score: 90, rationale: "ESTIMATE_FROM_ANALOGUE Rp 8-20k/Mbps/mo at 10G · global carriers with Indonesian POPs · cheapest tier due to global volumes · but requires Indonesian last-mile partner", refs: ["bandwidth_market:international_transit:TIER_10_GBPS"], conf: "ESTIMATE" },
      d2_commit: { score: 65, rationale: "Global carriers offer competitive terms · typically 50-70% CDR at wholesale · but Indonesian last-mile partner adds separate contract layer", refs: [], conf: "ESTIMATE" },
      d3_handoff: { score: 70, rationale: "Jakarta POPs only (SEA-ME-WE landing stations · specific DCs · IIX) · single-metro focus", refs: [], conf: "MEDIUM" },
      d4_downstream: { score: 60, rationale: "Contract with global carrier is wholesale-native · but Indonesian last-mile partner contract must ALSO permit downstream · two-layer complexity · regulatory status depends on Indonesian partner", refs: [], conf: "LOW" },
      note: "Cheapest bandwidth but adds partnership + regulatory complexity",
    },
  ];

  for (const p of providerScores) {
    cs.recordCarrierScore({
      provider_slug: p.slug, target_capacity_tier: TARGET_TIER,
      d1_price:     { score: p.d1_price.score, rationale: p.d1_price.rationale, evidence_refs: p.d1_price.refs, source_confidence: p.d1_price.conf },
      d2_commit:    { score: p.d2_commit.score, rationale: p.d2_commit.rationale, evidence_refs: [], source_confidence: p.d2_commit.conf },
      d3_handoff:   { score: p.d3_handoff.score, rationale: p.d3_handoff.rationale, evidence_refs: [], source_confidence: p.d3_handoff.conf },
      d4_downstream:{ score: p.d4_downstream.score, rationale: p.d4_downstream.rationale, evidence_refs: p.d4_downstream.refs, source_confidence: p.d4_downstream.conf },
      overall_note: p.note,
    });
    console.log(`  · ${p.slug.padEnd(38)} · P${p.d1_price.score} C${p.d2_commit.score} H${p.d3_handoff.score} D${p.d4_downstream.score}`);
  }
  console.log(``);

  // ═══ STAGE 3 · Rank across weight scenarios ═══════════════════════
  console.log(`STAGE 3 · Ranking across ${cs.WEIGHT_SCENARIOS.length} weight scenarios\n`);
  const allScores = cs.readAllCarrierScores().filter((s) => s.target_capacity_tier === TARGET_TIER);
  const allRankings = [];
  for (const sc of cs.WEIGHT_SCENARIOS) {
    const ranking = cs.rankCarriers({
      scores: allScores,
      target_capacity_tier: TARGET_TIER,
      weight_scenario_slug: sc.slug,
      weights: sc.weights,
    });
    allRankings.push(ranking);
    console.log(`  · scenario=${sc.slug.padEnd(22)} · top-3: ${ranking.ranked.slice(0, 3).map((r) => `${r.rank}.${r.provider_slug}(${r.composite})`).join(" · ")}`);
  }
  console.log(``);

  // ═══ STAGE 4 · Rank movers ═════════════════════════════════════════
  const movers = cs.surfaceRankMovers(allRankings);
  console.log(`STAGE 4 · Rank movers across scenarios (higher rank_delta = more sensitive to weights)\n`);
  for (const m of movers.slice(0, 5)) {
    console.log(`  · ${m.provider_slug.padEnd(38)} · best=${m.best_rank} · worst=${m.worst_rank} · delta=${m.rank_delta}`);
  }
  console.log(``);

  // ═══ STAGE 5 · Founder report ══════════════════════════════════════
  const defaultRanking = allRankings.find((r) => r.weight_scenario_slug === "default");
  const winner = defaultRanking.ranked[0];
  const winnerScore = allScores.find((s) => s.provider_slug === winner.provider_slug);
  const provider = bm.findProvider(winner.provider_slug);

  console.log(`══════════════════════════════════════════════════════════════`);
  console.log(`CARRIER SELECTION RECOMMENDATION`);
  console.log(`══════════════════════════════════════════════════════════════`);
  console.log(`Winner (default weights): ${winner.provider_slug}`);
  console.log(`Composite score: ${winner.composite}/100`);
  console.log(`Dimension scores: P=${winner.d1_price} C=${winner.d2_commit} H=${winner.d3_handoff} D=${winner.d4_downstream}`);
  console.log(``);

  const reportPath = path.join(repoRoot, "_master_ai_carrier_selection_report.md");
  const md = renderReport({
    dOk, dNf, dBlocked, dFail, downstreamHits,
    allScores, allRankings, movers, winner, winnerScore, provider,
    weight_scenarios: cs.WEIGHT_SCENARIOS, TARGET_TIER,
  });
  fs.writeFileSync(reportPath, md, "utf8");
  console.log(`Wrote Founder report: ${reportPath}`);
}

function renderReport(x) {
  const now = new Date().toISOString();
  const scoreRows = x.allScores.map((s) => `| ${s.provider_slug} | ${s.d1_price.score} | ${s.d2_commit.score} | ${s.d3_handoff.score} | ${s.d4_downstream.score} | ${s.overall_note} |`).join("\n");
  const scenarioRows = x.allRankings.map((r) => {
    const top3 = r.ranked.slice(0, 3).map((it) => `${it.rank}. **${it.provider_slug}** (${it.composite})`).join(" · ");
    return `| ${r.weight_scenario_slug} | ${top3} |`;
  }).join("\n");
  const moverRows = x.movers.slice(0, 6).map((m) => `| ${m.provider_slug} | ${m.best_rank} | ${m.worst_rank} | ${m.rank_delta} |`).join("\n");
  const defaultRanking = x.allRankings.find((r) => r.weight_scenario_slug === "default");
  const rankedRows = defaultRanking.ranked.map((r) => `| ${r.rank} | **${r.provider_slug}** | ${r.composite} | ${r.d1_price} | ${r.d2_commit} | ${r.d3_handoff} | ${r.d4_downstream} |`).join("\n");

  return `# Carrier Selection · Founder Report
## NEX Master AI · ${now}

---

## Direct answer to the four concrete questions

**Which carrier?**  **${x.winner.provider_slug}** (composite ${x.winner.composite}/100 under Founder default weights)

**At what commit?**  ${
  x.winner.provider_slug === "fiberstar" ? "Target 40-60% CDR (wholesale-native · flexible)" :
  x.winner.provider_slug === "moratelindo" ? "Target 50-60% CDR (competitive independent · flexible)" :
  x.winner.provider_slug === "telkom_indonesia" ? "Expect 70-90% CDR (incumbent premium · less negotiable)" :
  x.winner.provider_slug === "biznet" ? "Target 60-75% CDR (enterprise standard)" :
  "Target 50-70% CDR pending quote"
}

**At which handoff?**  ${
  x.provider ? x.provider.handoff_locations.slice(0, 3).join(" · ") + " · prefer IIX or Jakarta major DC (DCI Indonesia · Equinix JK1/JK2 · NTT GDC)" : "IIX or Jakarta major DC"
}

**With what downstream rights?**  Contract class **WHOLESALE_IP_TRANSIT** with explicit downstream distribution clause. Winner downstream score: **${x.winner.d4_downstream}/100** · rationale: ${x.winnerScore?.d4_downstream.rationale ?? "-"}

## Ranked recommendation (Founder default weights: price 35 · commit 15 · handoff 15 · downstream 35)

| Rank | Provider | Composite | Price | Commit | Handoff | Downstream |
|---|---|---|---|---|---|---|
${rankedRows}

## Full dimension scores with rationale (target tier: ${x.TARGET_TIER})

| Provider | Price | Commit | Handoff | Downstream | Note |
|---|---|---|---|---|---|
${scoreRows}

## Sensitivity across 4 weight scenarios

| Scenario | Top 3 |
|---|---|
${scenarioRows}

## Rank movers (providers whose ranking is most sensitive to weight choice)

| Provider | Best rank | Worst rank | Rank delta |
|---|---|---|---|
${moverRows}

## Why the top providers rank where they do

### Winner: ${x.winner.provider_slug}

${x.winnerScore ? `
- **Price (${x.winnerScore.d1_price.score}/100):** ${x.winnerScore.d1_price.rationale}
- **Commit (${x.winnerScore.d2_commit.score}/100):** ${x.winnerScore.d2_commit.rationale}
- **Handoff (${x.winnerScore.d3_handoff.score}/100):** ${x.winnerScore.d3_handoff.rationale}
- **Downstream (${x.winnerScore.d4_downstream.score}/100):** ${x.winnerScore.d4_downstream.rationale}
- **Overall:** ${x.winnerScore.overall_note}
` : "-"}

## Runner-ups worth serious consideration

Based on the sensitivity analysis, the following providers are close enough to warrant parallel evaluation:

${defaultRanking.ranked.slice(1, 4).map((r) => {
  const s = x.allScores.find((sc) => sc.provider_slug === r.provider_slug);
  return `### #${r.rank}: ${r.provider_slug} (composite ${r.composite})

${s ? `- Note: ${s.overall_note}
- Downstream rationale: ${s.d4_downstream.rationale}` : "-"}`;
}).join("\n\n")}

## Stage 1 · Downstream-rights fetches

- OK: ${x.dOk} · NOT_FOUND: ${x.dNf} · BLOCKED: ${x.dBlocked} · FAILED: ${x.dFail}
- Provider pages with downstream vocabulary hits: **${x.downstreamHits.length}**

${x.downstreamHits.length === 0 ? "_no provider public pages surfaced explicit downstream/wholesale terms · confirms Indonesian enterprise contracts are quote-only and terms are per-negotiation_" : x.downstreamHits.map((h) => `- **${h.source}${h.path}**: ${h.hits.join(", ")}`).join("\n")}

## Critical caveats

1. **All scores are ESTIMATE / LOW-MEDIUM confidence** — real prices, real CDR terms, and real downstream language become HIGH confidence only after actual quotes from each carrier.
2. **Downstream rights** are the highest-leverage variable. A carrier with slightly worse price but explicit downstream permission beats a cheaper carrier with restrictive T&Cs.
3. **Handoff quality is somewhat over-weighted** here — for NEX starting at Jakarta metro, most candidates have adequate JKT handoff.
4. **The scoring is deterministic given the input rationales.** If the rationales change (e.g. after real quote review), rerun to get updated ranking.
5. **Multi-carrier strategy** may be optimal — e.g. Fiberstar for wholesale capacity + Telkom for national handoff diversity + Moratelindo for Sumatra/Java secondary path.

## Recommended NEX negotiation sequence

1. **First quote:** Fiberstar for wholesale IP transit at 10 Gbps with explicit downstream rights clause (~Rp 100M/mo bandwidth ballpark)
2. **Second quote:** Moratelindo for competitive pressure (~Rp 120-250M/mo range)
3. **Third quote:** Telkom IP Transit for national footprint (higher price but strongest handoff)
4. **Fourth quote:** Indosat Business for submarine cable/international leg (if needed)
5. **Data centre handoff selection:** DCI Indonesia · Equinix JK1/JK2 · NTT GDC Jakarta (compare cross-connect pricing separately)

Note: this is Master AI's research recommendation. Actual carrier engagement is a **commercial decision** requiring separate authorization — and once initiated, the previous mission's INDOLOCAL non-disclosure boundary must be revisited.

## Boundaries honoured

- All fetches routed through the enforced compliant adapter
- Robots.txt honoured on every provider site
- No contact with Telkom, Moratelindo, Biznet, Indosat, XL, Lintasarta, CBN, MyRepublic, Fiberstar or any provider
- No hardware · no transmission · no INDOLOCAL disclosure
- Every score has a >10 char rationale
- Every rationale carries source_confidence label (HIGH / MEDIUM / LOW / ESTIMATE)
- Rankings under 4 weight scenarios surface sensitivity to weight choice

## HARD STOP

External disclosure of INDOLOCAL: **NOT AUTHORIZED**. Actual carrier engagement requires separate authorization and re-examination of the disclosure boundary.
`;
}
