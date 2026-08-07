// GET /api/nex/storage/overview — NEX Storage headquarters aggregator
//
// One endpoint feeds the /nex-app/nex-brain/nex-storage dashboard. Composes:
//   · adapter registry state (current backend · known providers · mode)
//   · Postgres server info (version · host · port · uptime · extensions)
//     — only when the postgres adapter is active
//   · env-var status (which storage-related vars are set) with SAFE masking
//     — service_role keys / passwords NEVER returned in cleartext
//   · schema footprint (nex.* table count · migration files present on disk)
//   · object-manifest snapshot (files tracked · total bytes · buckets)
//
// SECURITY
//   · Only the presence of secrets is exposed, never their value.
//   · Even in dev, secrets return `masked: true` with the last 4 chars only.
//   · Non-secret config (URLs, hosts, ports, backend name) returned verbatim.

import { NextResponse } from "next/server";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getStorage, getStorageForParity } from "@/lib/nex/storage/registry";
import { isPostgresHealthy } from "@/lib/nex/storage/adapters/postgres";
import { COLLECTIONS } from "@/lib/nex/storage/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Env vars the storage layer + adapters actually read. Anything with
// `secret: true` is masked in the response.
const TRACKED_ENV = [
  { name: "NEX_STORAGE_BACKEND", secret: false, purpose: "Which adapter the registry picks" },
  { name: "NEX_POSTGRES_URL", secret: true, purpose: "Postgres adapter connection string · contains password" },
  { name: "PGPASSWORD", secret: true, purpose: "Fallback Postgres password when NEX_POSTGRES_URL has none" },
  { name: "NODE_ENV", secret: false, purpose: "Runtime environment" },
  { name: "SUPABASE_URL", secret: false, purpose: "Legacy trades Supabase URL · not used by NEX Storage Layer" },
  { name: "NEXT_PUBLIC_SUPABASE_URL", secret: false, purpose: "Same as above · exposed to browser" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", secret: true, purpose: "Legacy trades Supabase service role" },
  { name: "NEX_SUPABASE_URL", secret: false, purpose: "Legacy NEX Supabase project URL" },
  { name: "NEX_SUPABASE_SERVICE_ROLE_KEY", secret: true, purpose: "Legacy NEX Supabase service role" },
] as const;

// Adapters the registry knows about. `active` set below based on
// NEX_STORAGE_BACKEND. Adding a new adapter = one entry here.
const KNOWN_ADAPTERS = [
  { id: "jsonl",      label: "JSONL (filesystem)",  status: "supported", swappable: true },
  { id: "postgres",   label: "PostgreSQL 17/18",    status: "supported", swappable: true },
  { id: "dual-write", label: "Dual-Write (parity)", status: "supported", swappable: true, note: "Writes to both · reads from primary" },
  { id: "sqlite",     label: "SQLite",               status: "planned",   swappable: true },
  { id: "mysql",      label: "MySQL / MariaDB",     status: "planned",   swappable: true },
  { id: "mongodb",    label: "MongoDB",             status: "planned",   swappable: true },
  { id: "redis",      label: "Redis",               status: "planned",   swappable: true, note: "Cache tier" },
] as const;

const KNOWN_OBJECT_STORES = [
  { id: "filesystem",    label: "Local filesystem",   status: "supported" },
  { id: "supabase",      label: "Supabase Storage",   status: "supported", note: "Legacy · used by trades platform" },
  { id: "s3",            label: "AWS S3",             status: "planned" },
  { id: "r2",            label: "Cloudflare R2",      status: "planned" },
  { id: "minio",         label: "MinIO",               status: "planned",  note: "Self-hosted S3-compatible" },
  { id: "azure-blob",    label: "Azure Blob",         status: "planned" },
  { id: "gcs",           label: "Google Cloud Storage", status: "planned" },
] as const;

function maskSecret(v: string): { present: true; last4: string; length: number; masked: true } {
  return { present: true, last4: v.slice(-4), length: v.length, masked: true };
}

function safeUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  // Strip password from postgres/supabase connection strings.
  return raw.replace(/:[^:@/]+@/, ":***@");
}

