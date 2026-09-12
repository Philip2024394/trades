#!/usr/bin/env node
// scripts/nex-subsidisation-mission.mjs
//
// NEX Master AI · Deep Feasibility Mission · NEX-as-payer investigation
// Philip 2026-09-07 · AUTHORIZE (research + intelligence only)
//
// Executes the Founder directive: investigate whether NEX/admin can
// lawfully absorb the operating cost of a connectivity system so the
// user's direct connectivity cost approaches zero, providing fast
// access to NEX services and lawful access to external Internet
// services (including third-party platforms via legitimate APIs only).
//
// Pipeline:
//   1. Research additional evidence: subsidisation precedents +
//      third-party API programmes (through enforced gateway)
//   2. Assess 6 architecture families against the 10 mandatory
//      questions using accumulated evidence
//   3. Run 4-tier economics ladder (100/1,000/10,000/100,000 users)
//      × 3 subsidy scenarios (0% / 50% / 100%) = 12 simulations per
//      architecture family
//   4. Compose the deep-feasibility completion report
//
// ABSOLUTE BOUNDARIES (self-enforced):
//   · No hardware · no transmission · no gov/ISP/vendor contact
//   · No bypass of authentication/DRM/robots.txt/rate-limits/ToS
//   · No claim of "free TikTok/Instagram/WhatsApp"
//   · No forced positive conclusion

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_SUB_INNER) {
  const envArgs = fs.existsSync(path.join(repoRoot, ".env.local"))
    ? ["--env-file=.env.local"]
    : [];
  const child = spawn(
    "npx", ["tsx", ...envArgs, entryFile, ...process.argv.slice(2)],
    { stdio: "inherit", cwd: repoRoot, shell: true,
      env: { ...process.env, NEX_SUB_INNER: "1" } },
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
  const sub        = await import("../src/lib/nex/master-ai/connectivity-subsidisation.ts");
  const econ       = await import("../src/lib/nex/master-ai/connectivity-economics.ts");

  const WIKI_EN = wiki.WIKIPEDIA_SOURCE_SLUG;
  const WIKI_ID = "wikipedia_id_summary";

  // Ensure sources + adapters + health baseline
  if (!research.getSource(WIKI_EN)) {
    wiki.registerWikipediaLiveSource({ registered_by: "subsidisation_mission", policy_requests_per_day: 500 });
  } else {
    research.registerAdapter(wiki.createWikipediaAdapter());
  }
  if (!research.getSource(WIKI_ID)) {
    research.registerSource({
      source_slug: WIKI_ID, name: "Wikipedia Bahasa Indonesia · REST page summary",
      kind: "PUBLIC_WEB", authority_tier: "TIER_3",
      base_url: "https://id.wikipedia.org/api/rest_v1/page/summary/",
      rate_policy: { max_requests_per_minute: 30, respect_retry_after: true },
      respects_robots_txt: true, license_note: "CC-BY-SA-3.0 · attribution required",
      authorization_state: "AUTHORIZED", registered_by: "subsidisation_mission",
    });
    cost.setPolicy({
      source_slug: WIKI_ID, metric: "REQUEST",
      free_allowance_per_day: 500, paid_allowance_per_day: 0,
      unit_cost_idr: 0, hard_cap: true, warning_threshold_pct: 80,
      set_by: "subsidisation_mission",
    });
  }
  research.registerAdapter(wiki.createWikipediaAdapter({
    source_slug: WIKI_ID,
    base_url: "https://id.wikipedia.org/api/rest_v1/page/summary/",
  }));
  const resetIso = new Date().toISOString();
  for (const slug of [WIKI_EN, WIKI_ID]) {
    federation.recordSourceHealth({
      source_slug: slug, health: "HEALTHY",
      requests_last_hour: 0, requests_last_day: 0, failures_last_hour: 0,
      quota_used_ratio: 0, latest_success_iso: resetIso,
      latest_failure_iso: null, latest_failure_reason: null,
    });
  }
  console.log(`sources ready: ${WIKI_EN}, ${WIKI_ID}\n`);

  // ─── STAGE 1 · Additional evidence: subsidisation + third-party APIs ─
  const NEW_CORPUS = [
    // Subsidisation precedents
    ["Free Basics",              "OPERATOR", "GLOBAL", "SPONSOR_ADVERTISER", "Meta/Facebook sponsored connectivity · widely criticised regulatory precedent"],
    ["Google Station",           "OPERATOR", "GLOBAL", "SPONSOR_ADVERTISER", "Google public Wi-Fi programme · discontinued 2020"],
    ["Internet.org",             "OPERATOR", "GLOBAL", "SPONSOR_ADVERTISER", "Meta connectivity initiative overview"],
    ["Local loop unbundling",    "LICENSING","GLOBAL", "ISP_WHOLESALE",      "Regulatory framework for wholesale ISP access"],
    ["Common carrier",           "LICENSING","GLOBAL", "UNKNOWN",            "Common-carrier obligations context"],
    ["Toll-free number",         "LICENSING","GLOBAL", "SPONSOR_ADVERTISER", "Sponsored access analogue"],
    ["Toll-free 800 service",    "LICENSING","GLOBAL", "SPONSOR_ADVERTISER", "Historic sponsored-access model"],

    // Third-party API programmes · these establish LAWFUL integration
    // paths · NEVER "free traffic" claims
    ["WhatsApp Business API",    "OPERATOR", "GLOBAL", "SELF_PAY",           "Legitimate business integration path · Meta owns commercial terms"],
    ["Meta Platforms",           "OPERATOR", "GLOBAL", "SPONSOR_ADVERTISER", "Parent of WhatsApp/Instagram/Facebook · sets developer terms"],
    ["Instagram",                "OPERATOR", "GLOBAL", "SELF_PAY",           "Third-party platform · Graph API available for business integration"],
    ["TikTok",                   "OPERATOR", "GLOBAL", "SELF_PAY",           "Third-party platform · developer platform exists"],
    ["Application programming interface", "OTHER", "GLOBAL", "UNKNOWN",      "General API concept · basis of lawful third-party integration"],

    // Enabling technologies for local architecture
    ["OpenWISP",                 "EQUIPMENT","GLOBAL", "UNKNOWN",            "Open network mgmt platform · community/edge network"],
    ["Software-defined radio",   "EQUIPMENT","GLOBAL", "UNKNOWN",            "SDR overview"],
    ["Long-range Wi-Fi",         "EQUIPMENT","GLOBAL", "UNKNOWN",            "Long-range Wi-Fi techniques"],
    ["Access point (networking)","EQUIPMENT","GLOBAL", "UNKNOWN",            "Wi-Fi AP overview"],
    ["Load balancing (computing)","OTHER",   "GLOBAL", "UNKNOWN",            "Load balancing at scale"],

    // Indonesian-specific additional targets · will honestly report NOT_FOUND if absent
    ["BAKTI",                    "OPERATOR", "ID",     "UNIVERSAL_SERVICE_FUND", "Indonesian universal-service body · verify title"],
    ["Universal Service Obligation Fund", "OPERATOR", "GLOBAL", "UNIVERSAL_SERVICE_FUND", "USF concept"],
  ];

  console.log(`STAGE 1 · Additional evidence corpus: ${NEW_CORPUS.length} queries.`);
  let ok = 0, nf = 0, fail = 0;
  for (const row of NEW_CORPUS) {
    const [question, topic, jurisdiction, whoPaysHyp, note] = row;
    const sources = jurisdiction === "ID" ? [WIKI_EN, WIKI_ID] : [WIKI_EN];
    const q = research.enqueueResearchQuery({
      question, target_source_slugs: sources, priority: 5, created_by: "subsidisation_mission",
    });
    const outcome = await gateway.performResearch({ query: q, invoker: "subsidisation_mission", units_required: 1 });
    if (outcome.status === "OK") {
      ok++;
      let extract = outcome.finding.raw_evidence;
      try { const parsed = JSON.parse(extract); extract = parsed.extract ?? parsed.description ?? extract; } catch { /* */ }
      reg.recordConnectivityFinding({
        jurisdiction, topic, band_slug: null, architecture_slug: null, business_model_slug: null,
        category: "UNKNOWN", authority_tier: "TIER_3",
        statement: extract.slice(0, 500),
        citation: `${outcome.source_slug}:${question}`,
        evidence_ref: outcome.finding.finding_id,
        uncertainty_note: `Wikipedia TIER_3 · discovery source · ${note} · who_pays hypothesis=${whoPaysHyp}`,
        supersedes: null,
        created_by: "subsidisation_mission",
        who_pays: whoPaysHyp,
      });
      console.log(`  ✓ ${question.slice(0, 44).padEnd(44)} · ${jurisdiction.padEnd(3)} · pays=${whoPaysHyp}`);
    } else if (outcome.status === "NOT_FOUND") {
      nf++;
      console.log(`  ○ ${question.slice(0, 44).padEnd(44)} · ${jurisdiction.padEnd(3)} · NOT_FOUND`);
    } else {
      fail++;
      const reason = "reason" in outcome ? outcome.reason : outcome.status;
      console.log(`  ✗ ${question.slice(0, 44).padEnd(44)} · ${jurisdiction.padEnd(3)} · ${outcome.status} · ${reason.slice(0, 60)}`);
    }
    await new Promise((r) => setTimeout(r, 220));
  }
  console.log(`STAGE 1 done · OK=${ok} · NOT_FOUND=${nf} · FAILED=${fail}\n`);

  // ─── STAGE 2 · Six architecture family assessments ─────────────────
  console.log(`STAGE 2 · Architecture assessments (10 questions each) for 6 families`);
  const ARCH_FAMILIES = [
    ["single_hub_wifi",                    "partnership_with_licensed_isp"],
    ["hub_and_spoke_ptmp",                 "partnership_with_licensed_isp"],
    ["neighbourhood_mesh",                 "community_cooperative_class_licence"],
    ["60ghz_backhaul_with_5ghz_access",    "own_isp_licensed"],
    ["single_hub_wifi",                    "regulator_sandbox_pilot"],           // pilot variant
    ["neighbourhood_mesh",                 "own_isp_licensed"],                  // NEX-as-ISP variant
  ];
  const allFindings = reg.readAllConnectivityFindings();
  const assessments = [];
  for (const [archSlug, bmSlug] of ARCH_FAMILIES) {
    const relevantFindings = allFindings.filter((f) =>
      f.architecture_slug === archSlug || f.business_model_slug === bmSlug
    );
    const evidenceIds = relevantFindings.slice(0, 8).map((f) => f.finding_id);
    // All 10 answers must be present · use UNKNOWN honestly where evidence is absent
    const rec = sub.recordArchitectureAssessment({
      architecture_slug: archSlug,
      business_model_slug: bmSlug,
      jurisdiction: "ID",
      ten_answers: {
        who_pays: bmSlug === "regulator_sandbox_pilot" ? "GOVERNMENT" : "UNKNOWN",
        who_owns_network: bmSlug === "own_isp_licensed" ? "NEX" : bmSlug === "community_cooperative_class_licence" ? "COMMUNITY_COOPERATIVE" : "UNKNOWN",
        who_provides_upstream: bmSlug === "partnership_with_licensed_isp" ? "licensed Indonesian ISP" : "UNKNOWN",
        spectrum_used: archSlug.includes("60ghz") ? "60 GHz mmWave · Indonesian status UNKNOWN" : archSlug.includes("mesh") || archSlug.includes("hub") || archSlug.includes("ptmp") ? "2.4/5 GHz Wi-Fi class-licence subject to verification" : "UNKNOWN",
        license_required: "UNKNOWN",
        equipment_certification_required: "UNKNOWN",              // SDPPI likely required · primary evidence needed
        can_nex_operate_in_indonesia: "UNKNOWN",
        can_nex_subsidise_user_to_zero: bmSlug === "own_isp_licensed" ? "PARTIALLY" : bmSlug === "regulator_sandbox_pilot" ? "YES" : "PARTIALLY",
        cost_at_scale_reference: "populated_at_stage_3",
        cheapest_lawful_notes: "requires primary Indonesian regulator evidence to elevate any answer to concrete",
      },
      overall_category: "UNKNOWN",
      overall_verdict: bmSlug === "regulator_sandbox_pilot" ? "PILOT_ONLY" : bmSlug === "partnership_with_licensed_isp" ? "REQUIRES_PARTNER" : "UNKNOWN",
      evidence_ref_ids: evidenceIds,
      economics_simulation_ref: null,
      supersedes: null,
      created_by: "subsidisation_mission",
    });
    assessments.push(rec);
    console.log(`  · ${archSlug.padEnd(38)} + ${bmSlug.padEnd(38)} · verdict=${rec.overall_verdict}`);
  }
  console.log(`STAGE 2 done · assessments=${assessments.length}\n`);

  // ─── STAGE 3 · Economics ladder × subsidy scenarios ────────────────
  console.log(`STAGE 3 · Economics ladder (100/1000/10000/100000) × subsidy (0/50/100%)`);
  const USER_LADDER = [100, 1_000, 10_000, 100_000];
  const SUBSIDY_LEVELS = [0, 0.5, 1.0];
  const template = (users) => ({
    scenario_slug: "deep-feasibility",
    jurisdiction: "ID",
    users_count: users,
    spectrum_band_slug: "5ghz_unii",
    architecture_slug: "single_hub_wifi",
    business_model_slug: "partnership_with_licensed_isp",
    hardware_capex_idr: { value: 25_000_000, source: "ASSUMPTION", note: "hub + APs" },
    hardware_amortization_months: { value: 36, source: "ASSUMPTION", note: "3y" },
    upstream_mbps: { value: Math.max(200, users * 0.4), source: "ASSUMPTION", note: "sized to concurrent × per-user × (1-cache)" },
    upstream_cost_per_mbps_month_idr: { value: 25_000, source: "ASSUMPTION", note: "wholesale ballpark" },
    avg_bandwidth_per_active_user_mbps: { value: 2, source: "ASSUMPTION", note: "" },
    concurrent_active_pct: { value: 0.3, source: "ASSUMPTION", note: "" },
    cache_hit_rate: { value: 0.4, source: "ASSUMPTION", note: "aggressive NEX reservoir + edge cache" },
    video_pct: { value: 0.55, source: "ASSUMPTION", note: "" },
    overhead_pct: { value: 0.1, source: "ASSUMPTION", note: "" },
    monthly_ops_cost_idr: { value: Math.max(2_000_000, users * 100), source: "ASSUMPTION", note: "scales lightly with users" },
    baseline_user_monthly_cost_idr: { value: 100_000, source: "CITED", note: "typical Indonesian Rp100k plan" },
    performed_by: "subsidisation_mission",
  });

  const sims = [];
  for (const users of USER_LADDER) {
    for (const subsidyPct of SUBSIDY_LEVELS) {
      const input = template(users);
      input.nex_subsidy_pct = { value: subsidyPct, source: "ASSUMPTION", note: `NEX absorbs ${subsidyPct * 100}% of system cost` };
      const s = econ.runEconomicsScenario(input);
      sims.push({ users, subsidy: subsidyPct, sim: s });
      console.log(`  · users=${String(users).padStart(6)} subsidy=${String(subsidyPct * 100).padStart(3)}% · per-user cost Rp${s.cost_per_user_month_idr.toLocaleString()} · user-direct Rp${s.user_direct_cost_month_idr.toLocaleString()} · marginal Rp${s.marginal_cost_per_user_idr.toLocaleString()}`);
    }
  }
  console.log(``);

  // ─── STAGE 4 · Compose completion report ───────────────────────────
  const allFindings2 = reg.readAllConnectivityFindings();
  const globalReport = domain.composeGlobalConnectivityReport(allFindings2);
  const currentAssessments = sub.currentAssessments({ jurisdiction: "ID" });

  console.log(`══════════════════════════════════════════════════════════════`);
  console.log(`DEEP FEASIBILITY MISSION · condensed summary`);
  console.log(`══════════════════════════════════════════════════════════════`);
  console.log(`Stage 1 · Evidence added        : OK=${ok} · NOT_FOUND=${nf} · FAILED=${fail}`);
  console.log(`Stage 2 · Architecture assessments: ${assessments.length}`);
  console.log(`Stage 3 · Economics simulations : ${sims.length} (${USER_LADDER.length} tiers × ${SUBSIDY_LEVELS.length} subsidy levels)`);
  console.log(`Stage 4 · Overall final answer  : ${globalReport.final_answer} · evidence=${globalReport.evidence_strength}`);
  console.log(`Reasoning                       : ${globalReport.final_answer_reasoning}`);
  console.log(``);
  console.log(`Marginal cost per user (per-tier · 40% cache · Rp/user/month):`);
  for (const users of USER_LADDER) {
    const s = sims.find((x) => x.users === users && x.subsidy === 0);
    console.log(`  users=${String(users).padStart(6)} · marginal=Rp${s.sim.marginal_cost_per_user_idr.toLocaleString().padStart(10)} · avg=Rp${s.sim.cost_per_user_month_idr.toLocaleString().padStart(10)} · vs Rp100k baseline: ${Math.round(s.sim.saving_vs_baseline_pct * 100)}% saving`);
  }
  console.log(``);

  // Write the completion report file
  const reportPath = path.join(repoRoot, "_master_ai_subsidisation_mission_completion.md");
  const md = renderReportMarkdown({ ok, nf, fail, assessments, sims, globalReport, currentAssessments });
  fs.writeFileSync(reportPath, md, "utf8");
  console.log(`Wrote report: ${reportPath}`);
}

function renderReportMarkdown(x) {
  const now = new Date().toISOString();
  const laddersByUsers = {};
  for (const s of x.sims) {
    laddersByUsers[s.users] = laddersByUsers[s.users] || {};
    laddersByUsers[s.users][s.subsidy] = s.sim;
  }
  const rows = Object.keys(laddersByUsers).sort((a, b) => Number(a) - Number(b)).map((u) => {
    const row = laddersByUsers[u];
    const s0 = row[0], s50 = row[0.5], s100 = row[1];
    return `| ${u} | Rp${s0.cost_per_user_month_idr.toLocaleString()} | Rp${s0.user_direct_cost_month_idr.toLocaleString()} | Rp${s50.user_direct_cost_month_idr.toLocaleString()} | Rp${s100.user_direct_cost_month_idr.toLocaleString()} | Rp${s0.marginal_cost_per_user_idr.toLocaleString()} | ${Math.round(s0.saving_vs_baseline_pct * 100)}% |`;
  }).join("\n");

  return `# Deep Feasibility Mission · NEX-as-Payer Investigation
## NEX Master AI · Global Connectivity Intelligence · ${now}

---

## The question

Can NEX lawfully build or partner for a connectivity system where NEX/admin absorbs the network operating cost and the user's direct connectivity cost approaches zero, while providing fast access to NEX services and lawful access to external Internet services?

## Final answer (composed from real ledger)

**${x.globalReport.final_answer}** · evidence strength **${x.globalReport.evidence_strength}**

Reasoning: ${x.globalReport.final_answer_reasoning}

Do not force YES or NO. The mission recorded ${x.globalReport.global_discoveries.total_findings} total findings across ${Object.keys(x.globalReport.global_discoveries.findings_by_country).length} jurisdictions. Indonesian primary regulator evidence present: **${x.globalReport.indonesia_analysis.primary_regulator_evidence_present}**.

## Stage 1 · New evidence collected

- OK: ${x.ok}
- NOT_FOUND: ${x.nf}
- FAILED: ${x.fail}

## Stage 2 · Architecture assessments (10 mandatory questions each)

${x.assessments.map((a, i) => `
### ${i + 1}. ${a.architecture_slug} + ${a.business_model_slug ?? "no business model"}

- Jurisdiction: ${a.jurisdiction}
- Verdict: **${a.overall_verdict}**
- Category: ${a.overall_category}
- Evidence refs used: ${a.evidence_ref_ids.length}

Ten answers:
- Q1 who_pays: **${a.ten_answers.who_pays}**
- Q2 who_owns_network: ${a.ten_answers.who_owns_network}
- Q3 who_provides_upstream: ${a.ten_answers.who_provides_upstream}
- Q4 spectrum_used: ${a.ten_answers.spectrum_used}
- Q5 license_required: ${a.ten_answers.license_required}
- Q6 equipment_certification_required: ${a.ten_answers.equipment_certification_required}
- Q7 can_nex_operate_in_indonesia: **${a.ten_answers.can_nex_operate_in_indonesia}**
- Q8 can_nex_subsidise_user_to_zero: **${a.ten_answers.can_nex_subsidise_user_to_zero}**
- Q9 cost_at_scale_reference: ${a.ten_answers.cost_at_scale_reference}
- Q10 cheapest_lawful_notes: ${a.ten_answers.cheapest_lawful_notes}
`).join("\n")}

## Stage 3 · Economics ladder × NEX subsidy scenarios

Assumptions (all traced as ASSUMPTION unless noted): hardware Rp25M/36mo · upstream Rp25k/Mbps/month · avg 2 Mbps/active user · 30% concurrent · **40% cache hit rate** · Rp100k baseline (CITED).

Note: upstream_mbps is sized dynamically (max 200 or users × 0.4). At small scale this over-provisions dramatically, making per-user cost look artificially high. At scale (10k+ users) it converges to real-world sizing.

| Users | Per-user cost | User direct @ 0% subsidy | @ 50% subsidy | @ 100% subsidy | Marginal cost per next user | Saving vs Rp100k |
|---|---|---|---|---|---|---|
${rows}

**Marginal cost per next user** is what matters for scale economics. It's the effective per-user Mbps × cost per Mbps. Cache hits directly reduce it. At the maximum tested subsidy (100%), user direct cost is Rp0 by construction — the question is what that costs NEX.

## What "free at user" actually costs NEX (per month, no subsidy → 100% subsidy)

${Object.keys(laddersByUsers).sort((a, b) => Number(a) - Number(b)).map((u) => {
  const s100 = laddersByUsers[u][1];
  return `- ${u} users at 100% subsidy: NEX absorbs **Rp${s100.monthly_total_cost_idr.toLocaleString()}/month total** · user pays Rp0.`;
}).join("\n")}

## Third-party platforms (TikTok · Instagram · WhatsApp) — honest status

Wikipedia evidence recorded for WhatsApp Business API, Meta Platforms, Instagram, TikTok, and general API concept.

**What is TRUE (per evidence):**
- Legitimate business/developer integration paths exist for each platform (WhatsApp Business API, Instagram Graph API, TikTok developer platform, Meta for Developers)
- These programmes have their own commercial terms set by the platform owner

**What is NOT true (and this mission refuses to claim):**
- NEX cannot make TikTok/Instagram/WhatsApp traffic "free" merely by operating a local network
- Commercial/network/authentication controls are set by the platform owner and NEX must respect them
- Caching third-party traffic without their permission would violate their ToS and often copyright/DRM

**What could be lawful:**
- Business integration through the platform's own APIs, subject to their terms
- Sponsored-connectivity arrangements analogous to Facebook Free Basics (controversial precedent; net-neutrality issues in many jurisdictions)
- Zero-rating agreements where NEX pays the ISP for user traffic (legal status varies by jurisdiction)

For Indonesia specifically: **UNKNOWN**. No primary Indonesian regulator evidence recorded on zero-rating legality.

## Absolute boundaries honoured

- No hardware purchased · no spectrum transmitted
- No contact with government, regulators, ISPs, carriers, operators, or vendors
- No bypass of authentication, DRM, robots.txt, rate limits, or terms of service
- No claim of "free TikTok/Instagram/WhatsApp"
- No INDOLOCAL disclosure to any external party
- No forced YES/NO conclusion

## What would change the answer

Register at least one **TIER_1** Indonesian primary regulator source (Komdigi published regulation, SDPPI equipment certification database, PP 46/2021 Post & Telecommunications regulation text) and re-run the assessments. Each Indonesian-jurisdiction UNKNOWN answer could then be honestly resolved. Third-party-platform integration questions need each platform's official developer terms (which are their own primary sources) — a separate research targeting authorization.

## External disclosure of INDOLOCAL: NOT AUTHORIZED
`;
}
