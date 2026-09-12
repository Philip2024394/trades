#!/usr/bin/env node
// scripts/nex-work-map-annotate.mjs
//
// Annotates docs/nex-work-map.json with:
//   - build_sequence_number (per-capability suggested build order)
//   - is_currently_building (heartbeat marker · one capability at a time)
//   - impact_score (0-100 · intelligence uplift when this capability moves forward)
//   - impact_boost_to (which other capabilities gain intelligence when this is built)
//   - retro_benefits_available (opportunities to enhance already-built capabilities)
//
// And top-level:
//   - active_build (id of currently-building capability)
//   - next_suggested_build (computed by highest impact_score among AUDITED/DISCOVERED without blockers)
//   - build_sequence_rationale (human-readable explanation)
//
// Deterministic: same input · same output. Run whenever priorities change.
// Founder-authored priority order encoded in BUILD_SEQUENCE below.

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "docs/nex-work-map.json";
const map = JSON.parse(readFileSync(PATH, "utf8"));

// ---------------------------------------------------------------------------
// Founder-authored build priority (Master AI records · does not autonomously
// change). Order = max NEX intelligence uplift at each step.
// ---------------------------------------------------------------------------

const BUILD_SEQUENCE = [
  // Stage 1b completion path (highest priority · unblocks production Truth Engine)
  { id: "CAP-032", seq:  1, active: true,  impact: 95, note: "Evidence Recorder · resolve nex.evidence collision · unblocks Stage 1b apply" },
  { id: "CAP-031", seq:  2, impact: 90, note: "Claim Extractor · consolidate + fix §7.8 J1 double-NEX bug" },
  { id: "CAP-014", seq:  3, impact: 90, note: "Lab-Guardian formal implementation (Stage 1b.3)" },
  { id: "CAP-033", seq:  4, impact: 100, note: "Fact Verification wired to production (Stage 1b.4-1b.6)" },
  { id: "CAP-016", seq:  5, impact: 85, note: "Production determinism proof (Stage 1b.7)" },
  { id: "CAP-015", seq:  6, impact: 100, note: "R-10 Authorisation (Stage 2 · unlocks AUTHORITATIVE)" },
  // Acquisition Fabric backbone (parallel with Stage 1b per D-1b-6)
  { id: "CAP-021", seq:  7, impact: 85, note: "Source Registry · Layer A foundation for every downstream stage" },
  { id: "CAP-028", seq:  8, impact: 95, note: "Entity Resolution · first-class shared per feedback memory" },
  { id: "CAP-030", seq:  9, impact: 90, note: "Location Intelligence · first-class shared" },
  { id: "CAP-034", seq: 10, impact: 90, note: "Knowledge Gap Registry · autonomous acquisition loop" },
  { id: "CAP-022", seq: 11, impact: 75, note: "Discovery Orchestrator · consumes gap registry + source registry" },
  { id: "CAP-023", seq: 12, impact: 70, note: "Crawl + Fetch Queues · unify 26 existing scripts" },
  { id: "CAP-025", seq: 13, impact: 65, note: "Normaliser · shared across Domains" },
  { id: "CAP-026", seq: 14, impact: 60, note: "Deduplicator + Content Hash" },
  { id: "CAP-027", seq: 15, impact: 70, note: "Change Detection · four-case handling per founder lock" },
  // Pending rule policies (each becomes a founder-authored ADR authoring event)
  { id: "CAP-017", seq: 16, impact: 75, note: "R-20 Cross-Substrate Contradiction rule specs (ADR-0314a.2.r)" },
  { id: "CAP-029", seq: 17, impact: 70, note: "Classifier · needs ADR-0314a.2.k Category values first" },
  // Visual Intelligence targeted follow-up (per audit-loop warning)
  { id: "CAP-061", seq: 18, impact: 75, note: "Visual Intelligence · targeted DB/storage migration only · NOT re-audit" },
  // Domain gap-closure
  { id: "CAP-053", seq: 19, impact: 55, note: "Transport promotion executor · 133 rows stranded" },
  { id: "CAP-054", seq: 20, impact: 55, note: "Attractions cleanup · 748 stranded + attraction_kind='other'" },
  { id: "CAP-055", seq: 21, impact: 60, note: "Commerce crawler + product claim pipeline" },
  { id: "CAP-056", seq: 22, impact: 50, note: "Services dedicated crawler (currently routing indirect)" },
  { id: "CAP-057", seq: 23, impact: 45, note: "Travel Domain build" },
  { id: "CAP-058", seq: 24, impact: 50, note: "Business Lab reclassification (cross-Domain classifier tier)" },
  // Router + Bridge completion
  { id: "CAP-046", seq: 25, impact: 60, note: "Missing world adapters (attractions · code · places · travel)" },
  { id: "CAP-043", seq: 26, impact: 60, note: "Bridge relations population (via Entity Resolution)" },
  // Provenance extension
  { id: "CAP-101", seq: 27, impact: 55, note: "Extend per-field provenance to Domains beyond accommodation" },
  // Multimodal completion
  { id: "CAP-062", seq: 28, impact: 55, note: "Voice mandate values (ADR-0317)" },
  { id: "CAP-064", seq: 29, impact: 50, note: "Vision wire into Claim Extractor (extraction_method='vision')" },
  { id: "CAP-063", seq: 30, impact: 45, note: "Chat Lab reclassification as Operational Scope" },
  // English Brain expansion (waits for Entity Resolution + Location + Category)
  { id: "CAP-082", seq: 31, impact: 65, note: "Deterministic Q&A refinements (3 known: wifi-array · list-composer · vertical-switch)" },
  { id: "CAP-081", seq: 32, impact: 70, note: "English corpus expansion beyond Layer-1 · post constitutional layer" },
  { id: "CAP-042", seq: 33, impact: 60, note: "Knowledge Records write-through via R-10 (Stage 2)" },
  { id: "CAP-044", seq: 34, impact: 55, note: "Concept substrate extension (per Domain)" },
  { id: "CAP-045", seq: 35, impact: 50, note: "Supabase §7.8 J1 double-NEX bug fix" },
  // Agents / consolidation
  { id: "CAP-024", seq: 36, impact: 50, note: "Consolidate duplicated crawler machinery (Wikidata × 3 · Image × 3)" },
  { id: "CAP-072", seq: 37, impact: 65, note: "Programmer improvement loop authorisation (NEX1 code-writing)" },
  { id: "CAP-071", seq: 38, impact: 60, note: "Master AI continuous capability additions" },
  { id: "CAP-073", seq: 39, impact: 50, note: "Additional specialist worker activation" },
  // UI polish + consolidation
  { id: "CAP-092", seq: 40, impact: 40, note: "NEX-App shell consolidation (/nex-app + /nexapp duplication)" },
  { id: "CAP-102", seq: 41, impact: 45, note: "Memory system size management (MEMORY.md target ~200 lines)" },
  // Country expansion (deferred · low near-term impact until Fabric is complete)
  { id: "CAP-112", seq: 42, impact: 55, note: "Country expansion pattern activation (UK · USA · etc.)" },
  // Continuous / ongoing
  { id: "CAP-051", seq: 43, impact: 40, note: "Accommodation continuous integration (Rule Book v4 Phase B items)" },
  { id: "CAP-052", seq: 44, impact: 40, note: "Food Domain gap-closure" },
  { id: "CAP-059", seq: 45, impact: 40, note: "Code Domain corpus expansion" },
];

