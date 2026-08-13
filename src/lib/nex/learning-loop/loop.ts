// Learning Loop · capture + query + insight aggregation.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

import type { LearningRecord, LearningQuery, LearningInsight } from "./types";

const RECORDS: LearningRecord[] = [];

export function capture(record: LearningRecord): LearningRecord {
  RECORDS.push(record);
  return record;
}

export function query(q: LearningQuery): readonly LearningRecord[] {
  const filtered = RECORDS.filter((r) => {
    if (q.project_id && r.project_id !== q.project_id) return false;
    if (q.theme_pack && r.theme_pack !== q.theme_pack) return false;
    if (q.personality && r.personality !== q.personality) return false;
    if (q.min_critic_score !== undefined && (r.critic_score ?? 0) < q.min_critic_score) return false;
    if (q.signal_any && !q.signal_any.some((s) => r.signals.includes(s))) return false;
    if (q.since && r.captured_at < q.since) return false;
    return true;
  });
  const limit = q.limit ?? 100;
  return filtered.slice(-limit).reverse();
}

export function count(): number { return RECORDS.length; }

export function clear(): void { RECORDS.length = 0; }

/** Aggregate insights by a single dimension · sample size + mean critic score + acceptance rate. */
export function insights(dimension: LearningInsight["dimension"]): readonly LearningInsight[] {
  const groups = new Map<string, LearningRecord[]>();
  for (const r of RECORDS) {
    let key: string | undefined;
    if (dimension === "theme_pack") key = r.theme_pack;
    else if (dimension === "layout_family") key = r.layout_family;
    else if (dimension === "camera_profile") key = r.camera_profile;
    else if (dimension === "lighting_profile") key = r.lighting_profile;
    else if (dimension === "personality") key = r.personality;
    else if (dimension === "materials") {
      for (const m of r.materials ?? []) {
        const bucket = groups.get(m) ?? [];
        bucket.push(r);
        groups.set(m, bucket);
      }
      continue;
    }
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push(r);
    groups.set(key, bucket);
  }
  const out: LearningInsight[] = [];
  for (const [key, bucket] of groups) {
    const scored = bucket.filter((b) => b.critic_score !== undefined);
    const mean = scored.length ? scored.reduce((s, b) => s + (b.critic_score ?? 0), 0) / scored.length : 0;
    const acceptance = bucket.length ? bucket.filter((b) => b.signals.includes("accepted")).length / bucket.length : 0;
    out.push({
      dimension,
      key,
      sample_size: bucket.length,
      mean_critic_score: Math.round(mean),
      acceptance_rate: Math.round(acceptance * 100) / 100,
    });
  }
  return out.sort((a, b) => b.mean_critic_score - a.mean_critic_score);
}
