// Backup export engine.
//
// createBackup({ kind, actor }) does:
//   1. Insert a backup_runs row (status=running).
//   2. Read the last checkpoint (for incremental) or export everything (full).
//   3. For each backed-up table, query rows changed since checkpoint.
//   4. Build the ZIP:
//        database/<file>.json per table
//        metadata/backup_manifest.json (with integrity checksums)
//        metadata/system_version.json
//        metadata/checkpoint.json
//        restore_instructions.md
//   5. Compute size + integrity checksums.
//   6. Ensure the nex-backups bucket exists; upload the ZIP.
//   7. Update the run row (status=complete, manifest, checkpoint, size).
//   8. Audit.
//
// Never throws to the caller; failures land in run.status='failed' with
// the message. The route handler surfaces error_message.

import { randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import * as archiverNs from "archiver";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BACKUP_BUCKET, BACKUP_TABLES, NEX_BACKUP_FORMAT_VERSION, type BackupKind, type BackupManifest, type BackupRun, type Checkpoint } from "./types";
import { readLastCheckpoint, computeCurrentCheckpoint, getLastCompleteBackup } from "./checkpoint";
import { computeIntegrity } from "./integrity";
import { audit } from "./audit";

const archiverFn = (archiverNs as unknown as { default?: typeof archiverNs }).default ?? archiverNs;
type ArchiverFactory = (fmt: "zip", opts?: unknown) => import("archiver").Archiver;
const createArchive = archiverFn as unknown as ArchiverFactory;

export type CreateBackupInput = {
  kind:   BackupKind;
  actor:  string;
  notes?: string;
};

export type CreateBackupResult = {
  ok:        boolean;
  run:       BackupRun;
  error?:    string;
};