// ---------------------------------------------------------------------------
// Impact boost graph · which capabilities gain intelligence when target is built
// ---------------------------------------------------------------------------

const IMPACT_BOOST = {
  "CAP-032": ["CAP-011", "CAP-013", "CAP-033", "CAP-042", "CAP-041"],
  "CAP-031": ["CAP-033", "CAP-042", "CAP-041", "CAP-063"],
  "CAP-014": ["CAP-033", "CAP-011", "CAP-024"],
  "CAP-033": ["CAP-042", "CAP-041", "CAP-046", "CAP-063", "CAP-082"],
  "CAP-016": ["CAP-011", "CAP-033"],
  "CAP-015": ["CAP-042", "CAP-041", "CAP-046", "CAP-063", "CAP-082", "CAP-081"],
  "CAP-021": ["CAP-022", "CAP-024", "CAP-023", "CAP-027", "CAP-032", "CAP-034", "CAP-112"],
  "CAP-028": ["CAP-063", "CAP-081", "CAP-082", "CAP-041", "CAP-042", "CAP-072", "CAP-026"],
  "CAP-030": ["CAP-041", "CAP-051", "CAP-052", "CAP-053", "CAP-054", "CAP-055", "CAP-056", "CAP-057", "CAP-081", "CAP-082", "CAP-042", "CAP-063", "CAP-112"],
  "CAP-034": ["CAP-024", "CAP-022", "CAP-023", "CAP-027", "CAP-071"],
  "CAP-022": ["CAP-023", "CAP-024", "CAP-034"],
  "CAP-023": ["CAP-024"],
  "CAP-025": ["CAP-026", "CAP-031"],
  "CAP-026": ["CAP-028", "CAP-031"],
  "CAP-027": ["CAP-034", "CAP-024", "CAP-017"],
  "CAP-017": ["CAP-033", "CAP-013", "CAP-041"],
  "CAP-029": ["CAP-033", "CAP-041", "CAP-046", "CAP-051", "CAP-052", "CAP-055"],
  "CAP-061": ["CAP-041", "CAP-051", "CAP-052", "CAP-064", "CAP-071", "CAP-063"],
  "CAP-053": ["CAP-041", "CAP-046"],
  "CAP-054": ["CAP-041", "CAP-046"],
  "CAP-055": ["CAP-041", "CAP-046", "CAP-095"],
  "CAP-056": ["CAP-041", "CAP-046", "CAP-058"],
  "CAP-057": ["CAP-041", "CAP-046"],
  "CAP-058": ["CAP-055", "CAP-056", "CAP-024"],
  "CAP-046": ["CAP-063", "CAP-082", "CAP-042"],
  "CAP-043": ["CAP-028", "CAP-081", "CAP-063"],
  "CAP-101": ["CAP-042", "CAP-013", "CAP-051", "CAP-052", "CAP-055", "CAP-056"],
  "CAP-062": ["CAP-063", "CAP-081", "CAP-071"],
  "CAP-064": ["CAP-061", "CAP-033", "CAP-041"],
  "CAP-063": ["CAP-082", "CAP-081"],
  "CAP-082": ["CAP-081", "CAP-063", "CAP-072"],
  "CAP-081": ["CAP-063", "CAP-082", "CAP-072", "CAP-059"],
  "CAP-042": ["CAP-046", "CAP-063", "CAP-082", "CAP-081"],
  "CAP-044": ["CAP-081", "CAP-082", "CAP-059"],
  "CAP-045": ["CAP-042", "CAP-046"],
  "CAP-024": ["CAP-023", "CAP-027"],
  "CAP-072": ["CAP-071", "CAP-073", "CAP-081", "CAP-082"],
  "CAP-071": ["CAP-072", "CAP-073", "CAP-034"],
  "CAP-073": ["CAP-071", "CAP-041"],
};

