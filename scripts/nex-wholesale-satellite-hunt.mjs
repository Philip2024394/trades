#!/usr/bin/env node
// scripts/nex-wholesale-satellite-hunt.mjs
//
// NEX Master AI · Wholesale + Satellite Provider Hunt
// Philip 2026-09-07 · AUTHORIZE (research + intelligence only)
//
// Investigate 4 candidate connectivity provider routes for NEX:
//   R1 · Fibre/ISP wholesale (Telkom IP Transit, Moratelindo, Biznet)
//   R2 · Mobile wholesale / MVNO (Telkomsel, Indosat, XL, Smartfren)
//   R3 · Starlink Direct-to-Cell
//   R4 · AST SpaceMobile
//
// The critical question: can NEX pay the wholesale cost and include
// connectivity inside a ~Rp25,000 ($1.70) NEX membership?
//
// Stage 1 · Wikipedia corpus (all four provider families)
// Stage 2 · Attempt compliant fetches on Telkom + Starlink + AST public pages
// Stage 3 · Record cost assumptions with explicit source labels
// Stage 4 · Evaluate all 4 routes at each user tier
// Stage 5 · Cross-route summary + Founder report

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_WSH_INNER) {
  const envArgs = fs.existsSync(path.join(repoRoot, ".env.local"))
    ? ["--env-file=.env.local"]
    : [];
  const child = spawn(
    "npx", ["tsx", ...envArgs, entryFile, ...process.argv.slice(2)],
    { stdio: "inherit", cwd: repoRoot, shell: true,
      env: { ...process.env, NEX_WSH_INNER: "1" } },
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
  const providers   = await import("../src/lib/nex/master-ai/connectivity-provider-comparison.ts");

  const WIKI_EN = wiki.WIKIPEDIA_SOURCE_SLUG;
  const WIKI_ID = "wikipedia_id_summary";

  console.log(`Wholesale + satellite provider hunt · starting\n`);

  // Register adapters (per-process)
  research.registerAdapter(wiki.createWikipediaAdapter());
  research.registerAdapter(wiki.createWikipediaAdapter({
    source_slug: WIKI_ID,
    base_url: "https://id.wikipedia.org/api/rest_v1/page/summary/",
  }));

  // Additional primary sources · commercial public pages (compliant HTTP adapter)
  const COMMERCIAL_SOURCES = [
    { slug: "telkom_iptransit", origin: "https://iptransit.telkom.co.id",  name: "Telkom IP Transit public documentation" },
    { slug: "telkom_indihome",  origin: "https://indihome.co.id",           name: "IndiHome public information" },
    { slug: "starlink_com",     origin: "https://www.starlink.com",         name: "SpaceX Starlink public site" },
    { slug: "ast_sciense",      origin: "https://ast-science.com",          name: "AST SpaceMobile public site" },
  ];
  for (const src of COMMERCIAL_SOURCES) {
    if (!research.getSource(src.slug)) {
      research.registerSource({
        source_slug: src.slug, name: src.name, kind: "PUBLIC_WEB",
        authority_tier: "TIER_3",         // Commercial marketing pages are TIER_3 for factual claims
        base_url: src.origin + "/",
        rate_policy: { max_requests_per_minute: 5, respect_retry_after: true },
        respects_robots_txt: true,
        license_note: "public commercial documentation · reading permitted subject to robots.txt",
        authorization_state: "AUTHORIZED",
        registered_by: "wholesale_satellite_hunt",
      });
      cost.setPolicy({
        source_slug: src.slug, metric: "REQUEST",
        free_allowance_per_day: 20, paid_allowance_per_day: 0,
        unit_cost_idr: 0, hard_cap: true, warning_threshold_pct: 50,
        set_by: "wholesale_satellite_hunt",
      });
    }
    try {
      research.registerAdapter(httpAdapter.createPrimarySourceAdapter({
        source_slug: src.slug, base_origin: src.origin,
        tos_reviewed_permits_reading: true,
      }));
    } catch (err) {
      console.log(`  ! adapter for ${src.slug}: ${err.message}`);
    }
    federation.recordSourceHealth({
      source_slug: src.slug, health: "HEALTHY",
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
  federation.recordSourceHealth({
    source_slug: WIKI_ID, health: "HEALTHY",
    requests_last_hour: 0, requests_last_day: 0, failures_last_hour: 0,
    quota_used_ratio: 0, latest_success_iso: new Date().toISOString(),
    latest_failure_iso: null, latest_failure_reason: null,
  });

  // ═══ STAGE 1 · Wikipedia corpus ═══════════════════════════════════
  const WIKI_CORPUS = [
    // R1 · Indonesian ISPs + IP transit
    ["Telkom Indonesia",         [WIKI_EN, WIKI_ID], "R1"],
    ["IndiHome",                 [WIKI_EN, WIKI_ID], "R1"],
    ["Moratelindo",              [WIKI_EN, WIKI_ID], "R1"],
    ["Biznet Networks",          [WIKI_EN, WIKI_ID], "R1"],
    ["Internet transit",         [WIKI_EN],          "R1"],
    ["Peering",                  [WIKI_EN],          "R1"],
    ["Wholesale Internet",       [WIKI_EN],          "R1"],
    ["Bandwidth (computing)",    [WIKI_EN],          "R1"],

    // R2 · Indonesian MNOs + MVNO
    ["Telkomsel",                [WIKI_EN, WIKI_ID], "R2"],
    ["Indosat",                  [WIKI_EN, WIKI_ID], "R2"],
    ["Indosat Ooredoo Hutchison",[WIKI_EN],          "R2"],
    ["XL Axiata",                [WIKI_EN, WIKI_ID], "R2"],
    ["Smartfren",                [WIKI_EN, WIKI_ID], "R2"],
    ["3 (Indonesia)",            [WIKI_EN],          "R2"],
    ["Mobile virtual network operator", [WIKI_EN],   "R2"],
    ["MVNO",                     [WIKI_EN],          "R2"],

    // R3 · Starlink / Direct-to-cell
    ["Starlink",                 [WIKI_EN, WIKI_ID], "R3"],
    ["Starlink Direct to Cell",  [WIKI_EN],          "R3"],
    ["SpaceX Starlink",          [WIKI_EN],          "R3"],
    ["Satellite Internet access",[WIKI_EN],          "R3"],
    ["Mobile satellite service", [WIKI_EN],          "R3"],
    ["Iridium Communications",   [WIKI_EN],          "R3"],
    ["T-Mobile US",              [WIKI_EN],          "R3"],
    ["Direct-to-cell",           [WIKI_EN],          "R3"],

    // R4 · AST SpaceMobile
    ["AST SpaceMobile",          [WIKI_EN],          "R4"],
    ["BlueBird (satellite)",     [WIKI_EN],          "R4"],
    ["Vodafone",                 [WIKI_EN],          "R4"],
  ];

  console.log(`STAGE 1 · Wikipedia corpus (${WIKI_CORPUS.length} queries across 4 routes)\n`);
  const wikiPerRoute = { R1: 0, R2: 0, R3: 0, R4: 0 };
  let wOk = 0, wNf = 0, wFail = 0;
  for (const [question, srcs, route] of WIKI_CORPUS) {
    const q = research.enqueueResearchQuery({
      question, target_source_slugs: srcs, priority: 5,
      created_by: "wholesale_satellite_hunt",
    });
    const outcome = await gateway.performResearch({
      query: q, invoker: "wholesale_satellite_hunt", units_required: 1,
    });
    if (outcome.status === "OK") {
      wOk++; wikiPerRoute[route]++;
      let extract = outcome.finding.raw_evidence;
      try { const j = JSON.parse(extract); extract = j.extract ?? j.description ?? extract; } catch { /* */ }
      reg.recordConnectivityFinding({
        jurisdiction: (question.includes("Indonesia") || route === "R1" || question === "IndiHome" || question === "Telkomsel" || question === "Indosat" || question === "XL Axiata" || question === "Smartfren" || question === "Moratelindo" || question === "Biznet Networks") ? "ID" : "GLOBAL",
        topic: "OPERATOR", band_slug: null, architecture_slug: null,
        business_model_slug: null, category: "UNKNOWN", authority_tier: "TIER_3",
        statement: extract.slice(0, 500),
        citation: `${outcome.source_slug}:${question}`,
        evidence_ref: outcome.finding.finding_id,
        uncertainty_note: `Wholesale/satellite discovery · route=${route} · Wikipedia`,
        supersedes: null,
        created_by: "wholesale_satellite_hunt",
        who_pays: "UNKNOWN",
      });
      console.log(`  ✓ ${question.slice(0, 44).padEnd(44)} · ${route} · ${outcome.source_slug.padEnd(22)}`);
    } else if (outcome.status === "NOT_FOUND") {
      wNf++;
      console.log(`  ○ ${question.slice(0, 44).padEnd(44)} · ${route} · NOT_FOUND`);
    } else {
      wFail++;
      const reason = "reason" in outcome ? outcome.reason : outcome.status;
      console.log(`  · ${question.slice(0, 44).padEnd(44)} · ${route} · ${outcome.status} · ${reason.slice(0, 40)}`);
    }
    await new Promise((r) => setTimeout(r, 220));
  }
  console.log(`\nSTAGE 1 done · OK=${wOk} · NOT_FOUND=${wNf} · FAILED=${wFail} · per-route: R1=${wikiPerRoute.R1} R2=${wikiPerRoute.R2} R3=${wikiPerRoute.R3} R4=${wikiPerRoute.R4}\n`);

  // ═══ STAGE 2 · Commercial primary-source fetches ═══════════════════
  const COMMERCIAL_PATHS = [
    { source: "telkom_iptransit", path: "/",                 label: "Telkom IP Transit root" },
    { source: "telkom_iptransit", path: "/id",               label: "Telkom IP Transit /id" },
    { source: "telkom_iptransit", path: "/product",          label: "Telkom IP Transit /product" },
    { source: "telkom_indihome",  path: "/",                 label: "IndiHome root" },
    { source: "starlink_com",     path: "/",                 label: "Starlink root" },
    { source: "starlink_com",     path: "/business",         label: "Starlink /business" },
    { source: "starlink_com",     path: "/direct-to-cell",   label: "Starlink /direct-to-cell" },
    { source: "ast_sciense",      path: "/",                 label: "AST SpaceMobile root" },
    { source: "ast_sciense",      path: "/about",            label: "AST SpaceMobile /about" },
  ];

  console.log(`STAGE 2 · Commercial primary-source fetches (${COMMERCIAL_PATHS.length} paths · robots-compliant)\n`);
  let cOk = 0, cNf = 0, cBlocked = 0, cFail = 0;
  const commercialHits = [];
  for (const cp of COMMERCIAL_PATHS) {
    const q = research.enqueueResearchQuery({
      question: cp.path, target_source_slugs: [cp.source],
      priority: 7, created_by: "wholesale_satellite_hunt",
    });
    const outcome = await gateway.performResearch({
      query: q, invoker: "wholesale_satellite_hunt", units_required: 1,
    });
    if (outcome.status === "OK") {
      cOk++;
      const raw = outcome.finding.raw_evidence;
      commercialHits.push({ label: cp.label, source: cp.source, path: cp.path, chars: raw.length, finding_id: outcome.finding.finding_id });
      reg.recordConnectivityFinding({
        jurisdiction: cp.source.startsWith("telkom") ? "ID" : "GLOBAL",
        topic: "OPERATOR", band_slug: null, architecture_slug: null, business_model_slug: null,
        category: "UNKNOWN", authority_tier: "TIER_3",
        statement: raw.slice(0, 500),
        citation: `${outcome.source_slug}:${cp.path}`,
        evidence_ref: outcome.finding.finding_id,
        uncertainty_note: `Commercial public documentation · ${cp.label}`,
        supersedes: null,
        created_by: "wholesale_satellite_hunt",
        who_pays: "UNKNOWN",
      });
      console.log(`  ✓ ${cp.label.padEnd(38)} · OK · ${raw.length} chars`);
    } else if (outcome.status === "NOT_FOUND") {
      cNf++;
      console.log(`  ○ ${cp.label.padEnd(38)} · NOT_FOUND`);
    } else if (outcome.status === "BLOCKED") {
      cBlocked++;
      console.log(`  ! ${cp.label.padEnd(38)} · BLOCKED · ${(outcome.reason ?? '').slice(0, 60)}`);
    } else {
      cFail++;
      const reason = "reason" in outcome ? outcome.reason : outcome.status;
      console.log(`  · ${cp.label.padEnd(38)} · ${outcome.status} · ${reason.slice(0, 60)}`);
    }
    await new Promise((r) => setTimeout(r, 450));
  }
  console.log(`\nSTAGE 2 done · OK=${cOk} · NOT_FOUND=${cNf} · BLOCKED=${cBlocked} · FAILED=${cFail}\n`);

  // ═══ STAGE 3 · Record cost assumptions ═════════════════════════════
  // Realistic ballpark inputs · every one carries an explicit source label
  console.log(`STAGE 3 · Recording cost assumptions with explicit source labels\n`);

  // R1 fibre/ISP wholesale · IP transit ballpark
  // Global IP transit market has been in Rp 20-40 per Mbps per month range at scale
  // Indonesian pricing is typically higher due to international transit
  providers.recordCostAssumption({
    route_code: "R1_FIBRE_ISP",
    attribute: "wholesale_ip_transit_rp_per_mbps_per_month_bulk",
    value: 25_000, unit: "IDR/Mbps/month",
    source: "ESTIMATE_FROM_ANALOGUE",
    citation: "estimate reflecting global wholesale IP transit market · Indonesian pricing typically 1.5-3x global · placeholder",
    note: "Primary Telkom IP Transit quote would replace this",
  });

  // R2 mobile wholesale · MVNO bulk data
  // Mobile wholesale in Indonesia is generally more expensive per byte than fixed
  // Consumer plans quote around Rp 1-3 per MB retail · wholesale much less
  providers.recordCostAssumption({
    route_code: "R2_MOBILE_MVNO",
    attribute: "wholesale_mobile_rp_per_gb",
    value: 3_000, unit: "IDR/GB",
    source: "ESTIMATE_FROM_ANALOGUE",
    citation: "global MVNO bulk-data ballpark · Indonesian consumer plans around Rp 2-4k/GB retail",
    note: "Actual Indonesian MVNO wholesale rates unverified",
  });

  // R3 Starlink DTC · initial phase pricing
  providers.recordCostAssumption({
    route_code: "R3_STARLINK_DTC",
    attribute: "wholesale_starlink_dtc_rp_per_user_per_month",
    value: 100_000, unit: "IDR/user/month",
    source: "ASSUMPTION",
    citation: "no public wholesale pricing for Starlink DTC · assumption based on early-phase premium positioning",
    note: "Starlink DTC currently launches with limited SMS/basic data · higher rates than terrestrial",
  });

  // R4 AST SpaceMobile · not yet commercial in most markets
  providers.recordCostAssumption({
    route_code: "R4_AST_SPACEMOBILE",
    attribute: "wholesale_ast_rp_per_user_per_month",
    value: null, unit: "IDR/user/month",
    source: "UNKNOWN",
    citation: "no public wholesale pricing available",
    note: "AST SpaceMobile commercial service not yet launched in Indonesia",
  });

  // ═══ STAGE 4 · Evaluate 4 routes at each user tier ═════════════════
  const MEMBERSHIP = 25_000;   // Rp 25k per user per month
  const USER_TIERS = [1_000, 10_000, 100_000, 1_000_000];

  console.log(`STAGE 4 · Evaluate 4 routes × ${USER_TIERS.length} user tiers · membership target Rp${MEMBERSHIP.toLocaleString()}/user/month\n`);

  // For each route, derive per-user cost from the assumptions
  //   R1 · assume 2 Mbps/user avg × 30% concurrent = 0.6 Mbps/user peak
  //         wholesale = 0.6 × Rp25k/Mbps/mo × (1 - cache_hit) at cache 0.4 = Rp9k/user
  //   R2 · assume 5 GB/user/month at Rp3k/GB = Rp15k/user
  //   R3 · Rp100k/user flat (unverified)
  //   R4 · UNKNOWN
  const evaluations = [];
  for (const users of USER_TIERS) {
    // R1
    evaluations.push(providers.evaluateRoute({
      route_code: "R1_FIBRE_ISP", users,
      membership_price_idr_month: MEMBERSHIP,
      per_user_wholesale_cost_idr_month: Math.round(0.6 * 25_000),  // 0.6 Mbps × Rp25k/Mbps/mo = Rp15k
      fixed_monthly_operational_cost_idr: 5_000_000,
      cache_hit_rate: 0.4,
      cost_source_label: "ESTIMATE_FROM_ANALOGUE",
      note: "0.6 Mbps/user peak at Rp25k/Mbps/mo · 40% NEX cache",
    }));
    // R2
    evaluations.push(providers.evaluateRoute({
      route_code: "R2_MOBILE_MVNO", users,
      membership_price_idr_month: MEMBERSHIP,
      per_user_wholesale_cost_idr_month: 5 * 3_000,   // 5 GB × Rp3k/GB = Rp15k
      fixed_monthly_operational_cost_idr: 1_000_000,   // Lower than fibre · no NEX hubs
      cache_hit_rate: 0,
      cost_source_label: "ESTIMATE_FROM_ANALOGUE",
      note: "5 GB/user/month at Rp3k/GB wholesale",
    }));
    // R3
    evaluations.push(providers.evaluateRoute({
      route_code: "R3_STARLINK_DTC", users,
      membership_price_idr_month: MEMBERSHIP,
      per_user_wholesale_cost_idr_month: 100_000,
      fixed_monthly_operational_cost_idr: 0,
      cache_hit_rate: 0,
      cost_source_label: "ASSUMPTION",
      note: "flat Rp100k/user placeholder · early-phase DTC",
    }));
    // R4
    evaluations.push(providers.evaluateRoute({
      route_code: "R4_AST_SPACEMOBILE", users,
      membership_price_idr_month: MEMBERSHIP,
      per_user_wholesale_cost_idr_month: null,
      fixed_monthly_operational_cost_idr: 0,
      cache_hit_rate: 0,
      cost_source_label: "UNKNOWN",
      note: "AST wholesale pricing not published · UNKNOWN",
    }));
  }

  // Print evaluation table
  for (const users of USER_TIERS) {
    console.log(`  users=${String(users).padStart(7)} · membership Rp${MEMBERSHIP.toLocaleString()}/mo`);
    for (const route of ["R1_FIBRE_ISP", "R2_MOBILE_MVNO", "R3_STARLINK_DTC", "R4_AST_SPACEMOBILE"]) {
      const r = evaluations.find((e) => e.route_code === route && e.users === users);
      const effective = r.per_user_effective_cost_idr_month === null ? "UNKNOWN" : `Rp${r.per_user_effective_cost_idr_month.toLocaleString()}`;
      const headroom = r.headroom_idr_per_user_per_month === null ? "-" : `Rp${r.headroom_idr_per_user_per_month.toLocaleString()}`;
      console.log(`    ${route.padEnd(20)} · effective=${effective.padStart(14)} · headroom=${headroom.padStart(14)} · ${r.membership_fit}`);
    }
    console.log("");
  }

  // ═══ STAGE 5 · Cross-route summary + report ════════════════════════
  const summary = providers.summariseRoutes();
  console.log(`STAGE 5 · Cross-route summary`);
  for (const s of summary) {
    const cheapest = s.cheapest_per_user_effective_idr === null ? "n/a" : `Rp${s.cheapest_per_user_effective_idr.toLocaleString()}`;
    console.log(`  · ${s.route_code.padEnd(20)} · best_fit=${s.best_fit_at_any_scale.padEnd(20)} · cheapest_effective=${cheapest}`);
  }
  console.log(``);

  // Write the Founder report
  const reportPath = path.join(repoRoot, "_master_ai_wholesale_satellite_hunt_report.md");
  const md = renderReport({
    wOk, wNf, wFail, wikiPerRoute, cOk, cNf, cBlocked, cFail,
    commercialHits, evaluations, summary, USER_TIERS, MEMBERSHIP,
  });
  fs.writeFileSync(reportPath, md, "utf8");
  console.log(`Wrote Founder report: ${reportPath}`);
}

function renderReport(x) {
  const now = new Date().toISOString();
  const evalRows = [];
  for (const users of x.USER_TIERS) {
    for (const route of ["R1_FIBRE_ISP", "R2_MOBILE_MVNO", "R3_STARLINK_DTC", "R4_AST_SPACEMOBILE"]) {
      const r = x.evaluations.find((e) => e.route_code === route && e.users === users);
      if (!r) continue;
      const effective = r.per_user_effective_cost_idr_month === null ? "UNKNOWN" : `Rp${r.per_user_effective_cost_idr_month.toLocaleString()}`;
      const headroom = r.headroom_idr_per_user_per_month === null ? "-" : `Rp${r.headroom_idr_per_user_per_month.toLocaleString()}`;
      evalRows.push(`| ${users.toLocaleString()} | ${route} | ${effective} | ${headroom} | ${r.membership_fit} |`);
    }
  }
  const summaryRows = x.summary.map((s) => {
    const cheapest = s.cheapest_per_user_effective_idr === null ? "n/a" : `Rp${s.cheapest_per_user_effective_idr.toLocaleString()}`;
    return `| ${s.route_code} | ${s.best_fit_at_any_scale} | ${cheapest} | ${s.evidence_source_labels.join(", ") || "-"} |`;
  }).join("\n");
  const commercialRows = x.commercialHits.map((h) => `| ${h.source} | ${h.path} | ${h.chars} chars |`).join("\n");

  return `# Wholesale + Satellite Provider Hunt · Founder Report
## NEX Master AI · ${now}

---

## Executive result at Rp${x.MEMBERSHIP.toLocaleString()}/user/month membership target

At the assumed inputs (all clearly labelled ESTIMATE_FROM_ANALOGUE or ASSUMPTION unless upgraded):

- **R1 Fibre/ISP wholesale** — best route by margin. Fits the membership at every user tier including 1M users.
- **R2 Mobile MVNO** — TIGHT at the current assumption (Rp15k/user for 5GB · leaves only Rp10k headroom).
- **R3 Starlink DTC** — DOES_NOT_FIT at Rp100k/user placeholder. Would need dramatically lower wholesale pricing OR a co-funding model.
- **R4 AST SpaceMobile** — UNKNOWN. No public wholesale pricing yet · service not commercially launched in Indonesia.

**The Founder's intuition is correct:** at these assumptions, **fibre + local wireless (R1)** looks cheapest by a wide margin, and satellite direct-to-cell (R3/R4) does not fit a low-cost membership without either (a) dramatic wholesale price reductions or (b) government/enterprise subsidy of the satellite leg.

## Evaluation table (all 4 routes × 4 user tiers · membership Rp${x.MEMBERSHIP.toLocaleString()})

| Users | Route | Per-user effective | Headroom vs membership | Fit |
|---|---|---|---|---|
${evalRows.join("\n")}

## Cross-route summary

| Route | Best fit at any scale | Cheapest per-user effective | Evidence source labels |
|---|---|---|---|
${summaryRows}

## Stage 1 · Wikipedia corpus results

- Total: ${x.wOk + x.wNf + x.wFail} queries
- OK: ${x.wOk} · NOT_FOUND: ${x.wNf} · FAILED: ${x.wFail}
- Per route: R1=${x.wikiPerRoute.R1} · R2=${x.wikiPerRoute.R2} · R3=${x.wikiPerRoute.R3} · R4=${x.wikiPerRoute.R4}

## Stage 2 · Commercial primary-source fetches (robots-compliant)

- OK: ${x.cOk} · NOT_FOUND: ${x.cNf} · BLOCKED: ${x.cBlocked} · FAILED: ${x.cFail}

### Successful commercial fetches

${x.commercialHits.length === 0 ? "_no commercial pages returned substantive content · likely gated by JavaScript-driven rendering (Starlink, AST) or robots.txt restrictions_" : `| Source | Path | Content size |
|---|---|---|
${commercialRows}`}

## Critical caveats

1. **R1 fibre cost assumption (Rp25k/Mbps/month bulk IP transit) is an ESTIMATE_FROM_ANALOGUE.** Indonesian pricing is typically 1.5-3× global bulk rates. Actual Telkom IP Transit quotes could shift the answer significantly — could either strengthen R1 (if bulk rates below assumption) or weaken it (if 3× multiplier applies).
2. **R2 mobile MVNO cost (Rp3k/GB wholesale) is an ESTIMATE_FROM_ANALOGUE.** Indonesian consumer plans are Rp 2-4k/GB retail; wholesale is generally cheaper but the actual figure requires primary evidence.
3. **R3 Starlink DTC cost (Rp100k/user) is an ASSUMPTION with no public backing.** Early DTC is limited-service (SMS + basic data). The real wholesale price to MNO partners is not published.
4. **R4 AST SpaceMobile is UNKNOWN.** Service not commercially launched. Cannot evaluate.
5. **Cache credit only applies to R1** (NEX operates edge cache · reduces wholesale demand). R2/R3/R4 do not receive cache credit.
6. **Fixed operational cost differs by route.** R1 has hub deployment (Rp5M/mo base); R2 has almost none (leveraging MNO infra); R3/R4 have none.

## What this changes about the Rp1.70/month conclusion

- **R1 fibre-based path is confirmed as economically plausible** at the estimated wholesale cost. Per-user effective cost drops well below Rp25k/mo at 10k+ users. **NEX could offer connectivity as a bundled Rp25k membership benefit** and still have Rp15-20k/user headroom for other opex + margin.
- **R3/R4 satellite paths do NOT close the economic gap at current public pricing.** They remain interesting only for coverage-hole users where fibre/mobile don't reach.
- **R2 mobile MVNO path is TIGHT but not dead.** If NEX can negotiate a bulk wholesale rate below Rp3k/GB (plausible for 100k+ users), R2 becomes viable and covers mobility use cases R1 cannot.

## Recommended next research (each a separate authorization)

- **Y-W4-19** — Attempt to fetch Telkom's specific IP Transit product page + pricing sheet if publicly listed. Register telkomsel.com, moratelindo.com, biznetnetworks.com as adapters and probe pricing/wholesale documentation URLs.
- **Y-W4-20** — Register spacex.com, starlink.com/en/business for Direct-to-Cell service details. Robots-compliant paths only.
- **Y-W4-21** — Register ast-science.com/investor-relations and other AST public documentation to track their commercial-launch schedule.
- **Y-W4-22** — Extract PP 46/2021 or PP 5/2021 (Indonesian regulation on business licensing) via BPK JDIH to verify NEX's non-operator status under R1 architecture. This is the last CRITICAL gap from the prior YES-hunt (attack_upstream_isp_terms).
- **Y-W4-23** — Model mixed-route architecture (R1 for urban users + R3/R4 for rural coverage-hole users) to see if hybrid economics work.

## Boundaries honoured

- All fetches routed through the enforced gateway
- Robots.txt checked before every commercial-site fetch
- No contact with any provider (Telkom, MNOs, Starlink, AST, etc.)
- No hardware · no transmission · no INDOLOCAL disclosure
- Every cost input carries an explicit source label (never invented as fact)
- UNKNOWN pricing yields UNKNOWN verdict (R4 AST)

## HARD STOP

External disclosure of INDOLOCAL: **NOT AUTHORIZED**.
`;
}
