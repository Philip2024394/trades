// WO-NEX-MISSION-MATRIX · signed record + persistence.
//
// Founder-locked 2026-09-14. The recorder is PASSIVE. It takes an
// already-determined MissionRunRecord (verdict + evidence produced by
// the workforce) and persists it. It NEVER computes the verdict itself.
//
// The signature attests to record INTEGRITY (this is what the recorder
// received) · NOT to verdict authority (the recorder cannot bless a
// verdict the workforce did not independently establish).

import {
  randomUUID,
  sign as ed25519Sign,
  createPublicKey,
  verify as ed25519Verify,
} from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import type { AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import {
  MISSION_MATRIX_RUN_COLLECTION,
  type MissionRunRecord,
} from "./types";

function canonicaliseRun(r: Omit<MissionRunRecord, "signature_hex">): Buffer {
  const ordered: Record<string, unknown> = {
    record_type: r.record_type,
    mission_id: r.mission_id,
    mission_matrix_number: r.mission_matrix_number,
    capability_domain: r.capability_domain,
    title: r.title,
    workspace_root: r.workspace_root,
    files_changed: [...r.files_changed].sort(),
    lines_changed: r.lines_changed,
    nex1_result: r.nex1_result,
    nex2_result: r.nex2_result,
    nex3_result: r.nex3_result,
    security_result: r.security_result,
    orchestrator_result: r.orchestrator_result,
    execution_result: r.execution_result,
    build_result: r.build_result,
    test_result: r.test_result,
    independent_verification: r.independent_verification,
    recovery_events: r.recovery_events.map((e) => ({ ...e })),
    refusals: r.refusals.map((e) => ({ ...e })),
    dependency_chain_detected: r.dependency_chain_detected,
    dependency_chain_edges: r.dependency_chain_edges,
    domain_specific_evidence: { ...r.domain_specific_evidence },
    evidence_links: { ...r.evidence_links },
    final_verdict: r.final_verdict,
    verdict_reason: r.verdict_reason,
    recorded_by_agent_id: r.recorded_by_agent_id,
    recorded_by_public_key_der_hex: r.recorded_by_public_key_der_hex,
    recorded_at: r.recorded_at,
    attempted_at: r.attempted_at,
    finished_at: r.finished_at,
  };
  // Skill M · founder-authorised 2026-09-14. transfer_test_link is
  // included in the canonicalisation only when present · this preserves
  // signature verification for the 19 pre-Skill-M records that were
  // persisted without this field.
  if (r.transfer_test_link !== null && r.transfer_test_link !== undefined) {
    ordered.transfer_test_link = { ...r.transfer_test_link };
  }
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

export function verifyMissionRunSignature(rec: MissionRunRecord): boolean {
  try {
    const { signature_hex: _drop, ...base } = rec;
    void _drop;
    const pub = createPublicKey({ key: Buffer.from(rec.recorded_by_public_key_der_hex, "hex"), format: "der", type: "spki" });
    return ed25519Verify(null, canonicaliseRun(base), pub, Buffer.from(rec.signature_hex, "hex"));
  } catch {
    return false;
  }
}

export interface PersistMissionRunInput {
  /** The recorder's identity · signs the record. NOT authority-granting. */
  readonly recorder: AgentIdentity;
  /** The already-established mission outcome. The recorder does NOT
   *  compute this · the workforce establishes it independently and
   *  passes it in. */
  readonly record: Omit<
    MissionRunRecord,
    | "record_type"
    | "recorded_by_agent_id"
    | "recorded_by_public_key_der_hex"
    | "recorded_at"
    | "signature_hex"
  >;
}

export interface PersistMissionRunResult {
  readonly record: MissionRunRecord;
}

/** Persist a mission-matrix record signed by the recorder identity.
 *  The signature attests to record INTEGRITY (this is what the recorder
 *  received) · NOT to verdict authority. */
export async function persistMissionRun(input: PersistMissionRunInput): Promise<PersistMissionRunResult> {
  const base: Omit<MissionRunRecord, "signature_hex"> = {
    record_type: "NEX_MISSION_MATRIX_RUN",
    ...input.record,
    recorded_by_agent_id: input.recorder.agent_id,
    recorded_by_public_key_der_hex: input.recorder.public_key_der_hex,
    recorded_at: new Date().toISOString(),
  };
  // Skill M validation · founder-authorised 2026-09-14. If the mission
  // declares a paired role, the baseline must resolve to an already-persisted
  // mission. Refuse rather than record a lie about lineage.
  if (base.transfer_test_link !== null && base.transfer_test_link !== undefined) {
    const link = base.transfer_test_link;
    if (link.role !== "independent" && (!link.paired_baseline || link.paired_baseline.length === 0)) {
      throw new Error(`persistMissionRun: transfer_test_link.role='${link.role}' requires a non-empty paired_baseline mission_id`);
    }
    if (link.role !== "independent" && link.paired_baseline) {
      const existing = await getStorage()
        .query<MissionRunRecord>(MISSION_MATRIX_RUN_COLLECTION, { limit: 10000 })
        .catch(() => [] as MissionRunRecord[]);
      const resolved = existing.find((r) => r.mission_id === link.paired_baseline);
      if (!resolved) {
        throw new Error(`persistMissionRun: paired_baseline '${link.paired_baseline}' not found in mission-matrix storage · cannot record an unresolvable lineage`);
      }
      if (link.capability_under_test.length === 0) {
        throw new Error(`persistMissionRun: transfer_test_link.capability_under_test must be non-empty when role is paired`);
      }
    }
  }
  const sig = ed25519Sign(null, canonicaliseRun(base), input.recorder.private).toString("hex");
  const record: MissionRunRecord = { ...base, signature_hex: sig };
  await getStorage().save(MISSION_MATRIX_RUN_COLLECTION, record);
  return { record };
}

/** Skill M · walk the transfer chain for a capability. Returns records
 *  ordered by recorded_at ascending (baseline first · then mechanism_change ·
 *  then task_transfer). Useful for the audit question: "did NEX1 prove
 *  this on something new, or did it only prove the exact thing it was
 *  taught?" · founder-authorised 2026-09-14. */
export async function getTransferChain(capability_under_test: string, limit = 5000): Promise<MissionRunRecord[]> {
  const all = await loadAllMissionRuns(limit);
  const linked = all.filter((r) => r.transfer_test_link?.capability_under_test === capability_under_test);
  return linked.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
}

export async function loadAllMissionRuns(limit = 500): Promise<MissionRunRecord[]> {
  return getStorage()
    .query<MissionRunRecord>(MISSION_MATRIX_RUN_COLLECTION, {
      limit, order_by: "recorded_at", order_dir: "desc",
    })
    .catch(() => [] as MissionRunRecord[]);
}

export async function loadMissionRunsByDomain(domain: string, limit = 500): Promise<MissionRunRecord[]> {
  const all = await loadAllMissionRuns(limit);
  return all.filter((r) => r.capability_domain === domain);
}
