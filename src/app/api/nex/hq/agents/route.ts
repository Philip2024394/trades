// WO-HQ-AGENTS-01 · API route serving the HQ agents live snapshot.
//
// READ-ONLY. GET only. Reads exclusively from the allowlisted collections
// declared in the agent registry. Never writes, signs, activates, or
// mutates anything.

import { NextResponse } from "next/server";
import { getStorage } from "@/lib/nex/storage/registry";
import { AGENT_REGISTRY, READABLE_COLLECTIONS } from "@/lib/nex-hq-agents/registry";
import { deriveSnapshot } from "@/lib/nex-hq-agents/derive-snapshot";
import type { AgentSnapshot, HqAgentsSnapshotResponse } from "@/lib/nex-hq-agents/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET · returns a fresh snapshot of every named agent.
export async function GET(): Promise<Response> {
  const store = getStorage();
  const now = new Date();
  const agents: AgentSnapshot[] = [];

  for (const agent of AGENT_REGISTRY) {
    // Defensive: assert the collection we're about to read is in the
    // allowlist. This is redundant with registry construction (registry
    // pulls from COLLECTIONS) but makes tampering more visible.
    if (!READABLE_COLLECTIONS.includes(agent.source_collection)) {
      continue;
    }
    let records: Record<string, unknown>[] = [];
    try {
      records = await store.query<Record<string, unknown>>(agent.source_collection, {
        limit: 100,
        order_by: mostLikelyOrderField(agent.source_collection),
        order_dir: "desc",
      });
    } catch {
      // If the collection doesn't exist yet, records = []. That's the
      // WAITING state — do not throw, do not fabricate.
      records = [];
    }
    // Strip potentially-secret fields before returning to the client.
    const safeRecords = records.map((r) => scrubSecrets(r));
    agents.push(deriveSnapshot({ agent, records: safeRecords, now }));
  }

  const wire: HqAgentsSnapshotResponse["wire"] = AGENT_REGISTRY.flatMap((a) =>
    a.wire_downstream.map((to) => ({ from: a.id, to })),
  );

  const response: HqAgentsSnapshotResponse = {
    record_type: "NEX_HQ_AGENTS_SNAPSHOT",
    generated_at: now.toISOString(),
    agents,
    wire,
  };
  return NextResponse.json(response, { status: 200 });
}

// Any non-GET method is refused (no control surface).
export async function POST(): Promise<Response> { return methodNotAllowed(); }
export async function PUT(): Promise<Response> { return methodNotAllowed(); }
export async function PATCH(): Promise<Response> { return methodNotAllowed(); }
export async function DELETE(): Promise<Response> { return methodNotAllowed(); }
function methodNotAllowed(): Response {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}

// ── Helpers ─────────────────────────────────────────────────────────────

function mostLikelyOrderField(collection: string): string {
  // Convention: the primary timestamp per collection
  if (collection.includes("audit_events")) return "occurred_at";
  if (collection.includes("workflow_traces")) return "updated_at";
  if (collection.includes("execution_reports")) return "started_at";
  if (collection.includes("build_reports")) return "started_at";
  if (collection.includes("runtime_reports")) return "started_at";
  if (collection.includes("specialist_results")) return "started_at";
  if (collection.includes("sources")) return "fetched_at";
  if (collection.includes("knowledge_objects")) return "created_at";
  if (collection.includes("hypotheses")) return "formed_at";
  if (collection.includes("experiments")) return "run_at";
  if (collection.includes("proposals")) return "emitted_at";
  if (collection.includes("crawler_audit")) return "attempted_at";
  return "created_at";
}

/**
 * Never return secret material to the client. Intelligence records may
 * contain `attestation_signature_hex`, `raw_content_ref`, or auth-related
 * fields — strip them before serialising.
 */
function scrubSecrets(r: Record<string, unknown>): Record<string, unknown> {
  const stripped: Record<string, unknown> = { ...r };
  const forbidden = ["attestation_signature_hex", "signature", "raw_content_ref", "founder_key_id", "authorization", "signing_key"];
  for (const k of forbidden) if (k in stripped) delete stripped[k];
  return stripped;
}
