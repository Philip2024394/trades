// src/lib/nex/images/manifestWriter.ts
//
// Shared manifest write path. Every route that mutates the manifest
// (/api/admin/image-tagger/save · /api/admin/nex-tag/batch-save · any
// future writer) must use `withManifestWrite()` — NOT read/modify/write
// their own copy of the file.
//
// Guarantees:
//   1. Cross-endpoint serialisation — every mutation waits for the
//      previous mutation to finish its full read-modify-write cycle.
//      Prevents the 2026-07-27 corruption where 6 concurrent workers
//      collapsed 1010 rows to 1.
//   2. Auto-versioned backup BEFORE every write — data/.manifest-backups/
//      manifest-YYYYMMDD-HHMMSS-mmm.json · last BACKUP_KEEP rotated.
//   3. Atomic write — .tmp.<pid>.<ts> file written first, then
//      fs.rename() swaps it in. An interrupted write can never leave
//      the manifest half-parseable.

import { promises as fs } from "node:fs";
import path from "node:path";

export const MANIFEST_PATH = path.join(
  process.cwd(),
  "data",
  "nex-image-manifest.json"
);
export const BACKUP_DIR = path.join(
  process.cwd(),
  "data",
  ".manifest-backups"
);
export const BACKUP_KEEP = 50;

export type ManifestFile = {
  version: number;
  generated_at?: string;
  description?: string;
  images: Record<string, Record<string, unknown>>;
};

// Module-level Promise chain that serialises every writer in this
// Node process. Concurrent callers wait their turn.
let writeQueue: Promise<unknown> = Promise.resolve();

function runSerialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(fn, fn);
  writeQueue = next.catch(() => undefined);
  return next;
}

async function backupCurrent(): Promise<string | null> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const ts = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "-")
      .slice(0, 23);
    const backupPath = path.join(BACKUP_DIR, `manifest-${ts}.json`);
    await fs.writeFile(backupPath, raw, "utf8");
    const entries = await fs.readdir(BACKUP_DIR);
    const backups = entries
      .filter((n) => n.startsWith("manifest-") && n.endsWith(".json"))
      .sort();
    if (backups.length > BACKUP_KEEP) {
      const toDelete = backups.slice(0, backups.length - BACKUP_KEEP);
      await Promise.all(
        toDelete.map((n) =>
          fs.unlink(path.join(BACKUP_DIR, n)).catch(() => undefined)
        )
      );
    }
    return backupPath;
  } catch {
    return null;
  }
}

async function atomicWrite(manifest: ManifestFile): Promise<void> {
  const tmpPath =
    MANIFEST_PATH + ".tmp." + process.pid + "." + Date.now();
  await fs.writeFile(tmpPath, JSON.stringify(manifest, null, 2), "utf8");
  await fs.rename(tmpPath, MANIFEST_PATH);
}

async function readManifest(): Promise<ManifestFile> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    const m = JSON.parse(raw) as ManifestFile;
    if (!m.images) m.images = {};
    return m;
  } catch {
    return {
      version: 1,
      generated_at: new Date().toISOString(),
      description:
        "NEX image manifest — canonical index of every image asset in the app with subject metadata, generation prompt (if AI), and tags. Per ADR-0024.",
      images: {},
    };
  }
}

/**
 * The ONLY safe way to mutate the manifest. Callers receive a mutable
 * manifest reference, mutate it, and return any payload they want in
 * the response. The write path handles backup + atomic swap.
 */
export function withManifestWrite<T>(
  mutator: (manifest: ManifestFile) => Promise<T> | T
): Promise<{ result: T; backup_path: string | null }> {
  return runSerialized(async () => {
    const backup_path = await backupCurrent();
    const manifest = await readManifest();
    const result = await mutator(manifest);
    manifest.generated_at = new Date().toISOString();
    await atomicWrite(manifest);
    return { result, backup_path };
  });
}

/** Read-only manifest access (no mutex — reads are always safe). */
export async function readManifestSnapshot(): Promise<ManifestFile> {
  return readManifest();
}
