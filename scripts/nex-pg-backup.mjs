#!/usr/bin/env node
// scripts/nex-pg-backup.mjs
//
// Founder 2026-09-10 · Nightly pg_dump backup to MinIO.
//
// - pg_dump custom format (-Fc) · compressed · restorable via pg_restore
// - SHA256 checksum recorded in nex.founder_window_event
// - Uploaded to MinIO bucket "nex-backups" (falls back to local disk if
//   MinIO unavailable)
// - Retention policy applied AFTER upload · deletes local files older
//   than 7 days
// - Emits founder_window_event so Founder's Window shows the run

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, createReadStream, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const BACKUP_DIR = join(REPO_ROOT, "data", "nex-backups");
const LOG_PATH = join(BACKUP_DIR, "backup.log");
const PG_DUMP = "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe";
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? "http://localhost:9000";
const MINIO_BUCKET = process.env.NEX_BACKUP_BUCKET ?? "nex-backups";
const RETENTION_DAYS = Number(process.env.NEX_BACKUP_RETENTION_DAYS ?? "7");

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try {
    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
    const { appendFileSync } = require("node:fs");
    appendFileSync(LOG_PATH, msg);
  } catch { /* silent */ }
}

function readPgUrl() {
  try {
    const env = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    const m = env.match(/^NEX_TAXONOMY_POSTGRES_URL\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* fall through */ }
  return "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

async function emitFW(kind, status, message, ref = {}) {
  try {
    const { Client } = await import("pg");
    const c = new Client({ connectionString: readPgUrl(), connectionTimeoutMillis: 5000 });
    await c.connect();
    await c.query(
      `INSERT INTO nex.founder_window_event (subsystem, event_kind, status, actor, message, reference)
       VALUES ('storage', $1, $2, 'nex-pg-backup.mjs', $3, $4::jsonb)`,
      [kind, status, message, JSON.stringify(ref)]
    );
    await c.end();
  } catch { /* silent */ }
}

// Run pg_dump to file
async function runPgDump(url, outPath) {
  return new Promise((resolve, reject) => {
    if (!existsSync(PG_DUMP)) return reject(new Error(`pg_dump not found at ${PG_DUMP}`));
    // Parse url · pass password via env for security
    const u = new URL(url);
    const env = { ...process.env, PGPASSWORD: decodeURIComponent(u.password) };
    const args = ["-h", u.hostname, "-p", u.port || "5432", "-U", u.username,
                  "-d", u.pathname.replace(/^\//, ""), "-Fc", "-f", outPath];
    const proc = spawn(PG_DUMP, args, { env, windowsHide: true });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += String(d); });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve({ path: outPath });
      else reject(new Error(`pg_dump exit ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}

function sha256File(path) {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    const s = createReadStream(path);
    s.on("data", (d) => h.update(d));
    s.on("end", () => resolve(h.digest("hex")));
    s.on("error", reject);
  });
}

// Best-effort MinIO upload via HTTP PUT (S3-compatible)
async function uploadToMinio(localPath, remoteKey) {
  const credentialsPath = join(REPO_ROOT, ".env.local");
  let accessKey = process.env.MINIO_ACCESS_KEY;
  let secretKey = process.env.MINIO_SECRET_KEY;
  if (!accessKey || !secretKey) {
    try {
      const env = readFileSync(credentialsPath, "utf8");
      accessKey = accessKey ?? env.match(/^MINIO_ACCESS_KEY\s*=\s*(.+)$/m)?.[1].trim();
      secretKey = secretKey ?? env.match(/^MINIO_SECRET_KEY\s*=\s*(.+)$/m)?.[1].trim();
    } catch { /* fall through */ }
  }
  if (!accessKey || !secretKey) return { ok: false, reason: "no_minio_credentials" };
  // Simplest possible: use `mc` CLI if present, else skip (SigV4 in pure JS is heavy)
  const { spawnSync } = await import("node:child_process");
  for (const mc of ["mc.exe", "C:\\tools\\minio\\mc.exe", "C:\\Program Files\\MinIO\\mc.exe"]) {
    try {
      const r = spawnSync(mc, ["--version"], { windowsHide: true });
      if (r.status === 0) {
        // Configure alias + upload
        spawnSync(mc, ["alias", "set", "nexbackups", MINIO_ENDPOINT, accessKey, secretKey], { windowsHide: true });
        spawnSync(mc, ["mb", "--ignore-existing", `nexbackups/${MINIO_BUCKET}`], { windowsHide: true });
        const up = spawnSync(mc, ["cp", localPath, `nexbackups/${MINIO_BUCKET}/${remoteKey}`], { windowsHide: true });
        if (up.status === 0) return { ok: true, method: "mc-cli", remoteKey };
        return { ok: false, reason: `mc cp exit ${up.status}: ${up.stderr?.toString().slice(0, 200)}` };
      }
    } catch { /* try next */ }
  }
  return { ok: false, reason: "mc CLI not found · install MinIO client to enable upload" };
}

function prune(dir, days) {
  try {
    if (!existsSync(dir)) return { removed: 0 };
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    let removed = 0;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".dump")) continue;
      const p = join(dir, f);
      const st = statSync(p);
      if (st.mtimeMs < cutoff) { unlinkSync(p); removed++; }
    }
    return { removed };
  } catch { return { removed: 0 }; }
}

async function main() {
  const t0 = Date.now();
  const url = readPgUrl();
  await emitFW("scheduled_task_triggered", "info", "pg_dump backup starting", {});
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(BACKUP_DIR, `nex_dev_${stamp}.dump`);
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
  try {
    log(`starting pg_dump → ${outPath}`);
    await runPgDump(url, outPath);
    const st = statSync(outPath);
    const sha = await sha256File(outPath);
    log(`✓ pg_dump ${st.size.toLocaleString()} bytes · sha256 ${sha.slice(0, 16)}…`);
    await emitFW("knowledge_stored", "ok", `backup ${st.size.toLocaleString()} bytes written`,
      { path: outPath, bytes: st.size, sha256: sha });
    // Upload
    const remoteKey = `daily/${stamp}.dump`;
    const up = await uploadToMinio(outPath, remoteKey);
    if (up.ok) {
      log(`✓ uploaded to minio://${MINIO_BUCKET}/${remoteKey}`);
      await emitFW("knowledge_stored", "ok", `backup mirrored to MinIO`,
        { remote: `minio://${MINIO_BUCKET}/${remoteKey}`, method: up.method });
    } else {
      log(`⊘ MinIO upload skipped: ${up.reason}`);
      await emitFW("agent_failed", "warning", `MinIO upload skipped: ${up.reason}`, {});
    }
    // Prune
    const p = prune(BACKUP_DIR, RETENTION_DAYS);
    if (p.removed) log(`  pruned ${p.removed} old backups`);
    await emitFW("scheduled_task_completed", "ok",
      `backup ok · ${(st.size / 1024 / 1024).toFixed(1)}MB · retention ${RETENTION_DAYS}d`,
      { bytes: st.size, sha256: sha, pruned: p.removed, duration_ms: Date.now() - t0 });
  } catch (err) {
    log(`✗ backup failed: ${String(err).slice(0, 300)}`);
    await emitFW("agent_failed", "error", `backup failed: ${String(err).slice(0, 200)}`, {});
    process.exit(1);
  }
}

main();
