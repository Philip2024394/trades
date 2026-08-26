// src/app/nex-head-quarters/discovery/page.tsx
//
// HQ · Discovery Workforce Command View (upgraded 2026-08-24).
//
// Composes real DB state into WorkforceCellData + NOW WORKING + NEXT +
// counters · delegates interactive filter/sort UI to the client child
// component `DiscoveryWorkforceView`. One page · scales to 100+ cities.
//
// Doctrine anchor: project_nex_hq_workforce_command_view_2026_08_24
//   · No new dashboard · every number from DB · SATURATED is temporary
//   · Directory pages are city-registry-driven · workforce mapped here

import { getFoodDbPool } from "@/lib/nex-food/db";
import { buildWorkItemRegistry, buildRotationSnapshot, WALKED_CATEGORIES, type RotationStateKind } from "@/lib/nex-hq/discovery-rotation";
import { buildDiscoveryQueue, MAX_SLOTS, type InFlightCycle, type RecentPick } from "@/lib/nex-hq/auto-orchestrator";
import { resolveWorkforceStatus, type WorkforceStatus } from "@/lib/nex-hq/workforce-status";
import { loadWorkforceMetrics } from "@/lib/nex-hq/workforce-metrics";
import { resolveWorkerConfig } from "@/lib/nex-hq/worker-config-resolver";
import { loadCityCategoryObservability, type CardDiagnosis, type CityCategoryCard } from "@/lib/nex-hq/city-category-observability";
import { CITY_REGISTRY, slugFromCanonical } from "@/lib/nex/city-registry";
import { DiscoveryWorkforceView, type WorkforceCellData } from "./DiscoveryWorkforceView";
import "../../nex-app/nex-app.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RotationRow {
  city: string; category: string; round: number; state: RotationStateKind;
  surface: string;
  last_cycle_started_at: string | Date | null; last_productive_at: string | Date | null;
  consecutive_zero_new_cycles: number; total_records_last_cycle: number | null;
  records_new_last_cycle: number | null; reactivation_reason: string | null;
  next_action_hint: string | null; state_entered_at: string | Date | null; updated_at: string | Date | null;
}

// Map the observability diagnosis enum → human-readable pill label. Same
// vocabulary used on the recently-completed cards AND on the matrix cells so
// the admin sees one consistent word for each state.
function diagnosisLabel(d: CardDiagnosis | undefined | null): string | undefined {
  if (!d) return undefined;
  switch (d) {
    case "productive":                return "Productive";
    case "deduped-zero-persisted":    return "All deduped";
    case "processed-zero-provider":   return "Provider empty";
    case "provider-error":            return "Provider error";
    case "failed":                    return "Cycle failed";
    case "aborted":                   return "Zombie reconciled";
    case "running":                   return "Running now";
    case "never-run":                 return "Never run";
    default:                          return undefined;
  }
}

