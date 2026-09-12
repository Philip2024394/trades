// NEX Headquarters layout — server component that fetches sidebar notification
// counts (e.g. Collector pending-claim badge) and Walker live statuses, then
// passes them into the HQShell.
//
// The Walker statuses feed the per-vertical green-light dots in the sidebar
// (Philip 2026-08-23: "green light beside the category the walkers are working
// and when click can see the data page"). Each dot is a read of the real
// nex.worker_heartbeat row for that vertical's worker_id · never faked.
//
// The counts come from the SAME Supabase directory_seeds table the Collector
// Dashboard reads · no new endpoint, no new table, no duplicate workflow.

import Link from "next/link";
import { HQShell, type HQNotificationCounts } from "@/components/nex-head-quarters/HQShell";
import { HQAutoRefresh } from "@/components/nex-head-quarters/HQAutoRefresh";
import { supabaseNexAdmin } from "@/lib/supabaseNexAdmin";
import { getFoodDbPool } from "@/lib/nex-food/db";
import { WALKER_VERTICALS, resolveWalkerTier, type WalkerSidebarStatus } from "@/lib/nex-hq/walker-verticals";
import { buildWorkItemRegistry, buildRotationSnapshot, WALKED_CATEGORIES, type RotationStateKind } from "@/lib/nex-hq/discovery-rotation";
import { buildDiscoveryQueue, type InFlightCycle, type RecentPick } from "@/lib/nex-hq/auto-orchestrator";
import { resolveWorkforceStatus, type WorkforceStatus } from "@/lib/nex-hq/workforce-status";
import { buildCityWorkforceDetails, type CityWorkforceDetail } from "@/lib/nex-hq/city-workforce-status";
import { CITY_REGISTRY } from "@/lib/nex/city-registry";
import "../nex-app/nex-app.css";

export const dynamic = "force-dynamic";

async function loadNotificationCounts(): Promise<HQNotificationCounts> {
  try {
    // Pending claim requests (lifecycle_status in claim_requested / claim_pending)
    const res = await supabaseNexAdmin
      .from("directory_seeds")
      .select("id", { count: "exact", head: true })
      .in("lifecycle_status", ["claim_requested", "claim_pending"]);
    return { collector_claims: res.count ?? 0 };
  } catch {
    return {};
  }
}

async function loadWalkerStatuses(): Promise<Record<string, WalkerSidebarStatus>> {
  // One round-trip · SELECT the latest heartbeat row per registered Walker.
  // The registry is small (2 rows today · handful in a year) so an ANY() lookup
  // is fine · a missing row still renders (tier=stopped, age=null) so the
  // sidebar tells the truth when Walker has never heartbeated.
  const workerIds = WALKER_VERTICALS.map((v) => v.workerId);
  const out: Record<string, WalkerSidebarStatus> = {};
  // Seed with stopped defaults so the sidebar renders honestly even if the
  // heartbeat query fails or returns fewer rows than registered Walkers.
  for (const v of WALKER_VERTICALS) {
    out[v.workerId] = { workerId: v.workerId, ageSeconds: null, lastHeartbeatAt: null, tier: "stopped" };
  }
  try {
    const pool = getFoodDbPool();
    const res = await pool.query<{
      worker_id: string;
      last_heartbeat_at: Date | string;
      age_seconds: number | null;
    }>(
      `SELECT worker_id, last_heartbeat_at,
              EXTRACT(EPOCH FROM (now() - last_heartbeat_at))::int AS age_seconds
         FROM nex.worker_heartbeat
        WHERE worker_id = ANY($1::text[])`,
      [workerIds],
    );
    for (const row of res.rows) {
      const age = row.age_seconds;
      const iso = typeof row.last_heartbeat_at === "string"
        ? row.last_heartbeat_at
        : row.last_heartbeat_at.toISOString();
      out[row.worker_id] = {
        workerId: row.worker_id,
        ageSeconds: age,
        lastHeartbeatAt: iso,
        tier: resolveWalkerTier(age),
      };
    }
  } catch {
    // Fall back to the seeded stopped defaults · never fabricate a green dot
    // just because we couldn't reach Postgres.
  }
  return out;
}

