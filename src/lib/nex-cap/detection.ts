// WO-CAP-01 · CAP auto-detection from observed evidence.
//
// Founder-locked 2026-09-13 · Discovery ≠ Authority.
// Detection only PRODUCES CAP records. It does not fix anything.
// Fixes flow through resolveCapProposal() and the Authority Broker.

import { getStorage } from "@/lib/nex/storage/registry";
import { SOURCE_GUARDIAN_REJECTIONS_COLLECTION, type GuardianRejection } from "@/lib/nex-intelligence/source-guardian";
import { readAllHostStates } from "@/lib/nex-intelligence/host-rate-limiter";
import { NEX_NET_GROWTH_COLLECTION, type NexNetGrowthSnapshot } from "@/lib/nex-agent-runtime/nex-net-growth";
import { persistCapabilityGap, loadAllCaps } from "./registry";
import type { CapEvidencePointer, CapabilityGap } from "./types";

/**
 * Run one detection pass across all observed evidence sources.
 * Returns any newly-created CAPs (deduplicated by dedupe_key so repeated
 * detections do not create duplicate CAPs).
 */
export async function runCapDetectionPass(): Promise<CapabilityGap[]> {
  const created: CapabilityGap[] = [];
  const existing = await loadAllCaps();
  const existingKeys = new Set(existing.map((c) => c.cap_id));

  // (1) Guardian rejections — every rejection code becomes a SECURITY CAP
  //     candidate. Dedupe by (rejection_code, requested_host).
  const rejections = await getStorage().query<GuardianRejection>(SOURCE_GUARDIAN_REJECTIONS_COLLECTION, {
    limit: 1000, order_by: "rejected_at", order_dir: "desc",
  }).catch(() => []);
  const rejByCodeHost = new Map<string, GuardianRejection[]>();
  for (const r of rejections) {
    const key = `${r.rejection_code}|${r.requested_host ?? "no-host"}`;
    const arr = rejByCodeHost.get(key) ?? [];
    arr.push(r);
    rejByCodeHost.set(key, arr);
  }
  for (const [key, group] of rejByCodeHost.entries()) {
    // Only produce a CAP if there are ≥1 rejections (any real rejection is worth
    // recording). Threshold could tighten later.
    const evidence: CapEvidencePointer[] = group.slice(0, 5).map((r) => ({
      collection: SOURCE_GUARDIAN_REJECTIONS_COLLECTION,
      record_id: r.rejection_id,
      kind: "guardian_rejection",
    }));
    const cap = await persistCapabilityGap({
      kind: `guardian.${group[0].rejection_code}`,
      category: "SECURITY",
      priority: group.length >= 5 ? "HIGH" : group.length >= 2 ? "MEDIUM" : "LOW",
      title: `Guardian repeatedly rejected acquisitions for reason ${group[0].rejection_code} (host=${group[0].requested_host ?? "none"}) · ${group.length} events`,
      evidence,
      detector_agent_id: "lab-security-observer",
      dedupe_key: key,
    });
    if (!existingKeys.has(cap.cap_id)) { created.push(cap); existingKeys.add(cap.cap_id); }
  }

  // (2) Rate-limit health — hosts with consecutive_failures ≥ 3 become
  //     PERFORMANCE CAPs. Dedupe by host.
  const hosts = await readAllHostStates();
  for (const h of hosts) {
    if (h.consecutive_failures < 3) continue;
    const cap = await persistCapabilityGap({
      kind: "rate_limiter.persistent_backoff",
      category: "PERFORMANCE",
      priority: h.consecutive_failures >= 5 ? "HIGH" : "MEDIUM",
      title: `Host ${h.host} has ${h.consecutive_failures} consecutive rate-limit/backoff events · pipeline degraded`,
      evidence: [{ collection: "nex_host_rate_limits", record_id: h.host, kind: "rate_limit_state" }],
      detector_agent_id: "lab-security-observer",
      dedupe_key: `rate_limiter|${h.host}`,
    });
    if (!existingKeys.has(cap.cap_id)) { created.push(cap); existingKeys.add(cap.cap_id); }
  }

  // (3) Intelligence-growth stall — if the last 3 NET GROWTH snapshots
  //     show zero net_nex_growth, surface an INTELLIGENCE CAP.
  const growthSnapshots = await getStorage().query<NexNetGrowthSnapshot>(NEX_NET_GROWTH_COLLECTION, {
    limit: 5, order_by: "captured_at", order_dir: "desc",
  }).catch(() => []);
  const withDeltas = growthSnapshots.filter((s) => s.deltas_from_previous !== null);
  if (withDeltas.length >= 3) {
    const recentThree = withDeltas.slice(0, 3);
    const allZero = recentThree.every((s) => (s.deltas_from_previous?.net_nex_growth ?? 0) === 0);
    if (allZero) {
      const cap = await persistCapabilityGap({
        kind: "intelligence.growth_stalled",
        category: "INTELLIGENCE",
        priority: "MEDIUM",
        title: `NEX NET GROWTH has been zero for the last 3 snapshots · intelligence pipeline may be idle or blocked`,
        evidence: recentThree.map((s) => ({
          collection: NEX_NET_GROWTH_COLLECTION, record_id: s.snapshot_id, kind: "growth_snapshot",
        })),
        detector_agent_id: "intelligence-scoring",
        dedupe_key: `growth_stall|${recentThree[0].snapshot_id}`,
      });
      if (!existingKeys.has(cap.cap_id)) { created.push(cap); existingKeys.add(cap.cap_id); }
    }
  }

  return created;
}