async function loadData() {
  const pool = getFoodDbPool();
  const workItems = buildWorkItemRegistry();

  const rotationQ = pool.query<RotationRow>(`
    SELECT city, category, round, state, surface,
           last_cycle_started_at, last_productive_at,
           consecutive_zero_new_cycles, total_records_last_cycle,
           records_new_last_cycle, reactivation_reason, next_action_hint,
           state_entered_at, updated_at
      FROM nex.discovery_rotation_state
     ORDER BY city, category
  `);

  const inFlightQ = pool.query<{ id: string; worker_config: string | null; started_at: string | Date }>(`
    SELECT id, worker_config, started_at
      FROM nex.worker_cycle_run
     WHERE status='running' AND started_at > now() - interval '2 hours'
  `);

  const lastCycleQ = pool.query<{ worker_id: string; worker_config: string; status: string; started_at: string | Date }>(`
    SELECT DISTINCT ON (worker_id, worker_config)
           worker_id, worker_config, status, started_at
      FROM nex.worker_cycle_run
     WHERE started_at > now() - interval '7 days'
     ORDER BY worker_id, worker_config, started_at DESC
  `);

  let recentPicks: RecentPick[] = [];
  try {
    const picks = await pool.query<{ city: string; category: string; picked_at: string | Date }>(`
      SELECT city, category, picked_at
        FROM nex.discovery_orchestrator_pick
       WHERE picked_at > now() - interval '60 minutes'
       ORDER BY picked_at ASC LIMIT 30
    `);
    recentPicks = picks.rows.map((r) => ({ city: r.city, category: r.category, pickedAt: new Date(r.picked_at) }));
  } catch { /* table may not exist yet */ }

  // Recently-completed cycles (last 10min) · gives Philip visibility of walker
  // activity even between "in-flight" moments. Filter to acquisition worker_configs
  // ONLY (excludes comms/staircase/brain-* background workers · they were
  // causing "unknown/unknown" rows in the panel).
  const recentlyCompletedQ = pool.query<{ id: string; worker_config: string | null; status: string; started_at: string | Date; finished_at: string | Date | null; records_new: number | null; records_processed: number | null }>(`
    SELECT id, worker_config, status, started_at, finished_at, records_new, records_processed
      FROM nex.worker_cycle_run
     WHERE started_at > now() - interval '10 minutes'
       AND status <> 'running'
       AND (worker_config LIKE 'food:%'
         OR worker_config LIKE 'accommodation:%'
         OR worker_config LIKE 'market:%'
         OR worker_config LIKE 'transport:%')
     ORDER BY started_at DESC
     LIMIT 20
  `);

  // Real workforce metrics · Stage-10 observation phase (2026-08-24).
  const metrics1hQ  = loadWorkforceMetrics(pool, { windowMs: 3600000 });
  const metrics24hQ = loadWorkforceMetrics(pool, { windowMs: 86400000 });

  const [rotation, inFlightRaw, lastCycles, recentlyCompleted, metrics1h, metrics24h, observability] = await Promise.all([
    rotationQ, inFlightQ, lastCycleQ, recentlyCompletedQ, metrics1hQ, metrics24hQ,
    loadCityCategoryObservability(pool),
  ]);
  // Fast-lookup index for enriching matrix cells + recently-completed rows.
  const observabilityByKey = new Map<string, CityCategoryCard>(
    observability.map((o) => [`${o.city}:${o.category}`, o] as const),
  );

  const inFlight: InFlightCycle[] = [];
  for (const row of inFlightRaw.rows) {
    const cfg = String(row.worker_config ?? "");
    for (const wi of workItems) {
      if (!wi.workerConfigLikePrefix) continue;
      const prefix = wi.workerConfigLikePrefix.replace("%", "");
      if (cfg.startsWith(prefix)) {
        inFlight.push({ cycleId: row.id, city: wi.city, category: wi.category, startedAt: new Date(row.started_at) });
        break;
      }
    }
  }

  const stateRows = rotation.rows.map((r) => ({
    city: r.city,
    category: r.category as "accommodation" | "food" | "transport" | "market",
    round: r.round,
    // 2026-08-24 · surface required by RotationStateRow post migration 101.
    // Older rows may still hold 'default' until the tick worker rewrites them.
    surface: r.surface ?? "default",
    state: r.state,
    lastCycleStartedAt: r.last_cycle_started_at ? new Date(r.last_cycle_started_at) : null,
    lastProductiveAt: r.last_productive_at ? new Date(r.last_productive_at) : null,
  }));
  const extras = new Map(rotation.rows.map((r) => [`${r.city}:${r.category}:${r.round}`, {
    consecutiveZero: r.consecutive_zero_new_cycles ?? 0,
    totalLast: r.total_records_last_cycle,
    newLast: r.records_new_last_cycle,
    reactivation: r.reactivation_reason,
    hint: r.next_action_hint,
    stateEnteredAt: r.state_entered_at ? new Date(r.state_entered_at) : null,
    updatedAt: r.updated_at ? new Date(r.updated_at) : null,
  }]));
  const snapshot = buildRotationSnapshot(stateRows, workItems, extras);
  const queue = buildDiscoveryQueue(snapshot, inFlight, recentPicks);
  const inFlightKeys = new Set(inFlight.map((f) => `${f.city}:${f.category}`));

  const lastStatusByKey = new Map<string, "completed" | "failed" | "running">();
  for (const row of lastCycles.rows) {
    const cfg = String(row.worker_config ?? "");
    for (const wi of workItems) {
      if (!wi.workerConfigLikePrefix) continue;
      const prefix = wi.workerConfigLikePrefix.replace("%", "");
      if (cfg.startsWith(prefix)) {
        const key = `${wi.city}:${wi.category}`;
        if (!lastStatusByKey.has(key)) {
          const s = row.status;
          if (s === "completed" || s === "failed" || s === "running") lastStatusByKey.set(key, s);
        }
        break;
      }
    }
  }

  return { snapshot, queue, inFlight, inFlightRaw: inFlightRaw.rows, inFlightKeys, lastStatusByKey, recentlyCompleted: recentlyCompleted.rows, metrics1h, metrics24h, observabilityByKey };
}

