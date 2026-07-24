// Audit helpers — append-only. Trigger enforces immutability.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type BackupAuditAction =
  | "backup.started"
  | "backup.completed"
  | "backup.failed"
  | "backup.downloaded"
  | "restore.uploaded"
  | "restore.validated"
  | "restore.previewed"
  | "restore.executing"
  | "restore.completed"
  | "restore.failed";

export async function audit(input: {
  actor:         string;
  action:        BackupAuditAction;
  backupRunId?:  string;
  restoreId?:    string;
  details?:      Record<string, unknown>;
}): Promise<void> {
  await supabaseAdmin.from("hammerex_nex_backup_audit").insert({
    actor:         input.actor,
    action:        input.action,
    backup_run_id: input.backupRunId ?? null,
    restore_id:    input.restoreId ?? null,
    details_json:  input.details ?? null
  });
}