// ---------------------------------------------------------------------------
// Retro-benefits · when current active build reveals that going back to add
// a NEW sub-capability on an EARLIER capability would produce compounding
// intelligence gain elsewhere.
//
// Format:
//   target_cap → the EARLIER capability where the sub-capability would live
//   suggested_sub_capability → what to build there
//   intelligence_uplift → what other capability gains
//   priority → high | medium | low
//   surfaced_by → which currently-active/recent build revealed this need
// ---------------------------------------------------------------------------

const RETRO_BENEFITS = [
  {
    target_cap: "CAP-011",
    suggested_sub_capability: "Batch verification path (verify N Claims in one pass · deterministic aggregate)",
    intelligence_uplift: "CAP-033 production adapter (Stage 1b.4) would throughput 10-50× faster once Evidence lands at production scale",
    priority: "medium",
    surfaced_by: "CAP-032",
  },
  {
    target_cap: "CAP-013",
    suggested_sub_capability: "te.evidence_source_unregistered rejection code (when Source Registry lands)",
    intelligence_uplift: "CAP-021 Source Registry gets a first-class Guardian gate · unregistered sources fail-closed at TE-Guardian boundary",
    priority: "medium",
    surfaced_by: "CAP-021",
  },
  {
    target_cap: "CAP-041",
    suggested_sub_capability: "Cross-Domain entity dedup index (once Entity Resolution lands)",
    intelligence_uplift: "CAP-063 chat + CAP-082 Q&A can answer 'the same hotel across Google/Booking' as one canonical entity",
    priority: "high",
    surfaced_by: "CAP-028",
  },
  {
    target_cap: "CAP-041",
    suggested_sub_capability: "gap-flagging column (once Knowledge Gap Registry lands)",
    intelligence_uplift: "CAP-034 gap detection reads specialist substrates without full scan · re-acquisition planner O(gaps) not O(rows)",
    priority: "medium",
    surfaced_by: "CAP-034",
  },
  {
    target_cap: "CAP-042",
    suggested_sub_capability: "Location-scoped index on knowledge_records (once Location Intelligence lands)",
    intelligence_uplift: "CAP-046 Knowledge Router serves 'find X near me' queries 100× faster · geospatial pruning at index level",
    priority: "high",
    surfaced_by: "CAP-030",
  },
  {
    target_cap: "CAP-071",
    suggested_sub_capability: "Language-aware research prompt template (once Language Engine expanded)",
    intelligence_uplift: "CAP-081 gains multilingual research pathways · Master AI research-engine can operate in EN + ID + other locked languages",
    priority: "medium",
    surfaced_by: "CAP-081",
  },
  {
    target_cap: "CAP-101",
    suggested_sub_capability: "Extend per-field provenance to food/service/attractions/commerce (accommodation already has it · 46,114 rows)",
    intelligence_uplift: "CAP-013 TE-Guardian gains provenance-source rejection on 100% of Domains not just accommodation · CAP-042 Router surfaces evidence chains uniformly",
    priority: "high",
    surfaced_by: "CAP-032",
  },
  {
    target_cap: "CAP-091",
    suggested_sub_capability: "Add /nex-head-quarters pages for gap-registry · source-registry · entity-resolution when those Layers activate",
    intelligence_uplift: "Founder gains live visibility into acquisition-fabric health once Layers C/F are implemented",
    priority: "low",
    surfaced_by: "CAP-021",
  },
];

