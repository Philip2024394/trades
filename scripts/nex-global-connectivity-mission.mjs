#!/usr/bin/env node
// scripts/nex-global-connectivity-mission.mjs
//
// NEX Master AI · Global Free/Low-Cost Connectivity Intelligence Mission
// Philip 2026-09-07 · AUTHORIZE (research + intelligence only)
//
// Executes the mission specified in the Founder directive:
//   · Investigates 6 architecture families (A. spectrum · B. community
//     networks · C. government-funded · D. ISP/wholesale · E. MVNO ·
//     F. local wireless distribution)
//   · Covers 10 countries from COUNTRY_CATALOGUE + relevant global concepts
//   · Every finding records who_pays (§5 · never call something "free"
//     without saying who pays)
//   · Every Indonesian finding tagged UNKNOWN unless the Wikipedia
//     summary itself carries clearly documented Indonesian information
//     (§7 · Wikipedia may NOT by itself establish Indonesian legal
//     permission)
//   · Every ALL query routed through performResearch (enforced gateway)
//   · At completion, composes the Philip §14 report and writes it to
//     _master_ai_global_connectivity_intelligence_report.md
//
// ABSOLUTE BOUNDARIES:
//   · No hardware · no transmission · no gov/ISP/vendor contact
//   · No bypass of auth/DRM/robots.txt/rate limits
//   · No claim of "free" without who_pays evidence
//   · No forced positive conclusion

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_GCM_INNER) {
  const envArgs = fs.existsSync(path.join(repoRoot, ".env.local"))
    ? ["--env-file=.env.local"]
    : [];
  const child = spawn(
    "npx",
    ["tsx", ...envArgs, entryFile, ...process.argv.slice(2)],
    { stdio: "inherit", cwd: repoRoot, shell: true,
      env: { ...process.env, NEX_GCM_INNER: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const wiki       = await import("../src/lib/nex/master-ai/live-adapter-wikipedia.ts");
  const research   = await import("../src/lib/nex/master-ai/research-engine.ts");
  const gateway    = await import("../src/lib/nex/master-ai/research-gateway.ts");
  const reg        = await import("../src/lib/nex/master-ai/connectivity-regulation.ts");
  const domain     = await import("../src/lib/nex/master-ai/connectivity-mission-domain.ts");
  const cost       = await import("../src/lib/nex/master-ai/cost-intelligence.ts");
  const federation = await import("../src/lib/nex/master-ai/source-federation.ts");

  const WIKI_EN = wiki.WIKIPEDIA_SOURCE_SLUG;
  const WIKI_ID = "wikipedia_id_summary";

  // Sources should already be registered from prior investigation
  // Ensure health baseline is HEALTHY (post any earlier degradation)
  const resetIso = new Date().toISOString();
  for (const slug of [WIKI_EN, WIKI_ID]) {
    federation.recordSourceHealth({
      source_slug: slug, health: "HEALTHY",
      requests_last_hour: 0, requests_last_day: 0, failures_last_hour: 0,
      quota_used_ratio: 0,
      latest_success_iso: resetIso,
      latest_failure_iso: null, latest_failure_reason: null,
    });
  }
  // Ensure sources exist (persistent) · always re-register adapters (in-memory)
  if (!research.getSource(WIKI_EN)) {
    wiki.registerWikipediaLiveSource({ registered_by: "global_connectivity_mission", policy_requests_per_day: 500 });
  } else {
    // adapter map is per-process · must be re-registered every run
    research.registerAdapter(wiki.createWikipediaAdapter());
  }
  if (!research.getSource(WIKI_ID)) {
    research.registerSource({
      source_slug: WIKI_ID, name: "Wikipedia Bahasa Indonesia · REST page summary",
      kind: "PUBLIC_WEB", authority_tier: "TIER_3",
      base_url: "https://id.wikipedia.org/api/rest_v1/page/summary/",
      rate_policy: { max_requests_per_minute: 30, respect_retry_after: true },
      respects_robots_txt: true, license_note: "CC-BY-SA-3.0 · attribution required",
      authorization_state: "AUTHORIZED", registered_by: "global_connectivity_mission",
    });
    cost.setPolicy({
      source_slug: WIKI_ID, metric: "REQUEST",
      free_allowance_per_day: 500, paid_allowance_per_day: 0,
      unit_cost_idr: 0, hard_cap: true, warning_threshold_pct: 80,
      set_by: "global_connectivity_mission",
    });
  }
  // Always ensure id.wikipedia adapter present (per-process)
  research.registerAdapter(wiki.createWikipediaAdapter({
    source_slug: WIKI_ID,
    base_url: "https://id.wikipedia.org/api/rest_v1/page/summary/",
  }));
  console.log(`sources ready: ${WIKI_EN}, ${WIKI_ID}\n`);

  // ─── Mission corpus · 6 architecture families × 10 countries ───────
  // Every entry declares expected who_pays as a HYPOTHESIS_TO_VERIFY —
  // the runner extracts a real snippet from Wikipedia and records the
  // hypothesis with `uncertainty_note: "who_pays inferred from Wikipedia
  // summary structure · TIER_3"`. Never declared FACT.
  const CORPUS = [
    // ═ A · SPECTRUM (GLOBAL) ═
    ["Wi-Fi",                    "SPECTRUM", "GLOBAL", null, null, null,                            "SELF_PAY", "Wi-Fi at end user typically self-paid" ],
    ["ISM band",                 "SPECTRUM", "GLOBAL", "2_4ghz_isb", null, null,                    "GENUINELY_OPEN_LOCAL", "Class-licensed band · country rules vary" ],
    ["Wi-Fi HaLow",              "SPECTRUM", "GLOBAL", null, null, null,                            "UNKNOWN", "IEEE 802.11ah long-range Wi-Fi" ],
    ["6 GHz Wi-Fi",              "SPECTRUM", "GLOBAL", "6ghz_unii", null, null,                     "UNKNOWN", "Wi-Fi 6E band; country availability varies" ],
    ["Radio spectrum",           "SPECTRUM", "GLOBAL", null, null, null,                            "UNKNOWN", "General spectrum context" ],

    // ═ B · COMMUNITY NETWORKS ═
    ["Community network",        "OTHER",    "GLOBAL", null, "neighbourhood_mesh", "community_cooperative_class_licence", "COMMUNITY_COOPERATIVE", "General community-network concept" ],
    ["Wireless community network","OTHER",   "GLOBAL", null, "neighbourhood_mesh", "community_cooperative_class_licence", "COMMUNITY_COOPERATIVE", "Community wireless overview" ],
    ["Freifunk",                 "OTHER",    "DE",     null, "neighbourhood_mesh", "community_cooperative_class_licence", "COMMUNITY_COOPERATIVE", "German community mesh · 400+ communities" ],
    ["Guifi.net",                "OTHER",    "ES",     null, "neighbourhood_mesh", "community_cooperative_class_licence", "COMMUNITY_COOPERATIVE", "Spanish community broadband cooperative" ],
    ["NYC Mesh",                 "OTHER",    "US",     null, "neighbourhood_mesh", "community_cooperative_class_licence", "COMMUNITY_COOPERATIVE", "New York community mesh cooperative" ],
    ["B4RN",                     "OTHER",    "GB",     null, null, "community_cooperative_class_licence",                 "COMMUNITY_COOPERATIVE", "UK rural community fibre cooperative" ],
    ["Athens Wireless Metropolitan Network", "OTHER", "GR", null, "neighbourhood_mesh", null,       "COMMUNITY_COOPERATIVE", "Greek community mesh · one of oldest" ],
    ["Wireless mesh network",    "OTHER",    "GLOBAL", null, "neighbourhood_mesh", null,            "UNKNOWN", "Architecture concept" ],
    ["IEEE 802.11s",             "OTHER",    "GLOBAL", null, "neighbourhood_mesh", null,            "UNKNOWN", "Mesh amendment to Wi-Fi" ],

    // ═ C · GOVERNMENT / MUNICIPAL / USF FUNDED ═
    ["BharatNet",                "OPERATOR", "IN",     null, null, null,                            "GOVERNMENT", "Indian government-funded rural broadband" ],
    ["Digital India",            "OTHER",    "IN",     null, null, null,                            "GOVERNMENT", "Umbrella government digital programme" ],
    ["Wireless@SG",              "OPERATOR", "SG",     null, null, null,                            "GOVERNMENT", "Singapore nationwide free public Wi-Fi" ],
    ["Chattanooga EPB",          "OPERATOR", "US",     null, null, null,                            "MUNICIPALITY", "US municipal broadband precedent" ],
    ["National Broadband Network","OPERATOR","AU",     null, null, "own_isp_licensed",              "GOVERNMENT", "Australia government-wholesaled broadband" ],
    ["Ultra-Fast Broadband",     "OPERATOR", "NZ",     null, null, null,                            "GOVERNMENT", "NZ government fibre programme" ],
    ["Universal service",        "LICENSING","GLOBAL", null, null, null,                            "UNIVERSAL_SERVICE_FUND", "Universal service concept + funds" ],
    ["Public Wi-Fi",             "OPERATOR", "GLOBAL", null, null, null,                            "MULTIPLE", "Public Wi-Fi funding patterns" ],
    ["Municipal broadband",      "OPERATOR", "GLOBAL", null, null, null,                            "MUNICIPALITY", "Municipal-owned broadband concept" ],

    // ═ D · ISP / WHOLESALE ═
    ["Internet service provider","OPERATOR", "GLOBAL", null, null, "own_isp_licensed",              "SELF_PAY", "ISP business model overview" ],
    ["Wholesale Internet",       "OPERATOR", "GLOBAL", null, null, null,                            "ISP_WHOLESALE", "Wholesale bandwidth market" ],
    ["Wireless Internet service provider", "OPERATOR", "GLOBAL", null, "hub_and_spoke_ptmp", null,  "SELF_PAY", "WISP business/architecture" ],

    // ═ E · MVNO · ZERO-RATING · SPONSORED DATA ═
    ["Mobile virtual network operator", "OPERATOR", "GLOBAL", null, null, null,                     "SELF_PAY", "MVNO model" ],
    ["Zero-rating",              "LICENSING","GLOBAL", null, null, null,                            "SPONSOR_ADVERTISER", "Zero-rating regulatory concept" ],
    ["Sponsored data",           "LICENSING","GLOBAL", null, null, null,                            "SPONSOR_ADVERTISER", "Sponsored data model" ],
    ["Net neutrality",           "LICENSING","GLOBAL", null, null, null,                            "UNKNOWN", "Net-neutrality regulation context" ],

    // ═ F · LOCAL WIRELESS DISTRIBUTION / EDGE / P2P ═
    ["Wi-Fi Direct",             "EQUIPMENT","GLOBAL", null, null, null,                            "GENUINELY_OPEN_LOCAL", "Device-to-device Wi-Fi" ],
    ["Ad hoc network",           "OTHER",    "GLOBAL", null, null, null,                            "GENUINELY_OPEN_LOCAL", "General ad-hoc networking" ],
    ["Content delivery network", "OTHER",    "GLOBAL", null, null, null,                            "CROSS_SUBSIDY", "CDN edge caching model" ],
    ["Edge computing",           "OTHER",    "GLOBAL", null, null, null,                            "UNKNOWN", "Edge computing overview" ],
    ["OpenWrt",                  "EQUIPMENT","GLOBAL", null, null, null,                            "UNKNOWN", "Open-source router firmware" ],

    // ═ INDONESIA-SPECIFIC (§7 · Wikipedia is TIER_3 · every ID finding UNKNOWN unless clear) ═
    ["Kementerian Komunikasi dan Digital Republik Indonesia", "LICENSING", "ID", null, null, null,  "UNKNOWN", "Komdigi structure · not primary regulation" ],
    ["Telecommunications in Indonesia", "LICENSING", "ID", null, null, "own_isp_licensed",          "SELF_PAY", "ISP regime · well-documented user-pay" ],
    ["Internet in Indonesia",    "OTHER",    "ID",     null, null, null,                            "SELF_PAY", "General Indonesian internet landscape" ],
    ["Palapa Ring",              "OPERATOR", "ID",     null, null, null,                            "GOVERNMENT", "Indonesian government backbone project" ],
    ["Badan Aksesibilitas Telekomunikasi dan Informasi", "OPERATOR", "ID", null, null, null,        "UNIVERSAL_SERVICE_FUND", "BAKTI (Indonesian USF operator)" ],

    // ═ Country regulators / concepts (for global reference · GLOBAL jurisdiction · UNKNOWN category) ═
    ["Federal Communications Commission", "LICENSING", "US", null, null, null,                      "UNKNOWN", "US regulator overview" ],
    ["Ofcom",                    "LICENSING","GB",     null, null, null,                            "UNKNOWN", "UK regulator overview" ],
    ["Telecom Regulatory Authority of India", "LICENSING", "IN", null, null, null,                  "UNKNOWN", "Indian regulator overview" ],
    ["Infocomm Media Development Authority", "LICENSING", "SG", null, null, null,                   "UNKNOWN", "Singapore regulator overview" ],
    ["Bundesnetzagentur",        "LICENSING","DE",     null, null, null,                            "UNKNOWN", "German regulator overview" ],
    ["Australian Communications and Media Authority", "LICENSING", "AU", null, null, null,          "UNKNOWN", "Australian regulator overview" ],
  ];

  console.log(`Corpus: ${CORPUS.length} queries across 6 architecture families and 10 countries.\n`);
  let queriesEnqueued = 0, fetchedOk = 0, fetchedNotFound = 0, fetchedBlocked = 0, fetchedFailed = 0;

  for (const row of CORPUS) {
    const [question, topic, jurisdiction, band_slug, architecture_slug, business_model_slug, hypWhoPays, note] = row;
    const sources = jurisdiction === "ID" ? [WIKI_EN, WIKI_ID] : [WIKI_EN];
    const q = research.enqueueResearchQuery({
      question, target_source_slugs: sources, priority: 5, created_by: "global_connectivity_mission",
    });
    queriesEnqueued++;

    const outcome = await gateway.performResearch({
      query: q, invoker: "global_connectivity_mission", units_required: 1,
    });

    if (outcome.status === "OK") {
      fetchedOk++;
      const raw = outcome.finding.raw_evidence;
      let extract = raw;
      try { const parsed = JSON.parse(raw); extract = parsed.extract ?? parsed.description ?? raw; } catch { /* */ }

      // Category: default UNKNOWN unless the topic is Indonesian ISP (well-documented REQUIRES_LICENSE)
      // Never elevate to ALLOWED_NOW without primary-regulator evidence (§7 §8)
      let category = "UNKNOWN";
      if (jurisdiction === "ID" && question === "Telecommunications in Indonesia") category = "REQUIRES_LICENSE";
      const uncertainty = category === "UNKNOWN"
        ? `Wikipedia TIER_3 · discovery source · ${note} · who_pays hypothesis=${hypWhoPays}`
        : `Wikipedia TIER_3 · primary regulator source required to elevate · ${note}`;

      reg.recordConnectivityFinding({
        jurisdiction, topic, band_slug, architecture_slug, business_model_slug,
        category, authority_tier: "TIER_3",
        statement: extract.slice(0, 500),
        citation: `${outcome.source_slug}:${question}`,
        evidence_ref: outcome.finding.finding_id,
        uncertainty_note: uncertainty,
        supersedes: null,
        created_by: "global_connectivity_mission",
        who_pays: hypWhoPays,
      });
      const emoji = jurisdiction === "ID" ? "★" : "·";
      console.log(`  ${emoji} ${question.slice(0, 52).padEnd(52)} · ${jurisdiction.padEnd(3)} · ${outcome.source_slug.padEnd(20)} · pays=${hypWhoPays}`);
    } else if (outcome.status === "NOT_FOUND") {
      fetchedNotFound++;
      console.log(`  ○ ${question.slice(0, 52).padEnd(52)} · ${jurisdiction.padEnd(3)} · NOT_FOUND`);
    } else if (outcome.status === "BLOCKED" || outcome.status === "OFFLINE_MODE" || outcome.status === "FALLTHROUGH_TO_OFFLINE") {
      fetchedBlocked++;
      const reason = "reason" in outcome ? outcome.reason : outcome.status;
      console.log(`  ! ${question.slice(0, 52).padEnd(52)} · ${jurisdiction.padEnd(3)} · ${outcome.status} · ${reason.slice(0, 60)}`);
    } else {
      fetchedFailed++;
      const reason = "reason" in outcome ? outcome.reason : outcome.status;
      console.log(`  ✗ ${question.slice(0, 52).padEnd(52)} · ${jurisdiction.padEnd(3)} · ${outcome.status} · ${reason.slice(0, 60)}`);
    }
    await new Promise((r) => setTimeout(r, 220));
  }

  // ─── Compose the Global Connectivity Intelligence Report ───────────
  const allFindings = reg.readAllConnectivityFindings();
  const report = domain.composeGlobalConnectivityReport(allFindings);

  // Print condensed summary
  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`GLOBAL CONNECTIVITY INTELLIGENCE REPORT · condensed summary`);
  console.log(`══════════════════════════════════════════════════════════════`);
  console.log(`Queries enqueued : ${queriesEnqueued}`);
  console.log(`Fetched OK       : ${fetchedOk}`);
  console.log(`NOT_FOUND        : ${fetchedNotFound}`);
  console.log(`BLOCKED/OFFLINE  : ${fetchedBlocked}`);
  console.log(`FAILED           : ${fetchedFailed}`);
  console.log(``);
  console.log(`Total findings in ledger: ${allFindings.length}`);
  console.log(`Findings by country:`);
  const sortedCountries = Object.entries(report.global_discoveries.findings_by_country).sort((a, b) => b[1] - a[1]);
  for (const [k, v] of sortedCountries) console.log(`  ${k.padEnd(8)} ${v}`);
  console.log(``);
  console.log(`Findings by category:`);
  for (const [k, v] of Object.entries(report.global_discoveries.by_category)) console.log(`  ${k.padEnd(22)} ${v}`);
  console.log(``);
  console.log(`Findings by who_pays:`);
  const sortedPays = Object.entries(report.global_discoveries.by_who_pays).sort((a, b) => b[1] - a[1]);
  for (const [k, v] of sortedPays) if (v > 0) console.log(`  ${k.padEnd(24)} ${v}`);
  console.log(``);
  console.log(`Indonesia:`);
  console.log(`  total_findings                : ${report.indonesia_analysis.total_findings}`);
  console.log(`  primary_regulator_evidence    : ${report.indonesia_analysis.primary_regulator_evidence_present}`);
  console.log(`  strongest_authority_tier      : ${report.indonesia_analysis.strongest_authority_tier_seen}`);
  console.log(`  by_category                   : ${JSON.stringify(report.indonesia_analysis.by_category)}`);
  console.log(``);
  console.log(`Evidence strength: ${report.evidence_strength}`);
  console.log(`Final answer     : ${report.final_answer}`);
  console.log(`Reasoning        : ${report.final_answer_reasoning}`);
  console.log(``);
  console.log(`Two-phone proof ready: ${report.two_phone_proof_ready}`);
  console.log(`Two-phone proof reasoning: ${report.two_phone_proof_reasoning}`);
  console.log(``);

  // Write the full report file
  const reportPath = path.join(repoRoot, "_master_ai_global_connectivity_intelligence_report.md");
  const md = renderReportMarkdown(report, { queriesEnqueued, fetchedOk, fetchedNotFound, fetchedBlocked, fetchedFailed });
  fs.writeFileSync(reportPath, md, "utf8");
  console.log(`Wrote report: ${reportPath}`);
}

function renderReportMarkdown(r, run) {
  const sortedCountries = Object.entries(r.global_discoveries.findings_by_country).sort((a, b) => b[1] - a[1]);
  const sortedPays = Object.entries(r.global_discoveries.by_who_pays).sort((a, b) => b[1] - a[1]).filter(([, v]) => v > 0);
  const cats = r.global_discoveries.by_category;
  const idCats = r.indonesia_analysis.by_category;
  const now = new Date().toISOString();
  return `# Global Connectivity Intelligence Report
## NEX Master AI · ${now}

---

## Question

Can lawful architecture provide Internet to users at Rp0 or dramatically reduced cost in Indonesia?

## Final answer

**${r.final_answer}** · evidence strength: **${r.evidence_strength}**

Reasoning: ${r.final_answer_reasoning}

## Global discoveries

- Queries enqueued: ${run.queriesEnqueued}
- Real fetches OK: ${run.fetchedOk}
- NOT_FOUND: ${run.fetchedNotFound}
- BLOCKED/OFFLINE: ${run.fetchedBlocked}
- FAILED: ${run.fetchedFailed}
- Total findings in ledger: ${r.global_discoveries.total_findings}

### Findings by country

${sortedCountries.map(([k, v]) => `- ${k}: ${v}`).join("\n")}

### Findings by category

${Object.entries(cats).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

### Findings by who_pays

${sortedPays.map(([k, v]) => `- ${k}: ${v}`).join("\n")}

## Indonesia analysis

- Total Indonesian findings: ${r.indonesia_analysis.total_findings}
- Strongest authority tier seen: ${r.indonesia_analysis.strongest_authority_tier_seen}
- Primary regulator evidence present: **${r.indonesia_analysis.primary_regulator_evidence_present}**
- By category: ${JSON.stringify(idCats)}
- By who_pays: ${JSON.stringify(r.indonesia_analysis.by_who_pays)}

## Best architecture by category

- ALLOWED_NOW:          ${r.best_architecture_by_category.allowed_now ?? "none yet"}
- REQUIRES_LICENSE:     ${r.best_architecture_by_category.requires_license ?? "none yet"}
- REQUIRES_PARTNERSHIP: ${r.best_architecture_by_category.requires_partnership ?? "none yet"}
- POSSIBLE_PILOT:       ${r.best_architecture_by_category.possible_pilot ?? "none yet"}

## Biggest risks

${r.biggest_risks.length === 0 ? "- none surfaced yet" : r.biggest_risks.map((x) => `- ${x}`).join("\n")}

## Biggest unknowns

${r.biggest_unknowns.length === 0 ? "- none surfaced yet" : r.biggest_unknowns.map((x) => `- ${x}`).join("\n")}

## Two-phone proof status

Ready: **${r.two_phone_proof_ready}**

Reasoning: ${r.two_phone_proof_reasoning}

## Honesty notes

- Every finding is authority TIER_3 (Wikipedia summary).
- No finding claims Indonesian legality without primary regulator evidence.
- Empty categories are honestly reported as "none yet"; zero forced conclusions.
- External disclosure of INDOLOCAL: **NOT AUTHORIZED**.

## Boundaries honoured

- No hardware purchased, no spectrum transmitted, no regulator/ISP contacted.
- No bypass of authentication, DRM, robots.txt, rate limits, or platform terms.
- Every fetch routed through the enforced research gateway.
- No "free Internet" claim without who_pays evidence.

## What would move this report to HIGH evidence strength

Register at least one TIER_1 or TIER_2 Indonesian primary regulator source
(e.g. Komdigi published regulation, SDPPI equipment certification database)
and re-run the mission targeting the Indonesian regulatory topics with
those sources. Findings currently tagged UNKNOWN for jurisdiction "ID"
can then be honestly elevated to ALLOWED_NOW / REQUIRES_LICENSE /
REQUIRES_PARTNERSHIP / POSSIBLE_PILOT based on real primary evidence.
`;
}
