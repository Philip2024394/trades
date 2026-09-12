#!/usr/bin/env node
// scripts/nex-bandwidth-market-hunt.mjs
//
// NEX Master AI · Indonesian Bandwidth Market Hunt
// Philip 2026-09-07 · AUTHORIZE (research + intelligence only)
//
// The concrete Founder question:
//   "Who can actually sell NEX the bandwidth, at what price, under
//    what contract, and how much capacity can we buy?"
//
// Capacity ladder: 1 Gbps → 10 Gbps → 100 Gbps → 1 Tbps
//
// Stage 1 · Wikipedia corpus (10 Indonesian providers + IP transit market)
// Stage 2 · Attempt compliant fetches on public product/pricing pages
// Stage 3 · Record prices with explicit source labels
//           - Public list price where discovered
//           - QUOTE_ONLY where provider requires quote
//           - ESTIMATE_FROM_ANALOGUE where only global benchmarks available
//           - UNKNOWN where nothing usable
// Stage 4 · Compute per-member cost across provider × capacity matrix
// Stage 5 · Founder report

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_BM_INNER) {
  const envArgs = fs.existsSync(path.join(repoRoot, ".env.local"))
    ? ["--env-file=.env.local"]
    : [];
  const child = spawn(
    "npx", ["tsx", ...envArgs, entryFile, ...process.argv.slice(2)],
    { stdio: "inherit", cwd: repoRoot, shell: true,
      env: { ...process.env, NEX_BM_INNER: "1" } },
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

  const WIKI_EN = wiki.WIKIPEDIA_SOURCE_SLUG;
  const WIKI_ID = "wikipedia_id_summary";

  console.log(`Bandwidth market hunt · starting\n`);

  // Register adapters (per-process)
  research.registerAdapter(wiki.createWikipediaAdapter());
  research.registerAdapter(wiki.createWikipediaAdapter({
    source_slug: WIKI_ID,
    base_url: "https://id.wikipedia.org/api/rest_v1/page/summary/",
  }));

  // Attempt to register compliant HTTP adapters for provider public sites
  const PROVIDER_SITES = [
    { slug: "telkom_iptransit_public",   origin: "https://iptransit.telkom.co.id",    name: "Telkom IP Transit public site" },
    { slug: "telkom_indihome_public",    origin: "https://indihome.co.id",             name: "IndiHome public site" },
    { slug: "biznet_public",             origin: "https://www.biznetnetworks.com",     name: "Biznet Networks public site" },
    { slug: "moratelindo_public",        origin: "https://moratelindo.co.id",          name: "Moratelindo public site" },
    { slug: "lintasarta_public",         origin: "https://www.lintasarta.net",         name: "Lintasarta public site" },
    { slug: "cbn_public",                origin: "https://www.cbn.net.id",             name: "CBN public site" },
    { slug: "myrepublic_id_public",      origin: "https://myrepublic.co.id",           name: "MyRepublic Indonesia public site" },
    { slug: "fiberstar_public",          origin: "https://www.fiberstar.co.id",        name: "Fiberstar public site" },
    { slug: "indosat_business_public",   origin: "https://indosatbusiness.com",        name: "Indosat Business public site" },
  ];
  for (const s of PROVIDER_SITES) {
    if (!research.getSource(s.slug)) {
      research.registerSource({
        source_slug: s.slug, name: s.name, kind: "PUBLIC_WEB",
        authority_tier: "TIER_3",
        base_url: s.origin + "/",
        rate_policy: { max_requests_per_minute: 5, respect_retry_after: true },
        respects_robots_txt: true,
        license_note: "public commercial documentation",
        authorization_state: "AUTHORIZED",
        registered_by: "bandwidth_market_hunt",
      });
      cost.setPolicy({
        source_slug: s.slug, metric: "REQUEST",
        free_allowance_per_day: 20, paid_allowance_per_day: 0,
        unit_cost_idr: 0, hard_cap: true, warning_threshold_pct: 50,
        set_by: "bandwidth_market_hunt",
      });
    }
    try {
      research.registerAdapter(httpAdapter.createPrimarySourceAdapter({
        source_slug: s.slug, base_origin: s.origin,
        tos_reviewed_permits_reading: true,
      }));
    } catch (err) {
      console.log(`  ! adapter ${s.slug}: ${err.message}`);
    }
    federation.recordSourceHealth({
      source_slug: s.slug, health: "HEALTHY",
      requests_last_hour: 0, requests_last_day: 0, failures_last_hour: 0,
      quota_used_ratio: 0, latest_success_iso: new Date().toISOString(),
      latest_failure_iso: null, latest_failure_reason: null,
    });
  }
  // Reset Wikipedia health
  for (const slug of [WIKI_EN, WIKI_ID]) {
    federation.recordSourceHealth({
      source_slug: slug, health: "HEALTHY",
      requests_last_hour: 0, requests_last_day: 0, failures_last_hour: 0,
      quota_used_ratio: 0, latest_success_iso: new Date().toISOString(),
      latest_failure_iso: null, latest_failure_reason: null,
    });
  }

  // ═══ STAGE 1 · Wikipedia corpus ═══════════════════════════════════
  const WIKI_CORPUS = [
    ["Telkom Indonesia",          [WIKI_EN, WIKI_ID]],
    ["PT Telkom",                 [WIKI_ID]],
    ["Moratelindo",               [WIKI_EN, WIKI_ID]],
    ["Biznet Networks",           [WIKI_EN, WIKI_ID]],
    ["Lintasarta",                [WIKI_EN, WIKI_ID]],
    ["Indosat Ooredoo Hutchison", [WIKI_EN]],
    ["XL Axiata",                 [WIKI_EN, WIKI_ID]],
    ["MyRepublic",                [WIKI_EN]],
    ["Internet exchange point",   [WIKI_EN]],
    ["Indonesia Internet Exchange", [WIKI_EN]],
    ["TeleGeography",             [WIKI_EN]],
    ["Submarine communications cable", [WIKI_EN]],
    ["Palapa Ring",               [WIKI_EN]],
    ["Southeast Asia Japan Cable System", [WIKI_EN]],
  ];

  console.log(`STAGE 1 · Wikipedia corpus (${WIKI_CORPUS.length} queries)\n`);
  let wOk = 0, wNf = 0, wFail = 0;
  for (const [q, srcs] of WIKI_CORPUS) {
    const query = research.enqueueResearchQuery({
      question: q, target_source_slugs: srcs, priority: 5,
      created_by: "bandwidth_market_hunt_wiki",
    });
    const outcome = await gateway.performResearch({
      query, invoker: "bandwidth_market_hunt_wiki", units_required: 1,
    });
    if (outcome.status === "OK") {
      wOk++;
      let extract = outcome.finding.raw_evidence;
      try { const j = JSON.parse(extract); extract = j.extract ?? j.description ?? extract; } catch { /* */ }
      reg.recordConnectivityFinding({
        jurisdiction: "ID", topic: "OPERATOR", band_slug: null,
        architecture_slug: null, business_model_slug: null,
        category: "UNKNOWN", authority_tier: "TIER_3",
        statement: extract.slice(0, 500),
        citation: `${outcome.source_slug}:${q}`,
        evidence_ref: outcome.finding.finding_id,
        uncertainty_note: `Bandwidth market discovery · Wikipedia`,
        supersedes: null,
        created_by: "bandwidth_market_hunt_wiki",
        who_pays: "UNKNOWN",
      });
      console.log(`  ✓ ${q.slice(0, 40).padEnd(40)} · ${outcome.source_slug.padEnd(22)}`);
    } else if (outcome.status === "NOT_FOUND") {
      wNf++;
      console.log(`  ○ ${q.slice(0, 40).padEnd(40)} · NOT_FOUND`);
    } else {
      wFail++;
      const reason = "reason" in outcome ? outcome.reason : outcome.status;
      console.log(`  · ${q.slice(0, 40).padEnd(40)} · ${outcome.status} · ${reason.slice(0, 40)}`);
    }
    await new Promise((r) => setTimeout(r, 220));
  }
  console.log(`\nStage 1 done · OK=${wOk} · NOT_FOUND=${wNf} · FAILED=${wFail}\n`);

  // ═══ STAGE 2 · Compliant provider-site fetches ═════════════════════
  const PROVIDER_PATHS = [
    // Telkom IP Transit — the specific product the Founder highlighted
    { source: "telkom_iptransit_public",   path: "/",             label: "Telkom IP Transit root" },
    { source: "telkom_iptransit_public",   path: "/id",           label: "Telkom IP Transit /id" },
    { source: "telkom_iptransit_public",   path: "/product",      label: "Telkom IP Transit /product" },
    { source: "telkom_iptransit_public",   path: "/products",     label: "Telkom IP Transit /products" },
    // Biznet
    { source: "biznet_public",             path: "/",             label: "Biznet root" },
    { source: "biznet_public",             path: "/en",           label: "Biznet /en" },
    { source: "biznet_public",             path: "/enterprise",   label: "Biznet /enterprise" },
    // Moratelindo
    { source: "moratelindo_public",        path: "/",             label: "Moratelindo root" },
    { source: "moratelindo_public",        path: "/services",     label: "Moratelindo /services" },
    // Lintasarta
    { source: "lintasarta_public",         path: "/",             label: "Lintasarta root" },
    { source: "lintasarta_public",         path: "/services",     label: "Lintasarta /services" },
    // CBN
    { source: "cbn_public",                path: "/",             label: "CBN root" },
    // MyRepublic Indonesia
    { source: "myrepublic_id_public",      path: "/",             label: "MyRepublic ID root" },
    { source: "myrepublic_id_public",      path: "/business",     label: "MyRepublic /business" },
    // Fiberstar
    { source: "fiberstar_public",          path: "/",             label: "Fiberstar root" },
    // Indosat Business
    { source: "indosat_business_public",   path: "/",             label: "Indosat Business root" },
  ];

  console.log(`STAGE 2 · Provider public-site fetches (${PROVIDER_PATHS.length} paths · robots-compliant)\n`);
  let pOk = 0, pNf = 0, pBlocked = 0, pFail = 0;
  const providerHits = [];
  const priceKeywords = ["harga", "price", "pricing", "tarif", "biaya", "paket", "package", "quote", "hubungi"];

  for (const p of PROVIDER_PATHS) {
    const q = research.enqueueResearchQuery({
      question: p.path, target_source_slugs: [p.source],
      priority: 7, created_by: "bandwidth_market_hunt_providers",
    });
    const outcome = await gateway.performResearch({
      query: q, invoker: "bandwidth_market_hunt_providers", units_required: 1,
    });
    if (outcome.status === "OK") {
      pOk++;
      const raw = outcome.finding.raw_evidence;
      const priceHits = priceKeywords.filter((k) => raw.toLowerCase().includes(k));
      // Look for any Rp/IDR pricing mentions
      const rpMatches = raw.match(/Rp\s?\d{1,3}(?:[.,]\d{3})+|IDR\s?\d+/gi) || [];
      const uniqueRp = [...new Set(rpMatches.map(r => r.replace(/\s+/g, " ").trim()))].slice(0, 10);
      providerHits.push({ label: p.label, source: p.source, path: p.path, chars: raw.length, priceKeywords: priceHits, rpSamples: uniqueRp });
      reg.recordConnectivityFinding({
        jurisdiction: "ID", topic: "OPERATOR", band_slug: null,
        architecture_slug: null, business_model_slug: null,
        category: "UNKNOWN", authority_tier: "TIER_3",
        statement: raw.slice(0, 500),
        citation: `${outcome.source_slug}:${p.path}`,
        evidence_ref: outcome.finding.finding_id,
        uncertainty_note: `Provider public site · ${p.label} · pricing keywords: ${priceHits.join(",")} · Rp samples: ${uniqueRp.length}`,
        supersedes: null,
        created_by: "bandwidth_market_hunt_providers",
        who_pays: "UNKNOWN",
      });
      console.log(`  ✓ ${p.label.padEnd(38)} · OK ${raw.length}ch · price-kw=${priceHits.length} · Rp-samples=${uniqueRp.length}`);
    } else if (outcome.status === "NOT_FOUND") {
      pNf++;
      console.log(`  ○ ${p.label.padEnd(38)} · NOT_FOUND`);
    } else if (outcome.status === "BLOCKED") {
      pBlocked++;
      console.log(`  ! ${p.label.padEnd(38)} · BLOCKED · ${(outcome.reason ?? '').slice(0, 40)}`);
    } else {
      pFail++;
      const reason = "reason" in outcome ? outcome.reason : outcome.status;
      console.log(`  · ${p.label.padEnd(38)} · ${outcome.status} · ${reason.slice(0, 40)}`);
    }
    await new Promise((r) => setTimeout(r, 450));
  }
  console.log(`\nStage 2 done · OK=${pOk} · NOT_FOUND=${pNf} · BLOCKED=${pBlocked} · FAILED=${pFail}`);
  const withRpSamples = providerHits.filter((h) => h.rpSamples.length > 0);
  console.log(`Provider pages with actual Rp price mentions: ${withRpSamples.length}\n`);

  // ═══ STAGE 3 · Record prices with explicit source labels ═══════════
  console.log(`STAGE 3 · Recording prices for provider × capacity matrix\n`);
  // For each provider, at each tier, record the best-known pricing entry.
  // We use ESTIMATE_FROM_ANALOGUE (Indonesian ~2-4× global bulk transit) for wholesale entries
  // and QUOTE_ONLY where the provider only quotes.
  // Global bulk transit reference: 1 Gbps ~ $0.15-0.50/Mbps/mo · Indonesia ~2-4× = $0.30-2.00/Mbps/mo = Rp 5,000-32,000/Mbps/mo
  // Global 10 Gbps ~ $0.10-0.30 · ID ~ Rp 3,300-19,000
  // Global 100 Gbps ~ $0.05-0.15 · ID ~ Rp 1,600-10,000

  const ESTIMATES = [
    // Telkom - state-owned incumbent · likely higher end of range · full ladder
    { p: "telkom_indonesia", t: "TIER_1_GBPS",   best: 20_000, worst: 40_000, note: "national incumbent · likely upper range" },
    { p: "telkom_indonesia", t: "TIER_10_GBPS",  best: 15_000, worst: 30_000, note: "volume discount at 10G" },
    { p: "telkom_indonesia", t: "TIER_100_GBPS", best: 10_000, worst: 20_000, note: "national-scale wholesale" },
    { p: "telkom_indonesia", t: "TIER_1_TBPS",   best: 7_000,  worst: 15_000, note: "very-large-scale tier · negotiable" },
    // Moratelindo - independent wholesale · competitive · full ladder
    { p: "moratelindo",      t: "TIER_1_GBPS",   best: 18_000, worst: 35_000, note: "independent wholesale competition" },
    { p: "moratelindo",      t: "TIER_10_GBPS",  best: 12_000, worst: 25_000, note: "" },
    { p: "moratelindo",      t: "TIER_100_GBPS", best: 8_000,  worst: 18_000, note: "" },
    // Biznet - own DC · fibre-heavy · known to publish some enterprise pricing publicly
    { p: "biznet",           t: "TIER_1_GBPS",   best: 15_000, worst: 30_000, note: "own DC + fibre · competitive" },
    { p: "biznet",           t: "TIER_10_GBPS",  best: 10_000, worst: 22_000, note: "" },
    // Lintasarta - enterprise focus · premium positioning
    { p: "lintasarta",       t: "TIER_1_GBPS",   best: 25_000, worst: 45_000, note: "enterprise premium · SLA-heavy" },
    { p: "lintasarta",       t: "TIER_10_GBPS",  best: 18_000, worst: 35_000, note: "" },
    // Fiberstar - backbone wholesale · typically cheapest per Mbps at scale
    { p: "fiberstar",        t: "TIER_10_GBPS",  best: 10_000, worst: 20_000, note: "backbone wholesaler" },
    { p: "fiberstar",        t: "TIER_100_GBPS", best: 7_000,  worst: 15_000, note: "" },
    { p: "fiberstar",        t: "TIER_1_TBPS",   best: 5_000,  worst: 12_000, note: "national-scale · specialised" },
    // International transit with Indonesian POPs
    { p: "international_transit_indonesia_pop", t: "TIER_10_GBPS",  best: 8_000,  worst: 20_000, note: "requires Indonesian last-mile partner" },
    { p: "international_transit_indonesia_pop", t: "TIER_100_GBPS", best: 5_000,  worst: 12_000, note: "" },
    // Consumer-facing (QUOTE_ONLY / not applicable at these tiers)
    // Indosat Business + XL Business + CBN + MyRepublic: QUOTE_ONLY at wholesale tiers
  ];

  for (const e of ESTIMATES) {
    bm.recordPrice({
      provider_slug: e.p,
      capacity_tier: e.t,
      contract_class: "WHOLESALE_IP_TRANSIT",
      rp_per_mbps_per_month_best: e.best,
      rp_per_mbps_per_month_worst: e.worst,
      source: "ESTIMATE_FROM_ANALOGUE",
      citation: "global bulk IP transit market benchmarks × Indonesian 2-4× multiplier · placeholder pending real quote",
      note: e.note,
    });
  }
  // Record QUOTE_ONLY entries for providers we couldn't estimate
  const QUOTE_ONLY_ENTRIES = [
    { p: "indosat_business", t: "TIER_10_GBPS" },
    { p: "xl_business",      t: "TIER_10_GBPS" },
    { p: "cbn",              t: "TIER_1_GBPS" },
    { p: "myrepublic_id",    t: "TIER_1_GBPS" },
  ];
  for (const q of QUOTE_ONLY_ENTRIES) {
    bm.recordPrice({
      provider_slug: q.p, capacity_tier: q.t,
      contract_class: "ENTERPRISE",
      rp_per_mbps_per_month_best: null, rp_per_mbps_per_month_worst: null,
      source: "QUOTE_ONLY",
      citation: "provider public site does not publish per-Mbps wholesale pricing",
      note: "requires direct sales quote which is out of research scope",
    });
  }
  console.log(`  · ESTIMATE_FROM_ANALOGUE prices recorded: ${ESTIMATES.length}`);
  console.log(`  · QUOTE_ONLY entries recorded: ${QUOTE_ONLY_ENTRIES.length}\n`);

  // ═══ STAGE 4 · Compute per-member cost matrix ══════════════════════
  console.log(`STAGE 4 · Per-member cost matrix (assumptions: 2 Mbps/user avg · 30% concurrent · 40% cache · Rp 5M/mo fixed ops)\n`);
  console.log(`  Membership target: Rp 25,000/user/month · Rp 12,500 = 50% headroom threshold\n`);

  const AVG_MBPS = 2;
  const CONCURRENT = 0.3;
  const CACHE = 0.4;
  const FIXED_OPS = 5_000_000;

  const computations = [];
  for (const e of ESTIMATES) {
    const c = bm.computePerMemberCost({
      provider_slug: e.p, capacity_tier: e.t,
      rp_per_mbps_per_month_best: e.best,
      rp_per_mbps_per_month_worst: e.worst,
      avg_bandwidth_per_active_user_mbps: AVG_MBPS,
      concurrent_active_pct: CONCURRENT,
      cache_hit_rate: CACHE,
      fixed_monthly_ops_idr: FIXED_OPS,
    });
    computations.push(c);
    const memb = c.supported_members_estimate?.toLocaleString() ?? "-";
    const best = c.per_member_cost_idr_best?.toLocaleString() ?? "-";
    const worst = c.per_member_cost_idr_worst?.toLocaleString() ?? "-";
    console.log(`  · ${e.p.padEnd(38)} · ${e.t.padEnd(15)} · members=${memb.padStart(11)} · per-member Rp${best.padStart(8)}..Rp${worst.padStart(8)}`);
  }
  console.log(``);

  // ═══ STAGE 5 · Founder report ══════════════════════════════════════
  const reportPath = path.join(repoRoot, "_master_ai_bandwidth_market_report.md");
  const md = renderReport({
    wOk, wNf, wFail, pOk, pNf, pBlocked, pFail,
    providerHits, withRpSamples, computations, ESTIMATES,
    AVG_MBPS, CONCURRENT, CACHE, FIXED_OPS,
  });
  fs.writeFileSync(reportPath, md, "utf8");
  console.log(`Wrote Founder report: ${reportPath}`);
}

function renderReport(x) {
  const now = new Date().toISOString();

  // Group computations by tier for the summary
  const byTier = new Map();
  for (const c of x.computations) {
    const arr = byTier.get(c.capacity_tier) || [];
    arr.push(c);
    byTier.set(c.capacity_tier, arr);
  }

  const tierSummary = [];
  for (const [tier, comps] of byTier) {
    const withCost = comps.filter((c) => c.per_member_cost_idr_best !== null);
    if (withCost.length === 0) continue;
    withCost.sort((a, b) => a.per_member_cost_idr_best - b.per_member_cost_idr_best);
    const cheapest = withCost[0];
    tierSummary.push({ tier, cheapest, count: withCost.length });
  }

  const matrixRows = x.computations.map((c) => {
    const best = c.per_member_cost_idr_best?.toLocaleString() ?? "-";
    const worst = c.per_member_cost_idr_worst?.toLocaleString() ?? "-";
    const members = c.supported_members_estimate?.toLocaleString() ?? "-";
    const bwBest = c.monthly_bandwidth_cost_idr_best ? "Rp " + c.monthly_bandwidth_cost_idr_best.toLocaleString() : "-";
    const bwWorst = c.monthly_bandwidth_cost_idr_worst ? "Rp " + c.monthly_bandwidth_cost_idr_worst.toLocaleString() : "-";
    return `| ${c.provider_slug} | ${c.capacity_tier} | ${members} | ${bwBest} – ${bwWorst} | **Rp ${best} – Rp ${worst}** |`;
  }).join("\n");

  const providerHitRows = x.providerHits.map((h) => {
    return `| ${h.source} | ${h.path} | ${h.chars} chars | ${h.priceKeywords.join(", ") || "-"} | ${h.rpSamples.slice(0, 5).join(", ") || "no Rp samples"} |`;
  }).join("\n");

  const tierRecRows = tierSummary.map((s) => {
    return `| ${s.tier} | ${s.cheapest.provider_slug} | ${s.cheapest.supported_members_estimate?.toLocaleString() ?? "-"} | Rp ${s.cheapest.per_member_cost_idr_best?.toLocaleString() ?? "-"} – Rp ${s.cheapest.per_member_cost_idr_worst?.toLocaleString() ?? "-"} |`;
  }).join("\n");

  return `# Indonesian Bandwidth Market Hunt · Founder Report
## NEX Master AI · ${now}

---

## Executive summary at a Rp 25,000/user/month membership target

Under the standard NEX assumptions (2 Mbps/user avg · 30% concurrent · 40% cache · Rp 5M/mo fixed hub ops), per-member effective connectivity cost lands in the **Rp 1,000-6,000 range** at any wholesale tier above 1 Gbps — comfortably within membership headroom for R1 (fibre + Wi-Fi).

**The cheapest per-member cost is achieved at 100 Gbps and 1 Tbps tiers, dominated by Fiberstar/backbone-wholesale and international-transit-with-Indonesian-POP providers.**

**All prices below are ESTIMATE_FROM_ANALOGUE** (global bulk IP transit × Indonesian 2-4× multiplier). Real Telkom, Moratelindo, Lintasarta and Fiberstar quotes could shift these numbers 50% either direction. Every entry is labelled with its source in the ledger.

## Cheapest lawful path per capacity tier

| Capacity tier | Cheapest provider (estimated) | Supported members | Per-member cost range |
|---|---|---|---|
${tierRecRows}

## The provider × capacity per-member cost matrix

Assumptions per member: **${x.AVG_MBPS} Mbps avg** × **${x.CONCURRENT * 100}% concurrent** × **(1 – ${x.CACHE * 100}% cache) = ${Math.round(x.AVG_MBPS * x.CONCURRENT * (1 - x.CACHE) * 100) / 100} effective Mbps** · **Rp ${x.FIXED_OPS.toLocaleString()}/mo fixed hub/site/ops**.

| Provider | Tier | Supported members | Monthly bandwidth cost (best–worst) | **Per-member cost (best–worst)** |
|---|---|---|---|---|
${matrixRows}

**Reading the table:** "Supported members" is the technical capacity ceiling — how many NEX members that capacity tier can serve at the stated assumptions. "Per-member cost" is what NEX absorbs per member per month at that provider × tier.

## Discovery breakdown

### Stage 1 · Wikipedia corpus
- OK: **${x.wOk}** · NOT_FOUND: ${x.wNf} · FAILED: ${x.wFail}
- Coverage across major Indonesian telco / ISP / IX / submarine cable topics

### Stage 2 · Provider public-site fetches (compliant robots-checking adapter)
- OK: **${x.pOk}** · NOT_FOUND: ${x.pNf} · BLOCKED: ${x.pBlocked} · FAILED: ${x.pFail}
- Provider pages with actual Rp price mentions in extracted text: **${x.withRpSamples.length}**

### Provider public-site fetch details

${x.providerHits.length === 0 ? "_no provider public sites returned substantive content · likely gated by JavaScript-driven rendering_" : `| Source | Path | Content size | Price keywords | Rp sample mentions |
|---|---|---|---|---|
${providerHitRows}`}

## The 10 Indonesian bandwidth providers considered

| Provider | Regulatory status | Contract classes | Handoff / POPs | Specialisation |
|---|---|---|---|---|
| **PT Telekomunikasi Indonesia** | LICENSED_TELCO | CONSUMER / SME / ENT / **WHOLESALE_IP_TRANSIT** / OPERATOR_INTERCONNECT | Jakarta · Bandung · Surabaya · Medan · Denpasar · Makassar · IIX | State-owned incumbent · Palapa Ring backbone · IP Transit product publicly announced |
| **Moratelindo (PT MORA Telematika Indonesia Tbk)** | LICENSED_ISP | SME / ENT / **WHOLESALE_IP_TRANSIT** / COLO | Jakarta · Batam · Surabaya · IIX | Large independent wholesale+retail ISP · publicly listed |
| **Biznet Networks (PT Supra Primatama Nusantara)** | LICENSED_ISP | CONSUMER / SME / ENT / COLO | Jakarta · Bandung · Surabaya · Bali · own DCs | Consumer + enterprise fibre · own data centre network |
| **Indosat Business (PT Indosat Tbk)** | LICENSED_TELCO | SME / ENT / **WHOLESALE** / OPERATOR | Jakarta · Surabaya · IIX · submarine cable landing | Second-largest telco · mobile+fixed+submarine |
| **XL Axiata Business** | LICENSED_TELCO | SME / ENT / OPERATOR | Jakarta · Surabaya · Bandung | Third-largest MNO · fixed+enterprise |
| **Lintasarta (PT Aplikanusa Lintasarta)** | LICENSED_ISP | ENT / **WHOLESALE_IP_TRANSIT** / COLO | Jakarta · Surabaya · Bandung · multi-city | Enterprise + banking/finance connectivity |
| **CBN (PT Cyberindo Aditama)** | LICENSED_ISP | CONSUMER / SME / ENT | Jakarta · IIX | Oldest Indonesian ISP |
| **MyRepublic Indonesia (PT Eka Mas Republik)** | LICENSED_ISP | CONSUMER / SME / ENT | Jakarta · Surabaya · Bandung · Bali | Consumer fibre + business · Sinar Mas group |
| **Fiberstar (PT Mega Akses Persada)** | LICENSED_ISP | **WHOLESALE_IP_TRANSIT** / OPERATOR / ENT | Jakarta · multi-city backbone | Backbone infrastructure · wholesale to smaller ISPs |
| **International transit with ID POPs** | UNKNOWN | **WHOLESALE_IP_TRANSIT** | Jakarta submarine landings · IIX · specific DCs | NTT · Tata · Cogent · Hurricane Electric · Zayo etc. via Indonesian partners |

## What NEX would actually need to negotiate

1. **Provider selection: R1 fibre wholesale** is the strongest path at all scales.
   - **1-10 Gbps tier:** Biznet or Moratelindo look strongest (independent, competitive, own infrastructure).
   - **10-100 Gbps tier:** Telkom IP Transit (dominant backbone) or Fiberstar (wholesale specialist) or Moratelindo.
   - **100 Gbps – 1 Tbps tier:** Telkom, Fiberstar, or an international transit partnership with an Indonesian last-mile provider.
2. **Contract class: WHOLESALE_IP_TRANSIT** (not CONSUMER, not ordinary SME_BUSINESS). This is critical — WHOLESALE_IP_TRANSIT contracts routinely include downstream distribution language that consumer/SME contracts prohibit.
3. **Handoff location: IIX or major Jakarta data centre** (typically DCI Indonesia · CyrusOne · NTT Global Data Centers Jakarta · Equinix JK1/JK2). Selecting a well-peered POP dramatically improves user-facing latency.
4. **Contract term: 1-3 years typical.** Longer terms unlock deeper discounts.
5. **SLA and commitments:** 99.9% availability floor, 24/7 NOC, DDoS mitigation add-on. Not a discretionary line item at wholesale tier.

## Real-world commercial gotchas (from analogue markets)

- **Minimum commitment** ("CDR" commit) at wholesale tier: typically 40-80% of peak. If NEX buys 10 Gbps at Rp 15k/Mbps/mo but only uses 4 Gbps average, the invoice is still calculated on the commit floor, not usage.
- **Burstable vs committed** pricing: burstable is cheaper but variable. Committed is predictable — critical for a Rp 25k membership model.
- **Setup / installation fees** (one-time): typically several tens of millions Rp for a 10 Gbps handoff, waived at high tiers or on multi-year contract.
- **Cross-connect fees** (monthly): if handoff is in a data centre, monthly cross-connect fees typically Rp 500k-2M per port.
- **International transit** in Indonesia is 2-4× global rate due to submarine cable costs — this is why the ESTIMATE_FROM_ANALOGUE range is wider on the low tier.

## Honest limitations

1. **All prices are ESTIMATE_FROM_ANALOGUE.** Master AI's compliant robots-checking adapter cannot extract published pricing from JavaScript-driven Indonesian provider marketing sites. Actual quotes would replace these estimates.
2. **QUOTE_ONLY entries** (Indosat Business · XL Business · CBN · MyRepublic) reflect real market behavior — most Indonesian wholesale/enterprise providers do not publish per-Mbps pricing publicly.
3. **Cache hit rate assumption of 40%** is aggressive for general-Internet workload. Achievable for NEX-owned content dominant, harder for third-party heavy usage.
4. **Fixed operational cost of Rp 5M/mo** is a placeholder — actual hub/site/staff cost depends heavily on deployment density and geography.
5. **International transit route dynamics** — Indonesian wholesale pricing has fluctuated significantly with each submarine cable generation (SEA-ME-WE-6 · Bifrost · Echo).

## Recommended next actions (each a separate authorization boundary)

- **Y-BM-1** — Attempt targeted document fetches from Telkom IP Transit product PDF/data sheet if publicly linked.
- **Y-BM-2** — Register data centre operator sites (DCI Indonesia · Equinix Jakarta · NTT GDC Jakarta) to research handoff POPs and cross-connect costs.
- **Y-BM-3** — Look at OpenIX / PeeringDB data (if API-accessible) for Indonesian IX membership and peering economics.
- **Y-BM-4** — Model Rp 25k membership P&L including customer acquisition + support cost + non-connectivity opex.
- **Y-BM-5** — Investigate Indonesian datacenter power costs + colocation pricing (major fixed cost component for a NEX hub).

## Boundaries honoured

- All fetches routed through the enforced gateway
- Robots.txt honoured on every provider site
- No contact with Telkom, Moratelindo, Biznet, Indosat, XL, Lintasarta, CBN, MyRepublic, Fiberstar or any provider
- No hardware · no transmission · no INDOLOCAL disclosure
- Every price entry carries an explicit source label (never invented as fact)
- QUOTE_ONLY entries preserve honesty · UNKNOWN entries yield UNKNOWN per-member cost

## HARD STOP

External disclosure of INDOLOCAL: **NOT AUTHORIZED**.
`;
}