export async function GET() {
  const store = getStorage();
  const { primary, secondary } = getStorageForParity();

  // ── Env var visibility (masked for secrets) ────────────────────
  const env = TRACKED_ENV.map((e) => {
    const raw = process.env[e.name];
    if (!raw) return { name: e.name, purpose: e.purpose, secret: e.secret, present: false };
    if (e.secret) return { name: e.name, purpose: e.purpose, secret: true, ...maskSecret(raw) };
    // Non-secret · return the value but mask connection strings
    const isUrl = raw.startsWith("postgres") || raw.startsWith("http");
    return {
      name: e.name,
      purpose: e.purpose,
      secret: false,
      present: true,
      value: isUrl ? safeUrl(raw) : raw,
    };
  });

  // ── Adapter registry state ────────────────────────────────────
  const backendId = (process.env.NEX_STORAGE_BACKEND ?? "jsonl").toLowerCase();
  const adapters = KNOWN_ADAPTERS.map((a) => ({
    ...a,
    active: a.id === backendId,
  }));

  // ── Postgres server info (only when postgres is in use) ────────
  let postgres: {
    healthy: boolean;
    detail: string | null;
    version: string | null;
    host: string | null;
    port: number | null;
    database: string | null;
    latency_ms: number | null;
    extensions: string[];
    nex_table_count: number;
  } | null = null;

  const usingPostgres = primary.name === "postgres" || secondary?.name === "postgres";
  if (usingPostgres && process.env.NEX_POSTGRES_URL) {
    postgres = await probePostgres(process.env.NEX_POSTGRES_URL);
  }

  // ── Object storage / manifest snapshot ─────────────────────────
  let objectStorage: {
    manifest_rows: number;
    total_bytes: number | null;
    latest_upload_at: string | null;
    buckets: number;
    error: string | null;
  } = { manifest_rows: 0, total_bytes: null, latest_upload_at: null, buckets: 0, error: null };
  try {
    const stats = await primary.stats(COLLECTIONS.object_manifest);
    const rows = await primary.query<{ bucket?: string }>(COLLECTIONS.object_manifest, { limit: 10000 });
    const buckets = new Set(rows.map((r) => r.bucket).filter(Boolean)).size;
    objectStorage = {
      manifest_rows: stats.total_records,
      total_bytes: null, // needs a schema addition to sum size_bytes efficiently — flagged not-instrumented
      latest_upload_at: stats.latest_write_at,
      buckets,
      error: null,
    };
  } catch (err) {
    objectStorage.error = err instanceof Error ? err.message : "unknown";
  }

  // ── Schema files on disk (deploy/postgres/init) ────────────────
  const initDir = join(process.cwd(), "deploy", "postgres", "init");
  const bootstrapDir = join(process.cwd(), "deploy", "postgres", "bootstrap");
  const schema = {
    init_files: existsSync(initDir) ? readdirSync(initDir).filter((f) => f.endsWith(".sql")).sort() : [],
    bootstrap_files: existsSync(bootstrapDir) ? readdirSync(bootstrapDir).filter((f) => f.endsWith(".sql")).sort() : [],
  };

  return NextResponse.json({
    ok: true,
    backend: {
      primary: primary.name,
      secondary: secondary?.name ?? null,
      mode: secondary ? "dual-write" : "single-backend",
      configured_via: "NEX_STORAGE_BACKEND",
    },
    postgres,
    env,
    adapters,
    object_stores: KNOWN_OBJECT_STORES,
    object_storage_state: objectStorage,
    schema,
    node_env: process.env.NODE_ENV ?? "unknown",
    dev_mode: process.env.NODE_ENV !== "production",
    generated_at: new Date().toISOString(),
  });
}

async function probePostgres(url: string) {
  let pg: unknown;
  try {
    pg = await import("pg" as string);
  } catch {
    return {
      healthy: false,
      detail: "`pg` package not installed",
      version: null,
      host: null,
      port: null,
      database: null,
      latency_ms: null,
      extensions: [],
      nex_table_count: 0,
    };
  }
  const { Pool } = ((pg as { default?: unknown }).default ?? pg) as {
    Pool: new (config: { connectionString: string; ssl?: { rejectUnauthorized: boolean } | boolean }) => {
      query: (t: string) => Promise<{ rows: Record<string, unknown>[] }>;
      end: () => Promise<void>;
    };
  };
  const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
  const pool = new Pool({
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  const start = Date.now();
  try {
    const [ver, ext, tables] = await Promise.all([
      pool.query("SELECT version() AS v, current_database() AS db, inet_server_addr()::text AS host, inet_server_port() AS port"),
      pool.query("SELECT extname FROM pg_extension ORDER BY extname"),
      pool.query("SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'nex'"),
    ]);
    const latency = Date.now() - start;
    const parsedUrl = new URL(url);
    return {
      healthy: true,
      detail: null,
      version: (ver.rows[0]?.v as string | undefined) ?? null,
      host: parsedUrl.hostname,
      port: Number(parsedUrl.port) || 5432,
      database: (ver.rows[0]?.db as string | undefined) ?? parsedUrl.pathname.slice(1),
      latency_ms: latency,
      extensions: ext.rows.map((r) => String(r.extname)),
      nex_table_count: Number(tables.rows[0]?.n ?? 0),
    };
  } catch (err) {
    return {
      healthy: false,
      detail: err instanceof Error ? err.message : "unknown",
      version: null,
      host: null,
      port: null,
      database: null,
      latency_ms: null,
      extensions: [],
      nex_table_count: 0,
    };
  } finally {
    await pool.end().catch(() => {});
  }
}
