// Checkpoint helpers.
//
// A checkpoint records "the latest timestamp seen in each table at the
// time this backup completed." The NEXT incremental backup queries
// WHERE <tsCol> > checkpoint[table]. Full backups reset the checkpoint
// by exporting everything.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BACKUP_TABLES, type BackupTableKey, type Checkpoint, type BackupRun } from "./types";

const EMPTY_CHECKPOINT: Checkpoint = {
  entries: null, versions: null, edges: null, reviews: null, uploads: null, research: null
};

/** Get the most recent completed backup's checkpoint. Returns empty
 *  when nothing has been backed up yet. */
export async function readLastCheckpoint(): Promise<Checkpoint> {
  const { data } = await supabaseAdmin
    .from("hammerex_nex_backup_runs")
    .select("checkpoint_json")
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.checkpoint_json as Checkpoint | null) ?? { ...EMPTY_CHECKPOINT };
}

/** Query the current MAX(tsCol) per backed-up table. Used to write the
 *  post-backup checkpoint. */
export async function computeCurrentCheckpoint(): Promise<Checkpoint> {
  const out: Checkpoint = { ...EMPTY_CHECKPOINT };
  for (const spec of BACKUP_TABLES) {
    const { data } = await supabaseAdmin
      .from(spec.table)
      .select(spec.tsCol)
      .order(spec.tsCol, { ascending: false })
      .limit(1)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (data as any)?.[spec.tsCol] ?? null;
    out[spec.key as BackupTableKey] = val;
  }
  return out;
}

/** Get the most recent completed backup — used to derive incremental base. */
export async function getLastCompleteBackup(): Promise<BackupRun | null> {
  const { data } = await supabaseAdmin
    .from("hammerex_nex_backup_runs")
    .select("*")
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as BackupRun) ?? null;
}
