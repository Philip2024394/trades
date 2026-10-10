// WO-CAP-01 · CAP persistence + read helpers.

import { randomUUID } from "node:crypto";
import { provenanceChainHash, sha256Hex } from "@/lib/nex-intelligence/provenance";
import { getStorage } from "@/lib/nex/storage/registry";
import type { CapEvidencePointer, CapabilityGap, CapCategory, CapPriority, CapResolverOutcome, CapStatus } from "./types";
import { CAP_COLLECTION } from "./types";

export interface CreateCapInput {
  readonly kind: string;
  readonly category: CapCategory;
  readonly priority: CapPriority;
  readonly title: string;
  readonly evidence: readonly CapEvidencePointer[];
  readonly detector_agent_id: string | null;
  /** Optional stable identity key — if provided, CAPs with the same dedupe_key
   *  will not be duplicated (deterministic idempotency by kind+key). */
  readonly dedupe_key?: string;
}

export async function persistCapabilityGap(input: CreateCapInput): Promise<CapabilityGap> {
  const now = new Date().toISOString();
  const cap_id = input.dedupe_key
    ? `CAP-${input.category}-${sha256Hex(input.kind + "|" + input.dedupe_key).slice(0, 16)}`
    : `CAP-${input.category}-${randomUUID().slice(0, 12)}`;
  const base = {
    record_type: "NEX_CAPABILITY_GAP" as const,
    cap_id, kind: input.kind, category: input.category, priority: input.priority,
    status: "OPEN" as CapStatus,
    resolver_outcome: null as CapResolverOutcome | null,
    title: input.title,
    evidence: Object.freeze([...input.evidence]) as readonly CapEvidencePointer[],
    proposed_wo_id: null as string | null,
    resolution_note: null as string | null,
    detected_at: now, last_updated_at: now,
    detector_agent_id: input.detector_agent_id,
  };
  const cap: CapabilityGap = { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
  await getStorage().save(CAP_COLLECTION, cap);
  return cap;
}

export async function updateCapStatus(input: {
  cap_id: string;
  status: CapStatus;
  resolver_outcome?: CapResolverOutcome;
  proposed_wo_id?: string;
  resolution_note?: string;
  additional_evidence?: readonly CapEvidencePointer[];
}): Promise<CapabilityGap | null> {
  // Query with a where filter + newest-first ordering so append-only
  // JSONL growth cannot hide the target CAP behind a limit truncation.
  const all = await getStorage().query<CapabilityGap>(CAP_COLLECTION, {
    where: { cap_id: input.cap_id },
    limit: 200,
    order_by: "last_updated_at",
    order_dir: "desc",
  }).catch(() => []);
  const existing = all[0];
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: CapabilityGap = {
    ...existing,
    status: input.status,
    resolver_outcome: input.resolver_outcome ?? existing.resolver_outcome,
    proposed_wo_id: input.proposed_wo_id ?? existing.proposed_wo_id,
    resolution_note: input.resolution_note ?? existing.resolution_note,
    evidence: input.additional_evidence
      ? Object.freeze([...existing.evidence, ...input.additional_evidence]) as readonly CapEvidencePointer[]
      : existing.evidence,
    last_updated_at: now,
    provenance_chain_hash: provenanceChainHash({
      ...existing,
      status: input.status,
      resolver_outcome: input.resolver_outcome ?? existing.resolver_outcome,
      proposed_wo_id: input.proposed_wo_id ?? existing.proposed_wo_id,
      resolution_note: input.resolution_note ?? existing.resolution_note,
      last_updated_at: now,
    } as unknown as Record<string, unknown>, [existing.provenance_chain_hash]),
  };
  await getStorage().save(CAP_COLLECTION, updated);
  return updated;
}

export async function loadCap(cap_id: string): Promise<CapabilityGap | null> {
  const all = await loadAllCaps();
  return all.find((c) => c.cap_id === cap_id) ?? null;
}

/** Founder-locked: GB storage is append-only, so multiple versions of a
 *  CAP (successive status transitions) coexist on disk. This returns the
 *  LATEST version per cap_id (by last_updated_at). Limit is high enough
 *  to cover the whole registry · a smaller limit could hide freshly-
 *  appended CAPs behind the boundary. */
export async function loadAllCaps(): Promise<CapabilityGap[]> {
  const raw = await getStorage().query<CapabilityGap>(CAP_COLLECTION, { limit: 200_000, order_by: "last_updated_at", order_dir: "desc" }).catch(() => []);
  const latestById = new Map<string, CapabilityGap>();
  for (const c of raw) if (!latestById.has(c.cap_id)) latestById.set(c.cap_id, c);
  return Array.from(latestById.values()).sort((a, b) => b.detected_at.localeCompare(a.detected_at));
}

export async function loadOpenCaps(): Promise<CapabilityGap[]> {
  const all = await loadAllCaps();
  return all.filter((c) => c.status === "OPEN" || c.status === "TRIAGED" || c.status === "PROPOSED" || c.status === "IN_PROGRESS");
}

export async function loadResolvedCaps(): Promise<CapabilityGap[]> {
  const all = await loadAllCaps();
  return all.filter((c) => c.status === "RESOLVED");
}
