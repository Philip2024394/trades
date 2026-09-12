#!/usr/bin/env node
// scripts/nex-indolocal-investigate.mjs
//
// NEX Master AI · Y-W4-1 + Y-W4-2 + Y-W4-5 · First real INDOLOCAL investigation
// Philip 2026-09-07 · AUTHORIZE (BEGIN issued for these YELLOWs)
//
// This script performs the first REAL live research pass through the enforced
// gateway. It:
//   1. Registers Wikipedia (en) as an authorized live source        (Y-W4-1)
//   2. Registers Wikipedia (id) as a second authorized live source  (Y-W4-2)
//   3. Enqueues research queries across three domains:              (Y-W4-5)
//        · global community connectivity architectures
//        · Indonesian regulation / RLAN / class-licence framework
//        · P2P device technologies for the future two-phone proof
//   4. Routes every query through performResearch (enforced gateway)
//   5. For each OK finding, records a ConnectivityFinding with honest
//      category/authority/uncertainty (Wikipedia is TIER_3 · never
//      declared ALLOWED_NOW without primary regulator evidence)
//   6. Prints a hard-stop report with real numbers
//
// HARD RULES · self-enforced by the code path:
//   · No hardware purchased, ordered, or specified for procurement
//   · No transmission on any frequency
//   · No contact with government/ISPs (only public REST API reads)
//   · No claim of legality without evidence
//   · No auto-promotion of findings
//   · Findings recorded APPEND-ONLY under data/master-ai/

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_INDOLOCAL_INNER) {
  const envArgs = fs.existsSync(path.join(repoRoot, ".env.local"))
    ? ["--env-file=.env.local"]
    : [];
  const child = spawn(
    "npx",
    ["tsx", ...envArgs, entryFile, ...process.argv.slice(2)],
    { stdio: "inherit", cwd: repoRoot, shell: true,
      env: { ...process.env, NEX_INDOLOCAL_INNER: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const wiki  = await import("../src/lib/nex/master-ai/live-adapter-wikipedia.ts");
  const research = await import("../src/lib/nex/master-ai/research-engine.ts");
  const gateway  = await import("../src/lib/nex/master-ai/research-gateway.ts");
  const reg      = await import("../src/lib/nex/master-ai/connectivity-regulation.ts");
  const domain   = await import("../src/lib/nex/master-ai/connectivity-domain.ts");
  const cost     = await import("../src/lib/nex/master-ai/cost-intelligence.ts");
  const federation = await import("../src/lib/nex/master-ai/source-federation.ts");

  const WIKI_EN = wiki.WIKIPEDIA_SOURCE_SLUG;
  const WIKI_ID = "wikipedia_id_summary";

  // ─── Y-W4-1 · register en.wikipedia ──────────────────────────────
  const r1 = wiki.registerWikipediaLiveSource({
    registered_by: "indolocal_investigation",
    policy_requests_per_day: 500,
  });
  console.log(`  · en.wikipedia: ${r1.already_present ? "already registered" : "registered"}`);

  // ─── Y-W4-2 · register id.wikipedia as a second authorized source ─
  const idExisting = research.getSource(WIKI_ID);
  if (!idExisting) {
    research.registerSource({
      source_slug: WIKI_ID,
      name: "Wikipedia Bahasa Indonesia · REST page summary",
      kind: "PUBLIC_WEB",
      authority_tier: "TIER_3",
      base_url: "https://id.wikipedia.org/api/rest_v1/page/summary/",
      rate_policy: { max_requests_per_minute: 30, respect_retry_after: true },
      respects_robots_txt: true,
      license_note: "CC-BY-SA-3.0 · attribution required",
      authorization_state: "AUTHORIZED",
      registered_by: "indolocal_investigation",
    });
  }
  const idPolicyExists = cost.currentPolicy(WIKI_ID, "REQUEST") !== null;
  if (!idPolicyExists) {
    cost.setPolicy({
      source_slug: WIKI_ID, metric: "REQUEST",
      free_allowance_per_day: 500, paid_allowance_per_day: 0,
      unit_cost_idr: 0, hard_cap: true, warning_threshold_pct: 80,
      set_by: "indolocal_investigation",
    });
  }
  research.registerAdapter(wiki.createWikipediaAdapter({
    source_slug: WIKI_ID,
    base_url: "https://id.wikipedia.org/api/rest_v1/page/summary/",
  }));
  console.log(`  · id.wikipedia: ${idExisting ? "already registered" : "registered"}`);

  // Reset any stale DEGRADED health records left by the pre-fix code path.
  // Rationale: prior run's 404 for a mangled title incorrectly marked the
  // source DEGRADED. Adapter+gateway now return NOT_FOUND for 404 which
  // does NOT degrade source health. Append a HEALTHY reset so selection
  // uses the corrected policy.
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
  console.log(`  · health reset (post-fix baseline)`);

  // ─── Y-W4-5 · investigation corpus ────────────────────────────────
  // Each entry: { question, topic, band_slug, architecture_slug, business_model_slug,
  //               jurisdiction, source_slugs, category_hint, notes }
  const CORPUS = [
    // GLOBAL ARCHITECTURES (no jurisdiction claim · addendum §3)
    { question: "Freifunk",                       topic: "OTHER", jurisdiction: "GLOBAL",
      architecture_slug: "neighbourhood_mesh",    source_slugs: [WIKI_EN],
      category_hint: "UNKNOWN", note: "German community mesh network (research reference only)" },
    { question: "Guifi.net",                      topic: "OTHER", jurisdiction: "GLOBAL",
      architecture_slug: "neighbourhood_mesh",    source_slugs: [WIKI_EN],
      category_hint: "UNKNOWN", note: "Spanish community broadband cooperative (research reference only)" },
    { question: "Wireless mesh network",          topic: "OTHER", jurisdiction: "GLOBAL",
      architecture_slug: "neighbourhood_mesh",    source_slugs: [WIKI_EN],
      category_hint: "UNKNOWN", note: "General mesh architecture" },
    { question: "IEEE 802.11s",                   topic: "OTHER", jurisdiction: "GLOBAL",
      architecture_slug: "neighbourhood_mesh",    source_slugs: [WIKI_EN],
      category_hint: "UNKNOWN", note: "Mesh networking amendment to Wi-Fi standard" },
    { question: "OpenWrt",                        topic: "EQUIPMENT", jurisdiction: "GLOBAL",
      architecture_slug: null,                    source_slugs: [WIKI_EN],
      category_hint: "UNKNOWN", note: "Open-source router firmware ecosystem" },
    { question: "Wireless Internet service provider", topic: "OPERATOR", jurisdiction: "GLOBAL",
      architecture_slug: "hub_and_spoke_ptmp",    source_slugs: [WIKI_EN],
      category_hint: "UNKNOWN", note: "WISP business/architecture model overview" },
    { question: "Community network",              topic: "OTHER", jurisdiction: "GLOBAL",
      architecture_slug: "neighbourhood_mesh",    source_slugs: [WIKI_EN],
      category_hint: "UNKNOWN", note: "Community-owned network concept" },

    // P2P DEVICE TECHNOLOGIES · relevant to the two-phone proof (§5)
    { question: "Wi-Fi Direct",                   topic: "EQUIPMENT", jurisdiction: "GLOBAL",
      architecture_slug: null,                    source_slugs: [WIKI_EN],
      category_hint: "UNKNOWN", note: "Device-to-device Wi-Fi (relevant for two-phone spec)" },
    { question: "Wi-Fi HaLow",                    topic: "SPECTRUM", jurisdiction: "GLOBAL",
      architecture_slug: null,                    source_slugs: [WIKI_EN],
      category_hint: "UNKNOWN", note: "IEEE 802.11ah low-power long-range Wi-Fi" },
    { question: "Ad hoc network",                 topic: "OTHER", jurisdiction: "GLOBAL",
      architecture_slug: null,                    source_slugs: [WIKI_EN],
      category_hint: "UNKNOWN", note: "General ad-hoc networking concept" },

    // INDONESIAN REGULATION (jurisdiction ID · TIER_3 · category likely UNKNOWN or REQUIRES_LICENSE)
    { question: "Telecommunications in Indonesia", topic: "LICENSING", jurisdiction: "ID",
      architecture_slug: null, business_model_slug: "own_isp_licensed",
      source_slugs: [WIKI_EN, WIKI_ID],
      category_hint: "REQUIRES_LICENSE",
      note: "General Indonesian telecoms framework · Wikipedia is TIER_3 · primary regulator source required for definitive status" },
    { question: "Kementerian Komunikasi dan Informatika Republik Indonesia", topic: "LICENSING",
      jurisdiction: "ID", architecture_slug: null,
      source_slugs: [WIKI_ID],
      category_hint: "UNKNOWN",
      note: "Indonesian regulator (Kemenkominfo/Komdigi) · Wikipedia summary · primary policy documents required" },
    { question: "Internet in Indonesia",          topic: "OTHER", jurisdiction: "ID",
      architecture_slug: null,                    source_slugs: [WIKI_EN, WIKI_ID],
      category_hint: "UNKNOWN",
      note: "Landscape of Indonesian internet access · adoption + operators overview" },

    // COMMON WI-FI STANDARDS (relevant to architecture selection · GLOBAL)
    { question: "IEEE 802.11",                    topic: "SPECTRUM", jurisdiction: "GLOBAL",
      architecture_slug: null,                    source_slugs: [WIKI_EN],
      category_hint: "UNKNOWN", note: "Wi-Fi standards family overview" },
    { question: "Wi-Fi 6",                        topic: "SPECTRUM", jurisdiction: "GLOBAL",
      architecture_slug: null,                    source_slugs: [WIKI_EN],
      category_hint: "UNKNOWN", note: "802.11ax standard" },
    { question: "Wi-Fi 6E",                       topic: "SPECTRUM", jurisdiction: "GLOBAL",
      architecture_slug: null, band_slug: "6ghz_unii",
      source_slugs: [WIKI_EN],
      category_hint: "UNKNOWN", note: "6 GHz band extension" },
    { question: "60 GHz",                         topic: "SPECTRUM", jurisdiction: "GLOBAL",
      architecture_slug: "60ghz_backhaul_with_5ghz_access",
      band_slug: "60ghz_mmw", source_slugs: [WIKI_EN],
      category_hint: "UNKNOWN", note: "Millimetre-wave overview" },
  ];

  console.log(`\nEnqueueing ${CORPUS.length} research queries through enforced gateway...\n`);

  let queriesEnqueued = 0;
  let fetchedOk = 0;
  let fetchedBlocked = 0;
  let fetchedFailed = 0;
  const findingsRecorded = [];

  for (const item of CORPUS) {
    const q = research.enqueueResearchQuery({
      question: item.question,
      target_source_slugs: item.source_slugs,
      priority: 6,
      created_by: "indolocal_investigation",
    });
    queriesEnqueued++;

    const outcome = await gateway.performResearch({
      query: q,
      invoker: "indolocal_investigation",
      units_required: 1,
    });

    if (outcome.status === "OK") {
      fetchedOk++;
      const raw = outcome.finding.raw_evidence;
      let extract = raw;
      try {
        const parsed = JSON.parse(raw);
        extract = parsed.extract ?? parsed.description ?? raw;
      } catch { /* keep raw */ }

      // Record a ConnectivityFinding · honest category · TIER_3 Wikipedia
      // For Indonesian jurisdiction: category default is UNKNOWN with uncertainty_note,
      // unless well-documented (REQUIRES_LICENSE for ISP operation).
      const finding = reg.recordConnectivityFinding({
        jurisdiction: item.jurisdiction,
        topic: item.topic,
        band_slug: item.band_slug ?? null,
        architecture_slug: item.architecture_slug ?? null,
        business_model_slug: item.business_model_slug ?? null,
        category: item.category_hint,
        authority_tier: "TIER_3",
        statement: extract.slice(0, 500),
        citation: `${outcome.source_slug}:${item.question}`,
        evidence_ref: outcome.finding.finding_id,
        uncertainty_note: item.category_hint === "UNKNOWN"
          ? `Wikipedia summary · TIER_3 · primary source verification required · ${item.note}`
          : `Wikipedia summary · TIER_3 · primary regulator evidence required to elevate confidence · ${item.note}`,
        supersedes: null,
        created_by: "indolocal_investigation",
      });
      findingsRecorded.push({ q: item.question, id: finding.finding_id, cat: finding.category });
      console.log(`  ✓ ${item.question.padEnd(56)} · ${outcome.source_slug} · cat=${item.category_hint}`);
    } else if (outcome.status === "NOT_FOUND") {
      fetchedFailed++;
      console.log(`  · ${item.question.padEnd(56)} · NOT_FOUND · ${outcome.source_slug}`);
    } else if (outcome.status === "BLOCKED") {
      fetchedBlocked++;
      console.log(`  · ${item.question.padEnd(56)} · BLOCKED · ${outcome.reason ?? ""}`);
    } else if (outcome.status === "OFFLINE_MODE") {
      fetchedBlocked++;
      console.log(`  · ${item.question.padEnd(56)} · OFFLINE_MODE`);
    } else if (outcome.status === "FALLTHROUGH_TO_OFFLINE") {
      fetchedBlocked++;
      console.log(`  · ${item.question.padEnd(56)} · FALLTHROUGH_TO_OFFLINE · ${outcome.reason}`);
    } else if (outcome.status === "ADAPTER_MISSING") {
      fetchedFailed++;
      console.log(`  ! ${item.question.padEnd(56)} · ADAPTER_MISSING · ${outcome.source_slug}`);
    } else {
      fetchedFailed++;
      const reason = "reason" in outcome ? outcome.reason : "?";
      console.log(`  ✗ ${item.question.padEnd(56)} · ${outcome.status} · ${reason}`);
    }

    // Gentle inter-request delay · well below rate limit
    await new Promise((r) => setTimeout(r, 250));
  }

  // ─── Summary ──────────────────────────────────────────────────────
  const summary = reg.categorisationSummary("ID");
  const globalFindings = reg.currentFindings({ jurisdiction: "GLOBAL" });
  const idFindings = reg.currentFindings({ jurisdiction: "ID" });

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`INDOLOCAL Investigation · Hard-stop summary`);
  console.log(`═══════════════════════════════════════════════`);
  console.log(`Queries enqueued              : ${queriesEnqueued}`);
  console.log(`Fetched OK (real evidence)    : ${fetchedOk}`);
  console.log(`Fetched BLOCKED               : ${fetchedBlocked}`);
  console.log(`Fetched FAILED                : ${fetchedFailed}`);
  console.log(`Connectivity findings recorded: ${findingsRecorded.length}`);
  console.log(``);
  console.log(`Indonesian findings by category:`);
  console.log(`  ALLOWED_NOW           : ${summary.ALLOWED_NOW}`);
  console.log(`  REQUIRES_LICENSE      : ${summary.REQUIRES_LICENSE}`);
  console.log(`  REQUIRES_PARTNERSHIP  : ${summary.REQUIRES_PARTNERSHIP}`);
  console.log(`  POSSIBLE_PILOT        : ${summary.POSSIBLE_PILOT}`);
  console.log(`  UNKNOWN               : ${summary.UNKNOWN}`);
  console.log(``);
  console.log(`Global architecture findings  : ${globalFindings.length}`);
  console.log(`Indonesian jurisdiction findings: ${idFindings.length}`);
  console.log(``);
  console.log(`Sources used                  : ${WIKI_EN}, ${WIKI_ID}`);
  console.log(`Authority tier of all findings: TIER_3 (Wikipedia summary)`);
  console.log(``);
  console.log(`REMAINING UNKNOWNS (honest):`);
  console.log(`  · Indonesian class-licence for 2.4/5/5.8 GHz · not verifiable from Wikipedia alone`);
  console.log(`  · Indonesian EIRP limits · primary regulator source required`);
  console.log(`  · Wi-Fi 6E (6 GHz) status in Indonesia · primary regulator source required`);
  console.log(`  · Equipment certification path (POSTEL/SDPPI) · primary regulator source required`);
  console.log(`  · Community-network legal treatment · primary regulator source required`);
  console.log(``);
  console.log(`NO_VALID_CANDIDATE for ALLOWED_NOW without primary evidence.`);
  console.log(`Report complete.`);
}
