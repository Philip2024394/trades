// Audit log helper — one entry point for every write in the module.
// Never throws (audit failures must not break user writes) · logs to
// stderr if the audit insert itself fails so we can catch drift.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AuditActorKind } from "../_schema/types";

export type AuditEvent = {
  entity_type: "pack" | "board" | "measurement" | "allocation" | "worker_link" | "offcut" | "supplier" | "defect";
  entity_id: string;
  event_type: string;
  actor_kind: AuditActorKind;
  actor_ref: string;
  before_json?: unknown;
  after_json?: unknown;
  metadata?: Record<string, unknown>;
};

export async function audit(evt: AuditEvent): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from("nex_materials_audit_log")
      .insert({
        entity_type:   evt.entity_type,
        entity_id:     evt.entity_id,
        event_type:    evt.event_type,
        actor_kind:    evt.actor_kind,
        actor_ref:     evt.actor_ref,
        before_json:   evt.before_json ?? null,
        after_json:    evt.after_json ?? null,
        metadata:      evt.metadata ?? {},
      });
    if (error) {
      console.error("[materials.audit] insert failed", error, evt);
    }
  } catch (e) {
    console.error("[materials.audit] threw", e, evt);
  }
}
