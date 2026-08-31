// scripts/nex-dev-scheduler.mjs · Task #72 Step 5 · 2026-08-22
//
// Local dev scheduler. Makes existing workers execute on a cadence so
// the six-criteria verdict + Reception strip can observe real state
// transitions in dev without waiting for Vercel cron (which only fires
// in production).
//
// Constitutional discipline (Philip 2026-08-22):
//   · MUST NOT alter the six-criteria evaluator
//   · MUST NOT manufacture heartbeats
//   · MUST NOT requeue the 203 triaged records
//   · MUST NOT silently repair old state
//   · The scheduler only INVOKES existing workers. Nothing else.
//
// Opt-in (hard gate):
//   NEX_DEV_WORKERS=1  must be set in the environment · otherwise the
//   scheduler exits with a message. No implicit start.
//
// Usage:
//   NEX_DEV_WORKERS=1 node --env-file=.env.local scripts/nex-dev-scheduler.mjs
//   NEX_DEV_WORKERS=1 npm run dev:workers
//
// Schedule (dev cadence · slow enough for a single-machine dev loop):
//   acquisition:food:Yogyakarta   every 300s (5 min) via run-live-cycle.mjs --apply
//   cle:conversation              every 600s (10 min) via run-cle-cycle.mjs --apply
//   brain:cron-tick               every 180s HTTP GET /api/nex/brain/cron-tick   (Bundle A · A1 tuned 2026-08-22)
//   social:cron-tick              every 60s HTTP GET /api/cron/comms-social-worker (Bundle A · 2026-08-22)
//
// Brain-specific timing (A1 tune, 2026-08-22 · Philip approved):
//   · Brain endpoint declares maxDuration=120s (see cron-tick/route.ts:31)
//   · First cold tick also pays Next dev route-compile (~10-30s)
//   · Scheduler timeoutMs=150s > endpoint budget · never aborts a legitimate
//     in-flight request client-side
//   · Cadence 180s > worst-case duration · guarantees no tick overlap ·
//     no duplicate dispatchNewInboxItems / runOneCycle work in flight
//   · Social stays at 60s (small per-tick budget · fast · overlap harmless)
//
// Two invocation kinds:
//   kind:"spawn" · runs a node script as a child process (Acquisition, CLE)
//   kind:"http"  · fetches an endpoint on the running Next dev server
//                  (Brain, Social — endpoints do the registration + tick internally)
//
// HTTP-tick requirements:
//   · The Next dev server (npm run dev on :3008) MUST be running · otherwise
//     the fetch fails with connection refused (logged, next tick retries).
//   · Auth is enforced end-to-end. Brain uses the shared checkCronAuth
//     (Bearer <CRON_SECRET> or X-Brain-Cron-Token). Social uses
//     x-cron-secret matching CRON_SECRET. Both must be set in .env.local.
//     Dev-scheduler reads them from process.env at tick time · never
//     hardcodes secrets.
//
// Bundle A discipline (Philip 2026-08-22):
//   · Extending this file is Bundle A ONLY.
//   · MUST NOT weaken any provenance/admin gate downstream.
//   · MUST NOT touch legacy stuck state (13 leased social · 107 processing
//     knowledge_inbox from the 2026-08-06→09 worker-death burst). Brain's
//     dispatchNewInboxItems gates on status='waiting' only, so the 107
//     legacy 'processing' rows are safely ignored by the ticker.
//   · Adding a new worker = ONE entry in DEV_SCHEDULE, nothing else.

import { spawn } from "node:child_process";
import { setInterval, clearInterval } from "node:timers";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// ── Opt-in gate (hard) ─────────────────────────────────────────────────
if (process.env.NEX_DEV_WORKERS !== "1") {
  console.error("");
  console.error("╔══════════════════════════════════════════════════════════════════════╗");
  console.error("║  nex-dev-scheduler REFUSING TO START                                 ║");
  console.error("║                                                                      ║");
  console.error("║  Set NEX_DEV_WORKERS=1 to authorise dev worker execution.            ║");
  console.error("║  Example:                                                            ║");
  console.error("║    NEX_DEV_WORKERS=1 npm run dev:workers                             ║");
  console.error("║                                                                      ║");
  console.error("║  This gate is intentional. NEX must not silently start workers in    ║");
  console.error("║  dev — that would produce fresh heartbeats and confuse the six-      ║");
  console.error("║  criteria evaluator into false GREEN when Philip hasn't asked for    ║");
  console.error("║  live execution.                                                     ║");
  console.error("╚══════════════════════════════════════════════════════════════════════╝");
  console.error("");
  process.exit(2);
}

// ── Schedule definition ────────────────────────────────────────────────
// Dev base URL for HTTP-kind ticks. Overridable via NEX_DEV_BASE_URL for
// operators running Next on a non-default port. Default matches package.json.
const DEV_BASE_URL = process.env.NEX_DEV_BASE_URL ?? "http://localhost:3008";