// Per-city workforce aggregate for the Indonesia sidebar tree (2026-08-24).
// Reads rotation state + in-flight cycles + orchestrator queue + last-cycle
// status · same inputs as /nex-head-quarters/discovery · never fake.
async function loadCityWorkforceDetails(): Promise<CityWorkforceDetail[]> {
  const workItems = buildWorkItemRegistry();
  try {
    const pool = getFoodDbPool();
    const [rotation, inFlightRaw, lastCycles, picksRaw] = await Promise.all([
      pool.query<{
        city: string; category: string; round: number; state: RotationStateKind;
        last_cycle_started_at: string | Date | null; last_productive_at: string | Date | null;
        consecutive_zero_new_cycles: number; total_records_last_cycle: number | null;
        records_new_last_cycle: number | null; reactivation_reason: string | null;
        next_action_hint: string | null; state_entered_at: string | Date | null; updated_at: string | Date | null;
      }>(`SELECT city, category, round, state,
                last_cycle_started_at, last_productive_at,
                consecutive_zero_new_cycles, total_records_last_cycle,
                records_new_last_cycle, reactivation_reason, next_action_hint,
                state_entered_at, updated_at
           FROM nex.discovery_rotation_state`),
      pool.query<{ id: string; worker_config: string | null; started_at: string | Date }>(`
        SELECT id, worker_config, started_at FROM nex.worker_cycle_run
         WHERE status='running' AND started_at > now() - interval '2 hours'
      `),
      pool.query<{ worker_id: string; worker_config: string; status: string; started_at: string | Date }>(`
        SELECT DISTINCT ON (worker_id, worker_config)
               worker_id, worker_config, status, started_at
          FROM nex.worker_cycle_run
         WHERE started_at > now() - interval '7 days'
         ORDER BY worker_id, worker_config, started_at DESC
      `),
      pool.query<{ city: string; category: string; picked_at: string | Date }>(`
        SELECT city, category, picked_at FROM nex.discovery_orchestrator_pick
         WHERE picked_at > now() - interval '60 minutes' ORDER BY picked_at ASC LIMIT 30
      `).catch(() => ({ rows: [] as { city: string; category: string; picked_at: string | Date }[] })),
    ]);

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
    const recentPicks: RecentPick[] = picksRaw.rows.map((r) => ({
      city: r.city, category: r.category, pickedAt: new Date(r.picked_at),
    }));

    const stateRows = rotation.rows.map((r) => ({
      city: r.city,
      category: r.category as "accommodation" | "food" | "transport" | "market",
      round: r.round,
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

    const snapshotByKey = new Map(snapshot.map((s) => [`${s.city}:${s.category}`, s]));
    const queueByKey    = new Map(queue.map((q) => [`${q.city}:${q.category}`, q]));

    // Build flat rows · one per (city, category) · then aggregate per city.
    const rows: Array<{ city: string; category: string; status: WorkforceStatus }> = [];
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
          lastCycleStatus: lastStatusByKey.get(key) ?? null,
          consecutiveZeroNewCycles: snap?.consecutiveZeroNewCycles ?? 0,
          inFlight: inFlightKeys.has(key),
          isQueued: q?.status === "would-pick",
          isEligible: q?.status === "eligible",
          isWaitingCooldown: q?.status === "waiting-cooldown",
          isGatedProvider: q?.status === "skipped-gated-provider",
        });
        rows.push({ city: cityEntry.canonical, category, status });
      }
    }
    return buildCityWorkforceDetails(rows);
  } catch {
    // Never fake dots · fall back to unavailable for every city if DB is down.
    return CITY_REGISTRY.map((c) => ({
      city: c.canonical,
      aggregate: "unavailable" as WorkforceStatus,
      perCategory: WALKED_CATEGORIES.map((cat) => ({ category: cat, status: "unavailable" as WorkforceStatus })),
    }));
  }
}

export default async function NexBrainLayout({ children }: { children: React.ReactNode }) {
  const [notificationCounts, walkerStatuses, cityWorkforceDetails] = await Promise.all([
    loadNotificationCounts(),
    loadWalkerStatuses(),
    loadCityWorkforceDetails(),
  ]);
  return (
    <>
      {/* Floating Work Map button · fixed-position · always visible on every HQ page.
          Belt-and-braces backup to the HQShell header button + Reception hero card.
          Guaranteed to render regardless of HQShell client-component hot-reload state. */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes nex-wm-fab-pulse {
            0%, 100% { box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35), 0 0 0 0 rgba(16, 185, 129, 0.6); }
            50%      { box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35), 0 0 0 12px rgba(16, 185, 129, 0); }
          }
          .nex-wm-fab { animation: nex-wm-fab-pulse 2s ease-in-out infinite; }
          .nex-wm-fab:hover { filter: brightness(0.95); transform: translateY(-1px); }
        `,
      }} />
      <Link
        href="/nex-head-quarters/work-map"
        className="nex-wm-fab"
        style={{
          position: "fixed",
          top: 14,
          right: 24,
          zIndex: 9999,
          background: "linear-gradient(90deg, #10b981 0%, #059669 100%)",
          color: "#ffffff",
          fontSize: 15,
          fontWeight: 900,
          letterSpacing: "0.05em",
          textDecoration: "none",
          textTransform: "uppercase",
          padding: "12px 22px",
          borderRadius: 12,
          border: "3px solid #ffffff",
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          transition: "transform 0.15s ease, filter 0.15s ease",
        }}
        title="Open the NEX Master Work & Architecture Map · founder-facing progress dashboard"
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#ffffff",
            color: "#059669",
            fontWeight: 900,
            fontSize: 16,
          }}
          aria-hidden="true"
        >
          ▶
        </span>
        Work Map
      </Link>
      <HQShell
        notificationCounts={notificationCounts}
        walkerStatuses={walkerStatuses}
        cityWorkforceDetails={cityWorkforceDetails}
      >
        <HQAutoRefresh />
        {children}
      </HQShell>
    </>
  );
}