export default async function DiscoveryPage() {
  const d = await loadData();

  const cityRegistryByCanonical = new Map(CITY_REGISTRY.map((c) => [c.canonical, c]));
  const snapshotByKey = new Map(d.snapshot.map((s) => [`${s.city}:${s.category}`, s]));
  const queueByKey    = new Map(d.queue.map((q) => [`${q.city}:${q.category}`, q]));

  // Build one cell per (city, category) combo · registry-driven so any city
  // added to city-registry.ts shows up automatically.
  const cells: WorkforceCellData[] = [];
  for (const cityEntry of CITY_REGISTRY) {
    for (const category of WALKED_CATEGORIES) {
      const key = `${cityEntry.canonical}:${category}`;
      const snap = snapshotByKey.get(key);
      const q = queueByKey.get(key);
      const status = resolveWorkforceStatus({
        city: cityEntry.canonical,
        category,
        walkerAvailable: snap?.walkerAvailable ?? false,
        rotationState: snap?.state ?? null,
        lastCycleStatus: d.lastStatusByKey.get(key) ?? null,
        consecutiveZeroNewCycles: snap?.consecutiveZeroNewCycles ?? 0,
        inFlight: d.inFlightKeys.has(key),
        isQueued: q?.status === "would-pick",
        isEligible: q?.status === "eligible",
        isWaitingCooldown: q?.status === "waiting-cooldown",
        isGatedProvider: q?.status === "skipped-gated-provider",
      });
      // City context MUST survive drill-through (Philip 2026-08-24 fix #2).
      // Every subordinate page receives ?city=<slug> so the reusable vertical
      // views know which city the user drilled from. Combo-detail page is the
      // richer target · use it for all four categories.
      const drillHref = `/nex-head-quarters/discovery/${cityEntry.slug}/${category}`;
      const obs = d.observabilityByKey.get(key);
      // 2026-08-24 · Philip · every matrix cell must surface the last cycle's
      // processed/matched/new/saved so the admin doesn't need to click through
      // to see whether the combo has been examined recently. Same mapping as
      // the recently-completed enrichment block below · both go through
      // diagnosisLabel() so the vocabulary stays in one place.
      const cellDiagnosis = diagnosisLabel(obs?.diagnosis);
      cells.push({
        city:                     cityEntry.canonical,
        citySlug:                 cityEntry.slug,
        cityProvince:             cityEntry.province,
        cityRegion:               cityEntry.region,
        category,
        walkerAvailable:          snap?.walkerAvailable ?? false,
        status,
        recordsNewLastCycle:      snap?.recordsNewLastCycle ?? null,
        consecutiveZeroNewCycles: snap?.consecutiveZeroNewCycles ?? 0,
        lastCycleStartedAt:       snap?.lastCycleStartedAt ? snap.lastCycleStartedAt.toISOString() : null,
        reactivationReason:       snap?.reactivationReason ?? null,
        drillHref,
        note:                     snap?.note ?? null,
        directoryTotal:           obs?.totalInDirectory ?? 0,
        processed:                obs?.processed ?? null,
        matched:                  obs?.matched ?? null,
        saved:                    obs?.addedToNex ?? (snap?.recordsNewLastCycle ?? null),
        provider:                 obs?.provider ?? null,
        providerError:            obs?.providerError ?? null,
        diagnosis:                cellDiagnosis,
      });
    }
  }

  // Counters for the header · reflect the FULL universe (not filtered)
  const workforceCounts: Record<WorkforceStatus, number> = {
    working: 0, queued: 0, waiting: 0, idle: 0, saturated: 0, error: 0, unavailable: 0,
  };
  for (const c of cells) workforceCounts[c.status] += 1;

  // NOW WORKING list · straight from in-flight rows · uses shared resolver.
  // Non-acquisition worker_configs → resolved.resolved=false · caller filters
  // them out (never fake unknown/unknown labels).
  const nowWorking = d.inFlightRaw
    .map((row) => {
      const cfg = String(row.worker_config ?? "");
      const resolved = resolveWorkerConfig(cfg);
      return { cfg, resolved, row };
    })
    .filter((x) => x.resolved.resolved)
    .map(({ cfg, resolved, row }) => ({
      city: resolved.resolved ? resolved.city : "Unresolved",
      category: resolved.resolved ? resolved.category : "Unresolved",
      cycleId: String(row.id),
      startedAtIso: new Date(row.started_at).toISOString(),
      workerConfig: cfg,
    }));

  // NEXT · orchestrator's would-pick items (plus eligible items · limit 6)
  const nextQueued = d.queue
    .filter((q) => q.status === "would-pick" || q.status === "eligible")
    .slice(0, 6)
    .map((q) => ({
      city: q.city,
      category: q.category,
      reason: q.reason,
    }));

  // Recently completed · visible activity trail. Every row uses the shared
  // resolver. Unresolved cycles (theoretical after the SQL filter) surface as
  // "Unresolved worker configuration" with the raw config visible for
  // debugging · never as fake "unknown / unknown".
  const recentlyCompleted = d.recentlyCompleted.map((row) => {
    const cfg = String(row.worker_config ?? "");
    const resolved = resolveWorkerConfig(cfg);
    const startedMs = new Date(row.started_at).getTime();
    const finishedMs = row.finished_at ? new Date(row.finished_at).getTime() : startedMs;
    const durationSec = Math.max(0, Math.round((finishedMs - startedMs) / 1000));
    // 2026-08-24 · admin visibility · enrich row with the observability helper's
    // per-(city, category) card. Gives us the diagnosis pill + directory total
    // + provider name + provider-error text without re-querying.
    const enrichKey = resolved.resolved ? `${resolved.city}:${resolved.category}` : "";
    const obs = d.observabilityByKey.get(enrichKey);
    // Diagnosis label mapping · shared with the matrix cell enrichment above
    // via diagnosisLabel() so both surfaces use the exact same wording.
    const diagnosis = diagnosisLabel(obs?.diagnosis);
    return {
      cycleId: String(row.id),
      city:      resolved.resolved ? resolved.city     : "Unresolved worker configuration",
      category:  resolved.resolved ? resolved.category : cfg,
      unresolved: !resolved.resolved,
      status: String(row.status),
      startedAtIso: new Date(row.started_at).toISOString(),
      durationSec,
      recordsNew: row.records_new == null ? null : Number(row.records_new),
      recordsProcessed: row.records_processed == null ? null : Number(row.records_processed),
      matched: obs?.matched ?? null,
      saved: obs?.addedToNex ?? (row.records_new == null ? null : Number(row.records_new)),
      provider: obs?.provider ?? null,
      providerError: obs?.providerError ?? null,
      diagnosis,
      directoryTotal: obs?.totalInDirectory ?? 0,
    };
  });

  // Suppress unused-var lint · cityRegistryByCanonical is retained here for
  // future landmark/hero enrichment · every server component keeps its
  // registry lookup so per-city extensions don't need another rewrite.
  void cityRegistryByCanonical;

  return (
    <div className="nex-app-root" style={{ padding: "24px 32px", background: "var(--nex-cream)", minHeight: "100vh", color: "var(--nex-neutral-900)" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--nex-neutral-500)", fontWeight: 700 }}>
          NEX HQ · DISCOVERY · INDONESIAN WORKFORCE COMMAND VIEW
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "6px 0 4px 0" }}>Indonesian Discovery Workforce</h1>
        <div style={{ fontSize: 12, color: "var(--nex-neutral-500)", lineHeight: 1.55 }}>
          Live command view · click a status chip to filter · click a cell to open its subordinate walker view · <strong style={{ color: "#991b1b" }}>SATURATED means temporarily cooled down, never finished forever</strong> · the Rotation Controller revisits saturated combos in later rounds with new query/provider surface.
        </div>
      </header>

      <DiscoveryWorkforceView
        cells={cells}
        nowWorking={nowWorking}
        nextQueued={nextQueued}
        recentlyCompleted={recentlyCompleted}
        workforceCounts={workforceCounts}
        workforceMax={MAX_SLOTS}
        activeWorkers={d.inFlight.length}
        totalCities={CITY_REGISTRY.length}
        totalCategories={WALKED_CATEGORIES.length}
        metrics1h={d.metrics1h}
        metrics24h={d.metrics24h}
      />

      <footer style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid var(--nex-neutral-200)", fontSize: 10, color: "var(--nex-neutral-500)", lineHeight: 1.6 }}>
        Every count derived from live <code>nex.discovery_rotation_state</code> + <code>nex.worker_cycle_run</code> + <code>nex.discovery_orchestrator_pick</code> · zero fabrication ·
        rows scale automatically as cities are added to <code>src/lib/nex/city-registry.ts</code> · no per-city React pages ever.
      </footer>
    </div>
  );
}
