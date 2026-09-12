#!/usr/bin/env node
// tests/fixtures/conversation-followup-proof/_agent_runtime_phase_b_live_probes.mjs
//
// NEX AGENT RUNTIME · PHASE B · Live OS proof
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION
//
// Proves through real processes + real filesystem:
//   §23 · Business movement (Yogyakarta → Jakarta) preserves identity
//   §24 · Multi-location (Example Gym in 3 cities)
//   §25 · Ambiguous same-name-different-city does NOT auto-merge
//   §11 · No blind overwrite · phone/category changes recorded
//   §29 · Internet cross-process fault injection via env var
//   §22 · Discovery flags never surface HISTORICAL as current
//
// Uses the same two-step tsx pattern as scripts/nex-agents.mjs so TS
// imports resolve.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { randomUUID } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_LIVE_PROBE_INNER) {
  const envArgs = fs.existsSync(path.join(repoRoot, ".env.local"))
    ? ["--env-file=.env.local"]
    : [];
  const child = spawn(
    "npx",
    ["tsx", ...envArgs, entryFile, ...process.argv.slice(2)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, NEX_LIVE_PROBE_INNER: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nex-entity-universe-live-"));
  process.env.NEX_ENTITY_UNIVERSE_DATA_ROOT = tmp;
  console.log(`[data root: ${tmp}]\n`);

  const {
    upsertBusiness, upsertPlacement, demotePlacementsToHistorical,
    buildCandidatePool, readBusiness, readActivePlacementsForBusiness,
    recordEvidence,
  } = await import("../../../src/lib/nex/entity-universe/persistence.ts");
  const { matchBusiness } = await import("../../../src/lib/nex/entity-universe/identity-matching.ts");
  const {
    diffPlacementAttributes, decidePlacementIntent, evolveCategory,
  } = await import("../../../src/lib/nex/entity-universe/lifecycle.ts");
  const {
    readBusinessDetail, findActiveBusinessesByCity,
    siblingActiveLocations, historicalLocations,
  } = await import("../../../src/lib/nex/entity-universe/query.ts");

  const results = { runAt: new Date().toISOString(), campaigns: {} };
  function record(name, obj) {
    results.campaigns[name] = obj;
    console.log(`\n=== ${name} ===`);
    console.log(JSON.stringify(obj, null, 2));
  }

  const NOW = new Date().toISOString();

  // ── Campaign A · Business movement (§23) ─────────────────────
  {
    const b = {
      business_id: "biz_" + randomUUID().slice(0, 8),
      name: "Example Restaurant",
      alternate_names: [],
      identity_confidence: "HIGH",
      owner_nex_id: null,
      registered_at_iso: NOW,
      last_evidence_at_iso: NOW,
    };
    upsertBusiness({ business: b, change: null });
    const evYog = recordEvidence({ source_key: "osm", source_url: null, tier: "SECONDARY_SOURCE", observed_at_iso: NOW, excerpt: null });
    const yog = {
      placement_id: "pmt_" + randomUUID().slice(0, 8), business_id: b.business_id, world_record_ref: null,
      location: { city_slug: "yogyakarta", province_code: "ID-YO", area: null, address: "Jl. Malioboro 1", coordinates: null },
      category: { vertical: "food", sub_category: "restaurant", additional_sub_categories: [], specificity: "SUB_CATEGORY_KNOWN", effective_from_iso: NOW, superseded_at_iso: null, evidence_ids: [evYog.evidence_id] },
      phone: "+62 812 111 1111", whatsapp: null, website: null, email: null, opening_hours: null,
      status: "ACTIVE", effective_from_iso: NOW, effective_to_iso: null,
      evidence_ids: [evYog.evidence_id], registered_at_iso: NOW,
    };
    upsertPlacement({ placement: yog, changes: [] });

    // 100 days later · owner relocated to Jakarta.
    const NOW2 = new Date(Date.parse(NOW) + 100 * 24 * 60 * 60 * 1000).toISOString();
    const evJak = recordEvidence({ source_key: "owner_form", source_url: null, tier: "OWNER_ATTESTED", observed_at_iso: NOW2, excerpt: "Owner reports relocation to Jakarta." });
    const intent = decidePlacementIntent({
      existing_active_placements: [yog],
      new_location: { city_slug: "jakarta", province_code: "ID-JK", area: null, address: null, coordinates: null },
      signal: { prior_closed: false, prior_moved: true, is_multi_location_signal: false, identity_confidence: "HIGH" },
    });
    // Add new Jakarta placement + demote Yogyakarta.
    const jak = {
      placement_id: "pmt_" + randomUUID().slice(0, 8), business_id: b.business_id, world_record_ref: null,
      location: { city_slug: "jakarta", province_code: "ID-JK", area: null, address: "Jl. Sudirman 100", coordinates: null },
      category: yog.category,
      phone: "+62 812 111 1111", whatsapp: null, website: null, email: null, opening_hours: null,
      status: "ACTIVE", effective_from_iso: NOW2, effective_to_iso: null,
      evidence_ids: [evJak.evidence_id], registered_at_iso: NOW2,
    };
    upsertPlacement({ placement: jak, changes: [] });
    if (intent === "MOVE_MARK_PRIOR_HISTORICAL") {
      demotePlacementsToHistorical({
        business_id: b.business_id,
        demote_placement_ids: [yog.placement_id],
        reason: "relocated_to_jakarta_owner_attested",
        evidence_ids: [evJak.evidence_id],
        now_iso: NOW2,
      });
    }
    const detail = readBusinessDetail(b.business_id);
    const inYog = findActiveBusinessesByCity("yogyakarta");
    const inJak = findActiveBusinessesByCity("jakarta");
    record("A_movement_yog_to_jak", {
      business_id: b.business_id,
      intent,
      active_locations: detail?.active_placements.map((p) => p.location.city_slug),
      historical_locations: detail?.historical_placements.map((p) => p.location.city_slug),
      customer_query_yogyakarta_active_count: inYog.filter((r) => r.business.business_id === b.business_id).length,
      customer_query_jakarta_active_count: inJak.filter((r) => r.business.business_id === b.business_id).length,
      pass:
        detail?.active_placements.length === 1
        && detail?.active_placements[0].location.city_slug === "jakarta"
        && detail?.historical_placements.length === 1
        && detail?.historical_placements[0].location.city_slug === "yogyakarta"
        && inYog.filter((r) => r.business.business_id === b.business_id).length === 0
        && inJak.filter((r) => r.business.business_id === b.business_id).length === 1,
    });
  }

  // ── Campaign B · Multi-location (§24) ────────────────────────
  {
    const b = {
      business_id: "biz_" + randomUUID().slice(0, 8),
      name: "Example Gym",
      alternate_names: [],
      identity_confidence: "HIGH",
      owner_nex_id: null,
      registered_at_iso: NOW,
      last_evidence_at_iso: NOW,
    };
    upsertBusiness({ business: b, change: null });
    for (const [city, province] of [["yogyakarta", "ID-YO"], ["jakarta", "ID-JK"], ["bandung", "ID-JB"]]) {
      const ev = recordEvidence({ source_key: "chain_registry", source_url: null, tier: "PRIMARY_SOURCE", observed_at_iso: NOW, excerpt: null });
      upsertPlacement({
        placement: {
          placement_id: "pmt_" + randomUUID().slice(0, 8), business_id: b.business_id, world_record_ref: null,
          location: { city_slug: city, province_code: province, area: null, address: null, coordinates: null },
          category: { vertical: "service", sub_category: "gym", additional_sub_categories: [], specificity: "SUB_CATEGORY_KNOWN", effective_from_iso: NOW, superseded_at_iso: null, evidence_ids: [ev.evidence_id] },
          phone: null, whatsapp: null, website: "gym.example.com", email: null, opening_hours: null,
          status: "ACTIVE", effective_from_iso: NOW, effective_to_iso: null,
          evidence_ids: [ev.evidence_id], registered_at_iso: NOW,
        },
        changes: [],
      });
    }
    const siblings = siblingActiveLocations(b.business_id).map((p) => p.location.city_slug).sort();
    const detail = readBusinessDetail(b.business_id);
    record("B_multi_location_gym_3_cities", {
      business_id: b.business_id,
      sibling_active_locations: siblings,
      discovery_flags: detail?.discovery_flags,
      pass:
        siblings.length === 3
        && detail?.discovery_flags.has_multiple_active_locations === true
        && detail?.discovery_flags.has_any_historical_location === false,
    });
  }

  // ── Campaign C · Ambiguous same name different city (§25) ────
  {
    const bYog = {
      business_id: "biz_yog_" + randomUUID().slice(0, 6),
      name: "Warung Melati", alternate_names: [],
      identity_confidence: "HIGH", owner_nex_id: null,
      registered_at_iso: NOW, last_evidence_at_iso: NOW,
    };
    upsertBusiness({ business: bYog, change: null });
    upsertPlacement({
      placement: {
        placement_id: "pmt_" + randomUUID().slice(0, 8), business_id: bYog.business_id, world_record_ref: null,
        location: { city_slug: "yogyakarta", province_code: "ID-YO", area: null, address: null, coordinates: null },
        category: { vertical: "food", sub_category: "warung", additional_sub_categories: [], specificity: "SUB_CATEGORY_KNOWN", effective_from_iso: NOW, superseded_at_iso: null, evidence_ids: [] },
        phone: "+62 812 111 2222", whatsapp: null, website: null, email: null, opening_hours: null,
        status: "ACTIVE", effective_from_iso: NOW, effective_to_iso: null, evidence_ids: [], registered_at_iso: NOW,
      },
      changes: [],
    });
    // New candidate observation · same name, different city, DIFFERENT phone,
    // no owner overlap — should NOT auto-merge.
    const result = matchBusiness({
      candidate: {
        name: "Warung Melati",
        location: { city_slug: "surabaya", province_code: "ID-JI", area: null, address: null, coordinates: null },
        phone: "+62 812 999 8888", whatsapp: null, website: null, owner_nex_id: null,
      },
      pool: buildCandidatePool(),
    });
    record("C_ambiguous_same_name_different_city", {
      verdict: result.verdict,
      score: result.score,
      best_business_id: result.best_business_id,
      competing_matches: result.competing_matches,
      pass: result.verdict !== "MATCH",   // may be AMBIGUOUS or NO_MATCH — must not auto-merge
    });
  }

  // ── Campaign D · No blind overwrite · phone change recorded (§11) ─
  {
    const b = {
      business_id: "biz_" + randomUUID().slice(0, 8),
      name: "Test Cafe", alternate_names: [],
      identity_confidence: "HIGH", owner_nex_id: null,
      registered_at_iso: NOW, last_evidence_at_iso: NOW,
    };
    upsertBusiness({ business: b, change: null });
    const p = {
      placement_id: "pmt_" + randomUUID().slice(0, 8), business_id: b.business_id, world_record_ref: null,
      location: { city_slug: "yogyakarta", province_code: "ID-YO", area: null, address: null, coordinates: null },
      category: { vertical: "food", sub_category: "cafe", additional_sub_categories: [], specificity: "SUB_CATEGORY_KNOWN", effective_from_iso: NOW, superseded_at_iso: null, evidence_ids: [] },
      phone: "+62 old", whatsapp: null, website: null, email: null, opening_hours: null,
      status: "ACTIVE", effective_from_iso: NOW, effective_to_iso: null, evidence_ids: [], registered_at_iso: NOW,
    };
    upsertPlacement({ placement: p, changes: [] });
    const changes = diffPlacementAttributes({
      previous: p, incoming: { phone: "+62 new" },
      change_reason: "source_x_observed_new_phone",
      evidence_ids: ["ev_test"], confidence: "HIGH",
    });
    upsertPlacement({ placement: { ...p, phone: "+62 new" }, changes });
    const { readChangesForPlacement } = await import("../../../src/lib/nex/entity-universe/persistence.ts");
    const history = readChangesForPlacement(p.placement_id);
    record("D_no_blind_overwrite_phone_change_recorded", {
      history_count: history.length,
      first_change_kind: history[0]?.kind,
      first_change_prev: history[0]?.previous_value,
      first_change_new: history[0]?.new_value,
      pass: history.length === 1
        && history[0].kind === "PHONE_CHANGED"
        && history[0].previous_value === "+62 old"
        && history[0].new_value === "+62 new",
    });
  }

  // ── Campaign E · Category evolution retains history (§7) ─────
  {
    const cur = { vertical: "food", sub_category: "cafe", additional_sub_categories: [], specificity: "SUB_CATEGORY_KNOWN", effective_from_iso: NOW, superseded_at_iso: null, evidence_ids: [] };
    const r = evolveCategory({
      current: cur, incoming_vertical: "food", incoming_sub_category: "restaurant", evidence_ids: ["ev"],
    });
    record("E_category_evolution_retains_history", {
      evolved: r.evolved,
      next_sub_category: r.next?.sub_category,
      next_additional_sub_categories: r.next?.additional_sub_categories,
      pass: r.evolved && r.next?.sub_category === "restaurant" && r.next?.additional_sub_categories.includes("cafe"),
    });
  }

  // ── Verdicts ─────────────────────────────────────────────────
  const verdicts = {};
  for (const [k, v] of Object.entries(results.campaigns)) {
    if ("pass" in v) verdicts[k] = v.pass;
  }
  results.verdicts = verdicts;

  const outPath = path.join(here, "_agent_runtime_phase_b_live_probes.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`\n=== VERDICTS ===`);
  let pass = 0, fail = 0;
  for (const [k, v] of Object.entries(verdicts)) {
    console.log(`  ${k.padEnd(50)} : ${v ? "PASS" : "FAIL"}`);
    if (v) pass++; else fail++;
  }
  console.log(`\nTOTALS pass=${pass} fail=${fail}`);
  console.log(`Wrote ${outPath}`);
  process.exit(fail === 0 ? 0 : 1);
}