// P0 · 2026-08-24 · Rotation Controller doctrine · fixed-cron acquisition
// entries DELETED. Philip's directive after the 7-hour rotation forensic
// showed 2,206 of 3,296 acquisition cycles (67%) landed on Yogyakarta while
// the orchestrator only PICKED Yogyakarta 32 times · the remaining 2,174
// came from four Yogyakarta-only fixed-cron entries (food/accommodation/
// transport/market) that fired every 15 min regardless of rotation state.
// These same entries produced the 10 post-saturation cycles seen on
// Yogyakarta:food + Yogyakarta:accommodation after they were marked SATURATED.
//
// The orchestrator (`discovery:orchestrator:tick`, 60s cadence, MAX_SLOTS=10)
// respects rotation state, city diversity, saturation exclusion, and the
// Provider Rate Governor · it is now the SOLE spawn authority for acquisition
// work. Removing the fixed-cron entries fixes both concentration and
// saturation-violation in one change.
//
// The deleted entries were:
//   acquisition:food:Yogyakarta          (5-zone rotation, 15-min cadence)
//   acquisition:accommodation:Yogyakarta (5-zone rotation, 15-min cadence)
//   acquisition:transport:Yogyakarta     (6h cadence)
//   acquisition:market:Yogyakarta        (15-min cadence, non-stop chained)
//
// If the orchestrator itself fails, restore these entries from git history
// (this file at commit prior to 2026-08-24) rather than reintroducing
// hardcoded Yogyakarta bypass.