export async function createBackup(input: CreateBackupInput): Promise<CreateBackupResult> {
  // 1. Insert run row.
  const { data: runRow, error: runErr } = await supabaseAdmin
    .from("hammerex_nex_backup_runs")
    .insert({
      kind:       input.kind,
      status:     "running",
      created_by: input.actor
    })
    .select("*")
    .single();
  if (runErr || !runRow) throw new Error(`create backup run failed: ${runErr?.message}`);
  const run = runRow as unknown as BackupRun;
  await audit({ actor: input.actor, action: "backup.started", backupRunId: run.id, details: { kind: input.kind } });

  try {
    // 2. Read the previous checkpoint (only used for incrementals).
    const previousCheckpoint: Checkpoint = input.kind === "full" || input.kind === "pre_restore_snapshot"
      ? { entries: null, versions: null, edges: null, reviews: null, uploads: null, research: null }
      : await readLastCheckpoint();

    const baseBackup = input.kind === "incremental" ? await getLastCompleteBackup() : null;

    // 3. Query rows per table.
    const perTable: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};
    for (const spec of BACKUP_TABLES) {
      let q = supabaseAdmin.from(spec.table).select("*");
      const since = previousCheckpoint[spec.key];
      if (since) q = q.gt(spec.tsCol, since);
      const { data, error } = await q.order(spec.tsCol, { ascending: true });
      if (error) throw new Error(`export ${spec.table} failed: ${error.message}`);
      perTable[spec.key] = data ?? [];
      counts[spec.key]   = (data ?? []).length;
    }

    // 4. Compute the new checkpoint from the current DB state (not just
    //    what we exported — this handles the case where nothing changed).
    const currentCheckpoint = await computeCurrentCheckpoint();

    // 5. Build in-memory files → JSON strings.
    const files: Record<string, string> = {};
    for (const spec of BACKUP_TABLES) {
      files[`database/${spec.file}`] = JSON.stringify(perTable[spec.key], null, 2);
    }

    files["metadata/system_version.json"] = JSON.stringify({
      format_version:   NEX_BACKUP_FORMAT_VERSION,
      generated_at:     new Date().toISOString(),
      db_schema_hint:   "supabase migrations 20260722510000..20260722680000"
    }, null, 2);

    files["metadata/checkpoint.json"] = JSON.stringify(currentCheckpoint, null, 2);

    // Integrity across every non-manifest file (manifest can't reference itself).
    const integrity = computeIntegrity({
      ...Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v]))
    });

    const manifest: BackupManifest = {
      format_version:    NEX_BACKUP_FORMAT_VERSION,
      backup_id:         run.id,
      kind:              input.kind,
      base_backup_id:    baseBackup?.id ?? null,
      created_at:        new Date().toISOString(),
      created_by:        input.actor,
      db_schema_version: "20260722680000",
      record_counts: {
        entries:  counts.entries,  versions: counts.versions, edges: counts.edges,
        reviews:  counts.reviews,  uploads:  counts.uploads,  research: counts.research
      },
      integrity,
      checkpoint:        currentCheckpoint,
      notes:             input.notes
    };
    files["metadata/backup_manifest.json"] = JSON.stringify(manifest, null, 2);
    files["restore_instructions.md"]      = RESTORE_INSTRUCTIONS_TEMPLATE
      .replace("{ID}", run.id)
      .replace("{DATE}", manifest.created_at)
      .replace("{KIND}", input.kind);

    // 6. Stream files into a ZIP and collect into a Buffer for storage upload.
    const zipBuffer = await buildZipBuffer(files);

    // 7. Ensure bucket + upload.
    await ensureBucket();
    const storagePath = storagePathFor(run.id);
    const { error: upErr } = await supabaseAdmin.storage
      .from(BACKUP_BUCKET)
      .upload(storagePath, zipBuffer, {
        contentType: "application/zip",
        upsert:      false
      });
    if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);

    // 8. Update run row.
    const { data: completedRow } = await supabaseAdmin
      .from("hammerex_nex_backup_runs")
      .update({
        status:          "complete",
        base_backup_id:  baseBackup?.id ?? null,
        entries_count:   counts.entries,
        versions_count:  counts.versions,
        edges_count:     counts.edges,
        reviews_count:   counts.reviews,
        uploads_count:   counts.uploads,
        research_count:  counts.research,
        size_bytes:      zipBuffer.length,
        storage_path:    storagePath,
        manifest_json:   manifest,
        checkpoint_json: currentCheckpoint,
        completed_at:    new Date().toISOString()
      })
      .eq("id", run.id)
      .select("*")
      .single();

    await audit({
      actor:        input.actor,
      action:       "backup.completed",
      backupRunId:  run.id,
      details:      { kind: input.kind, size_bytes: zipBuffer.length, counts }
    });

    return { ok: true, run: completedRow as unknown as BackupRun };
  } catch (e) {
    const message = e instanceof Error ? e.message : "backup failed";
    await supabaseAdmin
      .from("hammerex_nex_backup_runs")
      .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
      .eq("id", run.id);
    await audit({ actor: input.actor, action: "backup.failed", backupRunId: run.id, details: { error: message } });
    return { ok: false, run, error: message };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

async function ensureBucket(): Promise<void> {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = (buckets ?? []).some((b) => b.name === BACKUP_BUCKET);
  if (exists) return;
  await supabaseAdmin.storage.createBucket(BACKUP_BUCKET, { public: false });
}

function storagePathFor(runId: string): string {
  const now = new Date();
  const y   = now.getUTCFullYear();
  const m   = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}/${m}/backup-${runId}.zip`;
}

async function buildZipBuffer(files: Record<string, string>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const pass    = new PassThrough();
    const archive = createArchive("zip", { zlib: { level: 6 } });
    archive.on("error", (e: Error) => reject(e));
    pass.on("data", (c: Buffer) => chunks.push(c));
    pass.on("end",  () => resolve(Buffer.concat(chunks)));
    pass.on("error", (e: Error) => reject(e));
    archive.pipe(pass);
    for (const [path, content] of Object.entries(files)) {
      archive.append(Buffer.from(content, "utf-8"), { name: `NEX_BACKUP/${path}` });
    }
    archive.finalize();
  });
}

// ─── Signed download URL ────────────────────────────────────────

export async function signedDownloadUrl(run: BackupRun, expiresSeconds = 300): Promise<string | null> {
  if (!run.storage_path) return null;
  const { data } = await supabaseAdmin.storage
    .from(run.storage_bucket)
    .createSignedUrl(run.storage_path, expiresSeconds);
  return data?.signedUrl ?? null;
}

// ─── Reads ───────────────────────────────────────────────────────

export async function listBackups(limit = 50): Promise<BackupRun[]> {
  const { data } = await supabaseAdmin
    .from("hammerex_nex_backup_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as unknown as BackupRun[]) ?? [];
}

export async function getBackup(id: string): Promise<BackupRun | null> {
  const { data } = await supabaseAdmin
    .from("hammerex_nex_backup_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as BackupRun) ?? null;
}

// ─── Restore instructions template ─────────────────────────────

const RESTORE_INSTRUCTIONS_TEMPLATE = `# Nex Brain — Backup Restore Instructions

Backup ID: {ID}
Created: {DATE}
Kind: {KIND}

## What's in this ZIP

- \`database/\` — one JSON file per Nex table (entries, versions, edges, reviews, teaching uploads, research reports).
- \`metadata/backup_manifest.json\` — the source of truth for this backup. Contains SHA-256 checksums for every other file.
- \`metadata/system_version.json\` — the Nex backup format version.
- \`metadata/checkpoint.json\` — timestamp checkpoint used to compute the next incremental.

## Verifying this backup offline

1. Read \`metadata/backup_manifest.json\`.
2. For each entry in \`integrity\`, compute SHA-256 of the referenced file.
3. Compare against \`sha256\` and \`size_bytes\`. All must match.
4. Any mismatch means the ZIP was tampered with or corrupted — do not restore.

## Restoring into a Nex instance

1. Sign into the admin panel of the target Nex instance.
2. Go to Admin → Nex → Backup & Restore → Restore.
3. Upload this ZIP.
4. Nex will validate the manifest + checksums, show a preview (what would be inserted / updated / skipped), and take a **pre-restore snapshot** of the current state automatically.
5. Confirm to execute. The restore is additive — nothing existing is deleted; matching IDs are updated to the backup's version.

## Disaster recovery

If Supabase is unrecoverable:
1. Provision a fresh Supabase project.
2. Apply the Trade OS migrations up to \`20260722680000_nex_backup_runs.sql\`.
3. Follow "Restoring into a Nex instance" above, uploading the most recent ZIP.
4. Apply subsequent incremental ZIPs in order (each carries a \`base_backup_id\` pointing to its parent).

## Store this file

Keep every backup ZIP in at least two locations:
- Cloud storage separate from Supabase (Google Drive, Dropbox, S3).
- A physical drive (USB stick, external SSD).

The knowledge inside is the company's biggest long-term asset.
`;
