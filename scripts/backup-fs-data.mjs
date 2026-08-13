// scripts/backup-fs-data.mjs
//
// F10 · Filesystem-data backup.
//
// Bundles the last-remaining filesystem-primary directories into a
// timestamped tarball for cold storage. Post-Wave-6 the inbox files
// live in nex.object_blobs, so this script mostly captures:
//
//   · data/nex-events/         · Event Bus append-only JSONL
//   · data/nex-brains/         · per-brain memories.jsonl
//   · data/knowledge-inbox/    · anything not yet migrated
//
// USAGE
//   node scripts/backup-fs-data.mjs
//     writes to ./backups/nex-fs-YYYY-MM-DDTHH-MM-SS.tar.gz
//
//   BACKUP_DIR=/mnt/nas/nex node scripts/backup-fs-data.mjs
//     writes to /mnt/nas/nex/nex-fs-YYYY-...tar.gz
//
// EXIT CODES
//   0 · tarball written · manifest printed
//   1 · missing tar binary
//   2 · nothing to back up (all target dirs empty or absent)

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO       = process.cwd();
const BACKUP_DIR = process.env.BACKUP_DIR ?? join(REPO, "backups");
const SOURCES    = [
  "data/nex-events",
  "data/nex-brains",
  "data/knowledge-inbox",
];

function tsSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
}

function tarAvailable() {
  try { execSync("tar --version", { stdio: "ignore" }); return true; }
  catch { return false; }
}

function main() {
  if (!tarAvailable()) {
    console.error("FAIL · `tar` binary not found on PATH");
    process.exit(1);
  }

  const presentSources = SOURCES.filter((s) => existsSync(join(REPO, s)));
  if (presentSources.length === 0) {
    console.warn("nothing to back up · all source dirs absent");
    process.exit(2);
  }

  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
  const outPath = join(BACKUP_DIR, `nex-fs-${tsSlug()}.tar.gz`);

  const cmd = `tar -czf "${outPath}" ${presentSources.map((s) => `"${s}"`).join(" ")}`;
  console.log(`backup-fs-data · ${cmd}`);
  execSync(cmd, { cwd: REPO, stdio: "inherit" });

  const size = statSync(outPath).size;
  const manifest = {
    output:       resolve(outPath),
    size_bytes:   size,
    size_mb:      Number((size / 1024 / 1024).toFixed(2)),
    sources:      presentSources,
    created_at:   new Date().toISOString(),
  };
  console.log(JSON.stringify(manifest, null, 2));
  console.log(`PASS · ${manifest.size_mb} MB written to ${manifest.output}`);
  process.exit(0);
}

main();