const DEV_SCHEDULE = [
  {
    // Discovery Rotation Controller tick · 2026-08-24 · Philip greenlit central
    // rotation state model. Reads worker_cycle_run history per (city, category)
    // combo · recomputes BUILD/SATURATED/MAINTENANCE/REACTIVATE state · upserts
    // nex.discovery_rotation_state. MVP INFORMATIONAL only · does NOT spawn
    // walker children · existing individual walker cron entries continue firing
    // on their fixed schedules. Auto-spawn overlay is a next-session unit.
    // Doctrine: project_nex_discovery_rotation_controller_2026_08_24.
    kind: "spawn",
    key: "discovery:rotation:tick",
    intervalSec: 600, // 10 min
    // P0 · 2026-08-24 · scheduler offset (Philip greenlit). Rotation ticks
    // sit +30s away from the 60s orchestrator cadence · the two authorities
    // never fire on the same wall-clock second · eliminates the previously-
    // observed 327-370ms race where a saturated state transition landed just
    // before an orchestrator pick could re-read state. Keeps One Geographic
    // Authority intact · no picker/evaluator/saturation/cooldown change.
    startDelaySec: 30,
    command: "node",
    args: [
      "scripts/nex-discovery-rotation/_rotation-tick.mjs",
    ],
    description: "Discovery Rotation Controller · refreshes rotation state per (city, category) from cycle_run history · 10-min cadence · +30s offset from orchestrator cadence",
  },
  {
    // NEX Auto Walker Orchestrator · 2026-08-24 · Philip greenlit central
    // authority for discovery work. Env-gated for safety · default OFF.
    // When NEX_ORCHESTRATOR_ENABLED=true · every 5min this worker reads
    // rotation state · builds a queue · picks the next eligible combo · and
    // spawns the appropriate walker if a slot is free (MAX_SLOTS=1).
    // Doctrine: project_nex_auto_walker_orchestrator_2026_08_24.
    kind: "spawn",
    key: "discovery:orchestrator:tick",
    intervalSec: 60, // 1 min · Stage 10 (2026-08-24) · continuously fills the 10-slot queue
    command: "node",
    args: [
      "scripts/nex-discovery-orchestrator/_orchestrator-tick.mjs",
    ],
    description: "Auto Walker Orchestrator · env-gated (NEX_ORCHESTRATOR_ENABLED=true) · central pick/spawn · 1-min cadence · MAX_SLOTS=10 · fairness cap 2 · governor authoritative on provider rate",
  },
  {
    // P0 · 2026-08-24 · Autonomous zombie cycle reconciler. Marks cycles
    // that have been in status='running' beyond a per-worker-type timeout
    // (acquisition/social:15min · intake/manual/cle:60min · promotion:30min
    // · unknown:30min) as status='failed_zombie', sets finished_at=now(),
    // preserves reason in summary.reconciler_reason. Idempotent. No manual
    // SQL ever · autonomous 24/7 operation requirement.
    kind: "spawn",
    key: "orchestration:zombie-reconciler",
    intervalSec: 180, // 3 min
    command: "node",
    args: [
      "scripts/nex-orchestration/_zombie-reconciler.mjs",
    ],
    description: "Autonomous zombie cycle reconciler · reclaims slots from dead workers · idempotent · runs every 3 minutes",
  },
  {
    // Task #76 Bundle B (2026-08-22) · Conversation Teacher · consumes
    // unprocessed conv_turns · persists candidates with cycle_run_id FK ·
    // never auto-promotes · admin promotion required via /nex-head-quarters/cle-review.
    kind: "spawn",
    key: "cle:conversation",
    intervalSec: 600,
    command: "node",
    args: [
      "scripts/nex-conv/cle/run-cle-cycle.mjs",
      "--config=staircase",
      "--apply",
    ],
    description: "Conversation Learning Engine · EN + ID identical gates · candidates land at pending_review · admin gate required",
  },
  {
    // Bundle A · 2026-08-22 · Task #79 follow-up · Philip approved.
    // Brain manager registers all 6 sub-workers via writeHeartbeat +
    // primeStandbyHeartbeats on every cron-tick. Also runs dispatchNewInboxItems
    // (status='waiting' only · legacy 'processing' rows untouched) and runOneCycle.
    kind: "http",
    key: "brain:cron-tick",
    intervalSec: 180,   // A1 tune 2026-08-22 · > endpoint maxDuration (120s) to prevent tick overlap
    timeoutMs: 150_000, // A1 tune 2026-08-22 · > endpoint maxDuration (120s) so client never aborts a legitimate cycle
    method: "GET",
    url: `${DEV_BASE_URL}/api/nex/brain/cron-tick`,
    // require-cron-token accepts Bearer <CRON_SECRET> in non-prod when the token is set.
    // Lazy header builder · reads env at tick time so rotation doesn't need restart.
    headers: () => ({ Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` }),
    description: "Brain manager tick · registers 6 brain workers · processes waiting inbox items · runs one cycle · legacy processing rows unaffected",
  },
  {
    // Bundle A · 2026-08-22 · Task #79 follow-up · Philip approved.
    // Comms Social worker: leases + two-phase-publishes up to 10 posts per invocation.
    // Legacy 13 leased rows from 2026-08-08 death burst are NOT touched by leaseNextJob
    // (they're not eligible for re-lease · they were previously classified per HQ audit
    // as evidence to preserve until formal cleanup).
    kind: "http",
    key: "social:cron-tick",
    intervalSec: 60,
    method: "GET",
    url: `${DEV_BASE_URL}/api/cron/comms-social-worker`,
    headers: () => ({ "x-cron-secret": process.env.CRON_SECRET ?? "" }),
    description: "Comms Social worker · leases and publishes pending scheduled posts · 2-phase idempotent · legacy leased rows unaffected",
  },
  {
    // Task #88 Phase 1 · 2026-08-22 · Philip approved 30-min cadence (Q4).
    // Reads nex.food_business at claim_status='discovered' · computes quality score
    // with per-criterion breakdown · upserts nex.food_business_promotion (side table ·
    // Philip Q1) · writes audit row on every material change · cycle_run_id FK stamped
    // on every write (Direct-Provenance A · Task #74 pattern).
    // Never advances food_business.claim_status · never sends outreach · never invites
    // owner. Walker remains FROZEN (project_nex_walker_dev_frozen_2026_08_22).
    kind: "spawn",
    key: "promotion:food:Yogyakarta:quality-check",
    intervalSec: 1800, // 30 min · Task #88 Phase 1 Q4
    command: "node",
    args: [
      "scripts/nex-promotion/run-quality-check.mjs",
      "--vertical=food",
      "--city=Yogyakarta",
      "--apply",
    ],
    description: "Promotion Phase 1 quality-check · scores discovered businesses · advances food_business_promotion state · never promotes to listed · never outreaches",
  },
  {
    // Re-Verify Worker Tier · FOOD · Philip 2026-08-27.
    // Runs in PARALLEL with discovery cycles · never touches rotation state ·
    // never counts toward saturation · cap 10 candidates per cycle.
    // Reuses foodYogyakartaConfig's applyEnrichmentToExisting for the
    // COALESCE writeback + og:image extraction (Universal Image Doctrine).
    // Observable separately in HQ via worker_type='re_verify_food'.
    kind: "spawn",
    key: "re-verify:food:tick",
    intervalSec: 900,     // 15 min · polite for own-domain fetches
    startDelaySec: 60,    // let the process warm before first fetch batch
    command: "node",
    args: ["scripts/nex-worker/re-verify-food.mjs"],
    description: "Re-Verify FOOD · enriches KNOWN businesses (never discovers new) · runs during cooldown gaps · cap 10/cycle · own-site fetches only",
  },
  {
    // Re-Verify Worker Tier · ACCOMMODATION · Philip 2026-08-27.
    // Staggered 510s after food (offset = food.startDelay + food.interval/2)
    // so the two re-verify workers never both fetch on the same tick.
    kind: "spawn",
    key: "re-verify:accom:tick",
    intervalSec: 900,
    startDelaySec: 510,
    command: "node",
    args: ["scripts/nex-worker/re-verify-accommodation.mjs"],
    description: "Re-Verify ACCOMMODATION · enriches KNOWN businesses (never discovers new) · runs during cooldown gaps · cap 10/cycle · own-site fetches only",
  },
  {
    // Philip 2026-08-27 (STEP 3) · qualification runs automatically so new
    // service_business rows continuously flow through the commercial funnel
    // (discovered → qualified → contactable → marketing_ready). Idempotent ·
    // pure DB reads/writes · no outreach · marketing-owned states protected
    // by the engine's isQualificationOwned() guard. Every cycle emits a
    // worker_cycle_run row with worker_type='commercial:qualification'.
    kind: "spawn",
    key: "commercial:qualification:tick",
    intervalSec: 300,        // 5 min · picks up new walker persistences quickly
    startDelaySec: 120,      // let discovery + persistence settle before first pass
    command: "node",
    args: ["scripts/nex-commercial/run-qualification.mjs"],
    description: "Commercial qualification engine · deterministic promotion of service_business rows through the qualification band · NO OUTREACH · marketing workforce is separate approval gate.",
  },
  {
    // Philip 2026-08-27 (Phase 2B): auto-activate wider retail categories when
    // Phase 2A has swept Indonesia. Idempotent · pure read + rare JSON patch ·
    // no walker spawn / cooldown effects. Runs every 30 min · cheap.
    kind: "spawn",
    key: "workforce:escalation:tick",
    intervalSec: 1800,
    startDelaySec: 300,
    command: "node",
    args: ["scripts/nex-workforce/run-escalation.mjs"],
    description: "Workforce category escalation · monitors Phase 2A retail sweep · auto-activates Phase 2B categories (16 more shop tags) when all Phase 2A retail categories reach ≥90% saturation across Indonesian cities. Writes to data/nex-job-registry.json (idempotent).",
  },
  // ── NEX Brain · Indonesia Knowledge Walkers (Phase Ka · Philip 2026-08-27) ──
  // Four rotating knowledge walkers · staggered so Wikipedia never sees more
  // than one NEX request per second per project. Each walker cycles through
  // its segment of data/nex-indonesia-knowledge-seed.json. Truth classification
  // is doctrine-enforced: confirmed_fact for geographic/factual, traditional_folk
  // for legends, spiritual_belief for religious/mystical practices.
  {
    kind: "spawn",
    key: "knowledge:provinces-id",
    intervalSec: 7200,          // 2h · 38 provinces
    startDelaySec: 45,
    command: "node",
    args: ["scripts/nex-brain-knowledge/_knowledge-walker.mjs",
           "--job=knowledge-provinces-id", "--segment=provinces",
           "--provider=wikipedia_id", "--max-topics=15"],
    description: "Knowledge walker · Indonesian Wikipedia · 38 provinces · truth_class=confirmed_fact · brain_slug=indonesia · sweeps 15 per cycle.",
  },
  {
    kind: "spawn",
    key: "knowledge:provinces-en",
    intervalSec: 7200,
    startDelaySec: 1845,        // +30 min offset
    command: "node",
    args: ["scripts/nex-brain-knowledge/_knowledge-walker.mjs",
           "--job=knowledge-provinces-en", "--segment=provinces",
           "--provider=wikipedia_en", "--max-topics=15"],
    description: "Knowledge walker · English Wikipedia · 38 provinces · bilingual coverage per doctrine.",
  },
  {
    kind: "spawn",
    key: "knowledge:destinations-id",
    intervalSec: 7200,
    startDelaySec: 3645,        // +60 min offset
    command: "node",
    args: ["scripts/nex-brain-knowledge/_knowledge-walker.mjs",
           "--job=knowledge-destinations-id", "--segment=destinations",
           "--provider=wikipedia_id", "--max-topics=15"],
    description: "Knowledge walker · Indonesian Wikipedia · tourism destinations (Borobudur/Bali/Komodo/Toba/...) · truth_class=confirmed_fact.",
  },
  {
    kind: "spawn",
    key: "knowledge:destinations-en",
    intervalSec: 7200,
    startDelaySec: 5445,
    command: "node",
    args: ["scripts/nex-brain-knowledge/_knowledge-walker.mjs",
           "--job=knowledge-destinations-en", "--segment=destinations",
           "--provider=wikipedia_en", "--max-topics=15"],
    description: "Knowledge walker · English Wikipedia · destinations · bilingual.",
  },
  {
    kind: "spawn",
    key: "knowledge:folklore-id",
    intervalSec: 7200,
    startDelaySec: 900,
    command: "node",
    args: ["scripts/nex-brain-knowledge/_knowledge-walker.mjs",
           "--job=knowledge-folklore-id", "--segment=folklore",
           "--provider=wikipedia_id", "--max-topics=10"],
    description: "Knowledge walker · Indonesian folk legends (Nyi Roro Kidul/Sangkuriang/Malin Kundang/Timun Mas/...) · truth_class=traditional_folk · NEX presents as 'traditional folk information · not confirmed'.",
  },
  {
    kind: "spawn",
    key: "knowledge:folklore-en",
    intervalSec: 7200,
    startDelaySec: 2745,
    command: "node",
    args: ["scripts/nex-brain-knowledge/_knowledge-walker.mjs",
           "--job=knowledge-folklore-en", "--segment=folklore",
           "--provider=wikipedia_en", "--max-topics=10"],
    description: "Knowledge walker · English folk legends · bilingual folklore coverage.",
  },
  {
    kind: "spawn",
    key: "knowledge:spiritual-id",
    intervalSec: 7200,
    startDelaySec: 4545,
    command: "node",
    args: ["scripts/nex-brain-knowledge/_knowledge-walker.mjs",
           "--job=knowledge-spiritual-id", "--segment=spiritual",
           "--provider=wikipedia_id", "--max-topics=10"],
    description: "Knowledge walker · Indonesian spiritual practices (Balinese Hinduism/Kejawen/Sunda Wiwitan/Parmalim/Kaharingan/Ngaben/Nyepi/...) · truth_class=spiritual_belief · presented respectfully per tradition · never dismissed as false.",
  },
  {
    kind: "spawn",
    key: "knowledge:spiritual-en",
    intervalSec: 7200,
    startDelaySec: 6345,
    command: "node",
    args: ["scripts/nex-brain-knowledge/_knowledge-walker.mjs",
           "--job=knowledge-spiritual-en", "--segment=spiritual",
           "--provider=wikipedia_en", "--max-topics=10"],
    description: "Knowledge walker · English spiritual practices · bilingual.",
  },
  // ─── Knowledge walker expansion · Philip 2026-08-28 · Task #45 ───────────
  // Adds cuisine · history · culture · language segments to reach 15 total
  // knowledge walker jobs (8 existing + 7 new). Segments seeded in
  // data/nex-indonesia-knowledge-seed.json.
  {
    kind: "spawn",
    key: "knowledge:cuisine-id",
    intervalSec: 7200,
    startDelaySec: 8145,
    command: "node",
    args: ["scripts/nex-brain-knowledge/_knowledge-walker.mjs",
           "--job=knowledge-cuisine-id", "--segment=cuisine",
           "--provider=wikipedia_id", "--max-topics=15"],
    description: "Knowledge walker · Indonesian Wikipedia · Indonesian cuisine (rendang · nasi padang · sate · rawon · papeda · ...) · truth_class=confirmed_fact.",
  },
  {
    kind: "spawn",
    key: "knowledge:cuisine-en",
    intervalSec: 7200,
    startDelaySec: 9945,
    command: "node",
    args: ["scripts/nex-brain-knowledge/_knowledge-walker.mjs",
           "--job=knowledge-cuisine-en", "--segment=cuisine",
           "--provider=wikipedia_en", "--max-topics=15"],
    description: "Knowledge walker · English Wikipedia · Indonesian cuisine · bilingual.",
  },
  {
    kind: "spawn",
    key: "knowledge:history-id",
    intervalSec: 7200,
    startDelaySec: 11745,
    command: "node",
    args: ["scripts/nex-brain-knowledge/_knowledge-walker.mjs",
           "--job=knowledge-history-id", "--segment=history",
           "--provider=wikipedia_id", "--max-topics=10"],
    description: "Knowledge walker · Indonesian Wikipedia · history (Sriwijaya/Majapahit/Mataram/Sukarno/Reformasi/...) · truth_class=confirmed_fact.",
  },
  {
    kind: "spawn",
    key: "knowledge:history-en",
    intervalSec: 7200,
    startDelaySec: 13545,
    command: "node",
    args: ["scripts/nex-brain-knowledge/_knowledge-walker.mjs",
           "--job=knowledge-history-en", "--segment=history",
           "--provider=wikipedia_en", "--max-topics=10"],
    description: "Knowledge walker · English Wikipedia · Indonesian history · bilingual.",
  },
  {
    kind: "spawn",
    key: "knowledge:culture-id",
    intervalSec: 7200,
    startDelaySec: 15345,
    command: "node",
    args: ["scripts/nex-brain-knowledge/_knowledge-walker.mjs",
           "--job=knowledge-culture-id", "--segment=culture",
           "--provider=wikipedia_id", "--max-topics=10"],
    description: "Knowledge walker · Indonesian Wikipedia · culture (batik/wayang/gamelan/kecak/angklung/keris/tari/tenun/songket) · truth_class=confirmed_fact.",
  },
  {
    kind: "spawn",
    key: "knowledge:culture-en",
    intervalSec: 7200,
    startDelaySec: 17145,
    command: "node",
    args: ["scripts/nex-brain-knowledge/_knowledge-walker.mjs",
           "--job=knowledge-culture-en", "--segment=culture",
           "--provider=wikipedia_en", "--max-topics=10"],
    description: "Knowledge walker · English Wikipedia · Indonesian culture · bilingual.",
  },
  {
    kind: "spawn",
    key: "knowledge:language-id",
    intervalSec: 7200,
    startDelaySec: 18945,
    command: "node",
    args: ["scripts/nex-brain-knowledge/_knowledge-walker.mjs",
           "--job=knowledge-language-id", "--segment=language",
           "--provider=wikipedia_id", "--max-topics=8"],
    description: "Knowledge walker · Indonesian Wikipedia · languages (Bahasa Indonesia/Jawa/Sunda/Bali/Batak/Minangkabau/Bugis/Sasak) · truth_class=confirmed_fact · foundation for future translation work.",
  },
  // Reserved slots · Phase Kb + Kc (awaiting Wikidata SPARQL + Wikivoyage integration)
  // knowledge:wikidata-facts     — Phase Kb · structured facts via SPARQL
  // knowledge:wikivoyage-guides  — Phase Kc · travel guide format
  {
    // Philip 2026-08-27 · "every hour report from walker findings · set by
    // computer clock". Wall-clock aligned · first tick delayed so subsequent
    // fires land at top of each hour. Read-only aggregate report appended
    // to data/nex-run-logs/hourly-walker-report.jsonl.
    kind: "spawn",
    key: "walker:hourly-report",
    intervalSec: 3600,
    startDelaySec: (() => {
      const now = new Date();
      const nextHour = new Date(now); nextHour.setUTCMinutes(0, 0, 0);
      nextHour.setUTCHours(nextHour.getUTCHours() + 1);
      return Math.max(60, Math.floor((nextHour.getTime() - now.getTime()) / 1000));
    })(),
    command: "node",
    args: ["scripts/nex-worker/hourly-walker-report.mjs"],
    description: "Hourly walker findings report · wall-clock aligned (first tick at next :00) · appends JSON line to data/nex-run-logs/hourly-walker-report.jsonl · covers row deltas, cycle outcomes, merge log, missing-image backlog, category coverage.",
  },
  {
    // Philip 2026-08-30 · geographic coverage diagnostic · answers "are
    // walkers moving across all cities in Indonesia?" definitively. Reads
    // nex.worker_cycle_run for last 24h, diffs against 518-city catalogue,
    // exits 0 (HEALTHY) or 1 (ANOMALY). Runs every 6h for a low-noise
    // regression signal, staggered off the hourly-report top-of-hour so
    // both never overlap.
    kind: "spawn",
    key: "walker:coverage-check",
    intervalSec: 21600, // 6 hours
    startDelaySec: 900, // 15 minutes after scheduler boot · then every 6h
    command: "node",
    args: ["scripts/nex-worker/coverage-check.mjs", "--json"],
    description: "Geographic coverage check · reads worker_cycle_run last 24h · diffs against data/nex-city-catalogue.json (518 cities · 42 provinces) · reports active/silent cities + top-city concentration + mp_seller unknown-city rate · exit 0 healthy / 1 anomaly.",
  },
  // Ollama Did You Know walker · Philip 2026-08-28. Distils DYK-format facts
  // from existing Wikipedia articles in knowledge_inbox via local Ollama.
  // Runs every 2h · 5 articles per cycle (~40s per fact given cold-start).
  // Every generated row cites its Wikipedia source_url + CC BY-SA licence.
  {
    kind: "spawn",
    key: "ollama:discover-did-you-know",
    intervalSec: 7200,
    startDelaySec: 5460,
    command: "node",
    args: ["scripts/nex-ollama/discover-did-you-know.mjs", "--limit=5"],
    description: "Ollama DYK walker · distils Did You Know facts from Wikipedia knowledge_inbox via local Ollama · every row cites source_url + Wikipedia CC BY-SA · zero API cost.",
  },
  // Wikivoyage walker · Philip 2026-08-28. Travel-oriented content
  // (transport, best time, cultural etiquette) for tourist destinations.
  // CC BY-SA 4.0 · Wikivoyage REST v1 summary endpoint.
  {
    kind: "spawn",
    key: "knowledge:destinations-wikivoyage",
    intervalSec: 7200,
    startDelaySec: 5645,
    command: "node",
    args: ["scripts/nex-brain-knowledge/_knowledge-walker.mjs",
           "--job=knowledge-destinations-wikivoyage", "--segment=destinations",
           "--provider=wikivoyage", "--max-topics=8"],
    description: "Wikivoyage walker · destinations travel guides · CC BY-SA 4.0 · tourist practicalities that Wikipedia doesn't cover.",
  },
  // Ollama bilingual translator · Philip 2026-08-28. Fills title_id + body_id
  // on existing DYK rows so Indonesian users can read facts in their own
  // language. Uses same Ollama Free Infrastructure pipeline · no API cost.
  {
    kind: "spawn",
    key: "ollama:translate-did-you-know-id",
    intervalSec: 7200,
    startDelaySec: 5830,
    command: "node",
    args: ["scripts/nex-ollama/translate-did-you-know.mjs", "--limit=8"],
    description: "Ollama bilingual · translates DYK EN → ID · adds title_id + body_id to nex.brain_did_you_know_indonesia · reuses proven Ollama translation pipeline.",
  },
  // Directory image walker · Philip 2026-08-28. Assigns CC-licensed
  // Wikimedia Commons category-matched images to directory cards that have
  // no owner-uploaded image. Tick picks the (table, category, city) tuple
  // with the most missing images that hasn't cycled in the last 120 min.
  // Owner uploads (hero_image_approved=true) are ALWAYS respected.
  // Doctrine: project_nex_cc_category_placeholder_imagery_2026_08_28.md
  {
    kind: "spawn",
    key: "images:directory-rotation",
    intervalSec: 900,                // 15 min · one (cat, city) per tick
    startDelaySec: 300,
    command: "node",
    args: ["scripts/nex-workforce/_image-rotation-tick.mjs"],
    description: "Directory image rotation tick · picks least-recently-imaged (table, category, city) tuple with unimaged rows · spawns enrich-directory-images.mjs for it · Wikimedia Commons only · owner upload always overrides.",
  },
];

const startedAt = new Date().toISOString();
// Task #86 (2026-08-22) · persistent session file · read by /nex-head-quarters/walker
// to distinguish "processed since this scheduler session started" from lifetime totals.
// File location matches walker-geo-cursor.json for consistency.
try {
  const sessionFile = "data/nex-scheduler/walker-session.json";
  mkdirSync(dirname(sessionFile), { recursive: true });
  writeFileSync(
    sessionFile,
    JSON.stringify({ sessionStartedAt: startedAt, pid: process.pid }, null, 2),
    "utf8",
  );
} catch (err) {
  console.warn(`[session] session file write failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
}
console.log("");
console.log(`nex-dev-scheduler · started ${startedAt}`);
console.log(`opt-in gate: NEX_DEV_WORKERS=1 (verified)`);
console.log(`scheduled workers:`);
for (const w of DEV_SCHEDULE) {
  if (w.kind === "http") {
    console.log(`  · ${w.key}  every ${w.intervalSec}s  →  HTTP ${w.method ?? "GET"} ${w.url}`);
  } else {
    console.log(`  · ${w.key}  every ${w.intervalSec}s  →  spawn ${w.command} ${w.args.join(" ")}`);
  }
}
console.log(`ctrl+c to stop · runs foreground · logs every tick + outcome`);
console.log("");

// ── Runner dispatcher ──────────────────────────────────────────────────
function runOne(worker) {
  if (worker.kind === "http") return runHttp(worker);
  return runSpawn(worker);
}

// ── Geographic rotation cursor (Task #84 · 2026-08-22) ────────────────
// Persistent file-based cursor · one integer per rotating worker · survives
// Victus power-off cycles. File format:
//   { "cursor": <int>, "lastZone": <string|null>, "lastAdvancedAt": <ISO|null> }
// Cursor advances BEFORE spawn so a bad zone doesn't loop · next tick moves on.
// Read is defensive (missing file / malformed JSON both default to cursor=0).
function loadCursor(cursorFile) {
  try {
    if (!existsSync(cursorFile)) return 0;
    const raw = readFileSync(cursorFile, "utf8");
    const parsed = JSON.parse(raw);
    const c = Number(parsed?.cursor);
    return Number.isFinite(c) && c >= 0 ? Math.floor(c) : 0;
  } catch {
    return 0;
  }
}

function saveCursor(cursorFile, cursor, zone) {
  try {
    mkdirSync(dirname(cursorFile), { recursive: true });
    writeFileSync(
      cursorFile,
      JSON.stringify({ cursor, lastZone: zone, lastAdvancedAt: new Date().toISOString() }, null, 2),
      "utf8",
    );
  } catch (err) {
    console.warn(`[rotation] cursor save failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Select the next zone from the rotation · advance the cursor · return the
// resolved args array (worker.args with --bbox=<zone> appended).
function selectRotationArgs(worker) {
  if (!worker.bboxRotation || !Array.isArray(worker.bboxRotation.zones) || worker.bboxRotation.zones.length === 0) {
    return worker.args;
  }
  const { zones, cursorFile } = worker.bboxRotation;
  const currentCursor = loadCursor(cursorFile);
  const idx = currentCursor % zones.length;
  const zone = zones[idx];
  saveCursor(cursorFile, currentCursor + 1, zone);
  return [...worker.args, `--bbox=${zone}`];
}

// ── Runner · spawn (child process) ─────────────────────────────────────
// Returns a Promise that resolves when the child exits (success OR error).
// Never rejects · scheduler stays alive on child failure. Callers may await
// (chained-mode acquisition loop) or ignore (setInterval one-shot spawns).
function runSpawn(worker) {
  return new Promise((resolve) => {
    const tickIso = new Date().toISOString();
    const resolvedArgs = selectRotationArgs(worker);
    const rotationTag = worker.bboxRotation ? ` · zone=${resolvedArgs[resolvedArgs.length - 1].replace("--bbox=", "")}` : "";
    console.log(`[${tickIso}] tick · ${worker.key}${rotationTag} · spawning`);
    const child = spawn(worker.command, resolvedArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const chunks = [];
    child.stdout.on("data", (c) => chunks.push(c));
    child.stderr.on("data", (c) => chunks.push(c));
    child.on("close", (code, signal) => {
      const endIso = new Date().toISOString();
      const outcome = code === 0 ? "OK" : "FAIL";
      console.log(`[${endIso}] tick · ${worker.key} · exit=${code ?? "?"} signal=${signal ?? "-"} · ${outcome}`);
      if (code !== 0) {
        const tail = Buffer.concat(chunks).toString("utf8").split(/\r?\n/).filter(Boolean).slice(-20).join("\n");
        console.log(`  --- last 20 lines of output ---`);
        console.log(tail.split("\n").map((l) => `  ${l}`).join("\n"));
        console.log(`  --------------------------------`);
      }
      resolve();
    });
    child.on("error", (err) => {
      console.log(`[${new Date().toISOString()}] tick · ${worker.key} · spawn error: ${err.message}`);
      resolve();
    });
  });
}

// ── Non-stop chained loop for acquisition walkers ─────────────────────
//
// Doctrine anchor: project_nex_walkers_nonstop_while_laptop_and_internet_active_2026_08_23
//   Philip 2026-08-23: "when laptop and internet active walkers must be
//   processing none stop." Cycle N+1 starts when cycle N finishes · no
//   fixed 15-min gap. Only acquisition:* workers use this loop · CLE,
//   Brain, Social, Promotion retain their own cadences per doctrine.
//
// Polite floor: NEX_WALKER_CHAIN_DELAY_MS (default 3000 ms · 3 s) between
// consecutive cycles. Prevents hammering OSM/Overpass with zero gap ·
// tunable via env if the acquisition source changes. Applies to the
// between-cycle wait · never the internal within-cycle OSM pacing.
const CHAIN_DELAY_MS = Number(process.env.NEX_WALKER_CHAIN_DELAY_MS ?? 3000);

async function runSpawnChainedForever(worker) {
  console.log(`[${new Date().toISOString()}] chained · ${worker.key} · non-stop mode enabled · polite floor ${CHAIN_DELAY_MS}ms`);
  // Loop lives for the lifetime of the scheduler process · exit is via
  // SIGINT/SIGTERM which propagates to the current child.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await runSpawn(worker);
    if (CHAIN_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, CHAIN_DELAY_MS));
    }
  }
}

// ── Runner · http (fetch endpoint on running Next dev server) ──────────
// Bundle A (2026-08-22): Brain + Social are cron-triggered in prod via
// Vercel Cron. In dev we replicate that contract by fetching the same
// endpoint on our local Next server. Auth headers are built lazily from
// process.env at tick time · never hardcoded.
async function runHttp(worker) {
  const tickIso = new Date().toISOString();
  console.log(`[${tickIso}] tick · ${worker.key} · fetching ${worker.method ?? "GET"} ${worker.url}`);
  const headers = typeof worker.headers === "function" ? worker.headers() : (worker.headers ?? {});
  const controller = new AbortController();
  const timeoutMs = worker.timeoutMs ?? 60_000;
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(worker.url, {
      method: worker.method ?? "GET",
      headers,
      signal: controller.signal,
    });
    clearTimeout(to);
    const bodyText = await resp.text().catch(() => "");
    const endIso = new Date().toISOString();
    const outcome = resp.ok ? "OK" : "FAIL";
    console.log(`[${endIso}] tick · ${worker.key} · status=${resp.status} · ${outcome}`);
    if (!resp.ok) {
      const preview = bodyText.slice(0, 400).replace(/\s+/g, " ");
      console.log(`  --- response body (first 400 chars) ---`);
      console.log(`  ${preview}`);
      console.log(`  ----------------------------------------`);
    }
  } catch (err) {
    clearTimeout(to);
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[${new Date().toISOString()}] tick · ${worker.key} · fetch error · ${msg}`);
  }
}

// ── Loop · acquisition = chained non-stop · everything else = interval ─
//
// Acquisition walkers (food · accommodation · any future acquisition:*) run
// in a chained non-stop loop per the 2026-08-23 doctrine
// (project_nex_walkers_nonstop_while_laptop_and_internet_active).
//
// Everything else (CLE, Brain cron-tick, Social cron-tick, Promotion
// quality-check) retains its interval cadence — those cadences exist for
// separate reasons (Vercel Cron parity · admin adjudication rhythm · CLE
// batching) and are explicitly out of scope for the non-stop rule.
const timers = [];
for (const w of DEV_SCHEDULE) {
  if (w.kind === "spawn" && w.key.startsWith("acquisition:")) {
    runSpawnChainedForever(w).catch((err) => {
      console.error(`[${new Date().toISOString()}] chained loop crashed for ${w.key}: ${err?.stack ?? err}`);
    });
  } else if (w.startDelaySec && w.startDelaySec > 0) {
    // P0 · 2026-08-24 · offset support · Philip's scheduler-offset directive.
    // startDelaySec pushes the FIRST tick out by N seconds so tick cadences
    // don't align on the same boundary. The rotation controller uses this
    // to sit +30s away from the 60s orchestrator ticks, eliminating the
    // sub-second race where a rotation state change and an orchestrator
    // pick could commit within the same wall-clock second.
    console.log(`[${new Date().toISOString()}] ${w.key} · deferred first tick by ${w.startDelaySec}s (offset from orchestrator cadence)`);
    setTimeout(() => {
      runOne(w);
      const t = setInterval(() => runOne(w), w.intervalSec * 1000);
      timers.push(t);
    }, w.startDelaySec * 1000);
  } else {
    // First tick immediately (so operators see something in the log)
    runOne(w);
    const t = setInterval(() => runOne(w), w.intervalSec * 1000);
    timers.push(t);
  }
}

// ── Graceful shutdown ──────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n[${new Date().toISOString()}] nex-dev-scheduler · ${signal} received · clearing ${timers.length} timer(s) · exit`);
  for (const t of timers) clearInterval(t);
  process.exit(0);
}
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