// ---------------------------------------------------------------------------
// Compute next_suggested_build · highest-impact capability that is
// AUDITED / DISCOVERED / IMPLEMENTED and not currently active build
// ---------------------------------------------------------------------------

function computeNextSuggestedBuild(capabilities, activeBuildId) {
  const seqLookup = new Map(BUILD_SEQUENCE.map((s) => [s.id, s]));
  const candidates = capabilities
    .filter((c) => c.id !== activeBuildId)
    .filter((c) => c.status === "AUDITED" || c.status === "DISCOVERED" || c.status === "IMPLEMENTED")
    .map((c) => ({
      id: c.id,
      seq: seqLookup.get(c.id)?.seq ?? 999,
      impact: seqLookup.get(c.id)?.impact ?? 0,
    }));
  candidates.sort((a, b) => a.seq - b.seq); // lowest seq first (highest priority)
  return candidates[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Annotate
// ---------------------------------------------------------------------------

const seqLookup = new Map(BUILD_SEQUENCE.map((s) => [s.id, s]));
let activeBuildId = null;
const capBoosts = new Map(Object.entries(IMPACT_BOOST));

// Group retro benefits by target
const retroByTarget = new Map();
for (const rb of RETRO_BENEFITS) {
  if (!retroByTarget.has(rb.target_cap)) retroByTarget.set(rb.target_cap, []);
  retroByTarget.get(rb.target_cap).push(rb);
}

for (const cap of map.capabilities) {
  const seqEntry = seqLookup.get(cap.id);
  cap.build_sequence_number = seqEntry?.seq ?? null;
  cap.is_currently_building = seqEntry?.active === true;
  cap.impact_score = seqEntry?.impact ?? 0;
  cap.build_sequence_note = seqEntry?.note ?? null;
  cap.impact_boost_to = capBoosts.get(cap.id) ?? [];
  cap.retro_benefits_available = retroByTarget.get(cap.id) ?? [];
  if (cap.is_currently_building) activeBuildId = cap.id;
}

map.active_build = activeBuildId;
map.next_suggested_build = computeNextSuggestedBuild(map.capabilities, activeBuildId);
map.build_sequence_rationale =
  "Priority ordered by (a) unblocking Stage 1b production Truth Engine · (b) foundational Acquisition Fabric shared infrastructure · (c) pending rule policy authoring · (d) Domain gap-closure · (e) English Brain expansion · (f) country expansion. Values are founder-authored priority (Master AI records · does not autonomously reorder).";
map.constitutional_rule_v2 =
  "Master AI + NEX1/NEX2/NEX3 programmer agents MUST consult this map before any audit · architecture · implementation · migration · consolidation · crawler work · or code change. Programmer agents MUST additionally: (1) identify which capabilities a proposed code change touches · (2) evaluate cross-section impact via impact_boost_to graph · (3) verify no sibling capability breaks · (4) surface retro_benefits_available where relevant · (5) preserve Stage 1a foundation invariants. Every capability update must strengthen NEX overall · never weaken · never break siblings. NEX must always remain the most advanced system.";
map.last_updated = new Date().toISOString().slice(0, 10);
map.map_version = "1.1.0";

writeFileSync(PATH, JSON.stringify(map, null, 2) + "\n", "utf8");
console.log("Annotated", PATH);
console.log("  active_build:", map.active_build);
console.log("  next_suggested_build:", map.next_suggested_build);
console.log("  capabilities annotated:", map.capabilities.length);
console.log("  retro_benefits total:", RETRO_BENEFITS.length);
console.log("  impact_boost edges:", Object.keys(IMPACT_BOOST).length);
