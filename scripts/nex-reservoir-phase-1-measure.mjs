#!/usr/bin/env node
// scripts/nex-reservoir-phase-1-measure.mjs
//
// FOUNDER BEGIN · RESERVOIR-PHASE-1-ACCOMMODATION · MEASUREMENT PHASE
// Author: NEX Master AI Engineer · 2026-09-08
//
// Read-only measurement of the CURRENT Wave 11 substrate before any additive
// build. Zero mutation. Zero write to any production path. Produces a JSON
// report + prints a human-readable summary.
//
// Founder mandate: "Measure the existing substrate first." Every number is
// labelled MEASURED / DOCUMENTED / MODELED / ESTIMATED / UNKNOWN.
//
// Outputs:
//   data/reservoir-phase-1/measurements/measurement_{isoStamp}.json (immutable)
//   Stdout human-readable summary

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

// Inner re-exec pattern (mirrors nex-l4-bakeoff-v5-4-5-*.mjs)
// Loads .env.local before inner runs so env vars are visible.
if (!process.env.NEX_MEASURE_INNER) {
  const { spawn } = await import("node:child_process");
  const envFileArgs = fs.existsSync(path.join(repoRoot, ".env.local"))
    ? ["--env-file=.env.local"] : [];
  const child = spawn(
    "node",
    [...envFileArgs, entryFile, ...process.argv.slice(2)],
    {
      stdio: "inherit",
      cwd: repoRoot,
      env: { ...process.env, NEX_MEASURE_INNER: "1" },
      shell: false,
    },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const startedAtIso = new Date().toISOString();
  const startedAtEpochMs = Date.now();

  console.log("═".repeat(72));
  console.log("NEX MASTER AI ENGINEER · RESERVOIR PHASE 1 · MEASUREMENT PHASE");
  console.log("═".repeat(72));
  console.log(`Started (ISO)            : ${startedAtIso}`);
  console.log(`Repo root                : ${repoRoot}`);
  console.log(`NEX_OBJECT_BACKEND       : ${process.env.NEX_OBJECT_BACKEND ?? "(unset · defaults filesystem)"}`);
  console.log(`NEX_BRAIN_BACKEND        : ${process.env.NEX_BRAIN_BACKEND ?? "(unset)"}`);
  console.log(`NEX_INBOX_SHADOW_POSTGRES: ${process.env.NEX_INBOX_SHADOW_POSTGRES ?? "(unset)"}`);
  console.log(`NEX_POSTGRES_URL         : ${process.env.NEX_POSTGRES_URL ? "SET (redacted)" : "UNSET"}`);
  console.log("═".repeat(72));

  const report = {
    label: "V5.4.6-AUTH-RESERVOIR-PHASE-1-MEASURE-001",
    schema_version: "v1.0",
    started_at_iso: startedAtIso,
    completed_at_iso: null,
    duration_ms: null,
    hostname: (await import("node:os")).hostname(),
    node_version: process.version,
    env_summary: {
      NEX_OBJECT_BACKEND: process.env.NEX_OBJECT_BACKEND ?? null,
      NEX_BRAIN_BACKEND: process.env.NEX_BRAIN_BACKEND ?? null,
      NEX_INBOX_SHADOW_POSTGRES: process.env.NEX_INBOX_SHADOW_POSTGRES ?? null,
      NEX_INBOX_READ_BACKEND: process.env.NEX_INBOX_READ_BACKEND ?? null,
      NEX_POSTGRES_URL_present: !!process.env.NEX_POSTGRES_URL,
    },
    measurements: {
      master_ai_ledgers: null,
      nex_objects_filesystem: null,
      l4_bakeoff_runs: null,
      l4_bakeoff_transcripts: null,
      l4_bakeoff_rescores: null,
      postgres_accommodation: null,
      postgres_object_blobs: null,
      postgres_knowledge_inbox: null,
      ollama_health: null,
      key_file_hashes: null,
      filesystem_read_latency_samples: null,
    },
    labels_used: ["MEASURED", "DOCUMENTED", "MODELED", "ESTIMATED", "UNKNOWN"],
    final_status: null, // Op-Truth §OP.5 · Founder-verifier
  };

  // ═══════════════════════════════════════════════════════════════
  // §1 · Master AI ledgers · directory scan (MEASURED)
  // ═══════════════════════════════════════════════════════════════
  console.log("");
  console.log("§1 · MASTER AI LEDGERS (MEASURED · line-count per JSONL)");
  console.log("─".repeat(72));
  const masterAiDir = path.join(repoRoot, "data", "master-ai");
  if (!fs.existsSync(masterAiDir)) {
    report.measurements.master_ai_ledgers = { present: false, label: "UNKNOWN", reason: "directory_missing" };
    console.log("  UNKNOWN · data/master-ai/ missing");
  } else {
    const files = fs.readdirSync(masterAiDir).filter((f) => f.endsWith(".jsonl") || f.endsWith(".json"));
    const details = [];
    let totalBytes = 0;
    let totalLines = 0;
    for (const f of files) {
      const abs = path.join(masterAiDir, f);
      const stat = fs.statSync(abs);
      const bytes = stat.size;
      let lines = 0;
      if (f.endsWith(".jsonl")) {
        // Fast line count via streamed newline scan (avoids full-file JSON parse)
        const buf = fs.readFileSync(abs);
        for (let i = 0; i < buf.length; i++) if (buf[i] === 0x0a) lines++;
        // Last line may not end in newline — check
        if (buf.length > 0 && buf[buf.length - 1] !== 0x0a) lines++;
      }
      details.push({ file: f, bytes, jsonl_lines: f.endsWith(".jsonl") ? lines : null, mtime_iso: stat.mtime.toISOString() });
      totalBytes += bytes;
      totalLines += lines;
    }
    details.sort((a, b) => b.bytes - a.bytes);
    report.measurements.master_ai_ledgers = {
      present: true,
      label: "MEASURED",
      file_count: files.length,
      total_bytes: totalBytes,
      total_jsonl_lines: totalLines,
      top_20_by_size: details.slice(0, 20),
      all_files: details,
    };
    console.log(`  files    : ${files.length}`);
    console.log(`  bytes    : ${totalBytes.toLocaleString()} (${(totalBytes/1024/1024).toFixed(2)} MB)`);
    console.log(`  jsonl_ln : ${totalLines.toLocaleString()} lines across .jsonl files`);
    console.log("  top 5 by size:");
    for (const d of details.slice(0, 5)) {
      console.log(`    ${(d.bytes/1024).toFixed(1).padStart(9)} KB · ${String(d.jsonl_lines ?? "-").padStart(6)} lines · ${d.file}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // §2 · Filesystem object store (MEASURED)
  // ═══════════════════════════════════════════════════════════════
  console.log("");
  console.log("§2 · FILESYSTEM OBJECT STORE (MEASURED · data/nex-objects/)");
  console.log("─".repeat(72));
  const nexObjectsDir = path.join(repoRoot, "data", "nex-objects");
  if (!fs.existsSync(nexObjectsDir)) {
    report.measurements.nex_objects_filesystem = { present: false, label: "UNKNOWN", reason: "directory_missing" };
    console.log("  UNKNOWN · data/nex-objects/ missing (filesystem adapter never wrote or purged)");
  } else {
    const buckets = fs.readdirSync(nexObjectsDir).filter((b) => fs.statSync(path.join(nexObjectsDir, b)).isDirectory());
    let totalObjects = 0;
    let totalBytes = 0;
    let currentPointerCount = 0;
    const bucketDetails = [];
    for (const bucket of buckets) {
      const bDir = path.join(nexObjectsDir, bucket);
      let bObjects = 0;
      let bBytes = 0;
      let bCurrent = 0;
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const abs = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(abs);
          else if (entry.isFile()) {
            const stat = fs.statSync(abs);
            bBytes += stat.size;
            if (entry.name === "current" || entry.name.endsWith(".current")) bCurrent++;
            else if (!entry.name.endsWith(".meta")) bObjects++;
          }
        }
      };
      walk(bDir);
      bucketDetails.push({ bucket, versioned_objects: bObjects, current_pointers: bCurrent, bytes: bBytes });
      totalObjects += bObjects;
      totalBytes += bBytes;
      currentPointerCount += bCurrent;
    }
    const avgSize = totalObjects > 0 ? totalBytes / totalObjects : 0;
    report.measurements.nex_objects_filesystem = {
      present: true,
      label: "MEASURED",
      buckets: bucketDetails,
      total_versioned_objects: totalObjects,
      total_current_pointers: currentPointerCount,
      total_bytes: totalBytes,
      average_versioned_object_size_bytes: Math.round(avgSize),
      note: "Bytes include versioned objects + .meta + .current sidecars. Filesystem is the reference adapter but NEX_OBJECT_BACKEND=postgres in production.",
    };
    console.log(`  buckets                : ${buckets.length} (${buckets.join(", ") || "(none)"})`);
    console.log(`  versioned objects      : ${totalObjects.toLocaleString()}`);
    console.log(`  current pointers       : ${currentPointerCount.toLocaleString()}`);
    console.log(`  total bytes on disk    : ${totalBytes.toLocaleString()} (${(totalBytes/1024/1024).toFixed(2)} MB)`);
    console.log(`  avg versioned obj size : ${Math.round(avgSize).toLocaleString()} bytes`);
    console.log(`  (backend today         : ${process.env.NEX_OBJECT_BACKEND ?? "filesystem-default"} · filesystem is reference)`);
  }

  // ═══════════════════════════════════════════════════════════════
  // §3 · L4 bakeoff artefacts (MEASURED)
  // ═══════════════════════════════════════════════════════════════
  console.log("");
  console.log("§3 · L4 BAKEOFF ARTEFACTS (MEASURED)");
  console.log("─".repeat(72));

  const bakeoffRunsDir = path.join(repoRoot, "data", "l4-bakeoff", "runs");
  const bakeoffTranscriptsDir = path.join(repoRoot, "data", "l4-bakeoff", "transcripts");
  const bakeoffRescoresDir = path.join(repoRoot, "data", "l4-bakeoff", "rescores");

  const scanDir = (dir, opts = {}) => {
    if (!fs.existsSync(dir)) return { present: false, label: "UNKNOWN", reason: "directory_missing" };
    const files = [];
    const walk = (d) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const abs = path.join(d, entry.name);
        if (entry.isDirectory() && opts.recursive !== false) walk(abs);
        else if (entry.isFile()) {
          const stat = fs.statSync(abs);
          files.push({ path: path.relative(dir, abs), bytes: stat.size, mtime_iso: stat.mtime.toISOString() });
        }
      }
    };
    walk(dir);
    const totalBytes = files.reduce((s, f) => s + f.bytes, 0);
    return { present: true, label: "MEASURED", file_count: files.length, total_bytes: totalBytes, top_5_recent: files.sort((a,b) => b.mtime_iso.localeCompare(a.mtime_iso)).slice(0, 5) };
  };

  report.measurements.l4_bakeoff_runs = scanDir(bakeoffRunsDir);
  report.measurements.l4_bakeoff_transcripts = scanDir(bakeoffTranscriptsDir);
  report.measurements.l4_bakeoff_rescores = scanDir(bakeoffRescoresDir);
  console.log(`  runs        : ${report.measurements.l4_bakeoff_runs.file_count ?? "n/a"} files · ${((report.measurements.l4_bakeoff_runs.total_bytes ?? 0)/1024).toFixed(1)} KB`);
  console.log(`  transcripts : ${report.measurements.l4_bakeoff_transcripts.file_count ?? "n/a"} files · ${((report.measurements.l4_bakeoff_transcripts.total_bytes ?? 0)/1024).toFixed(1)} KB`);
  console.log(`  rescores    : ${report.measurements.l4_bakeoff_rescores.file_count ?? "n/a"} files · ${((report.measurements.l4_bakeoff_rescores.total_bytes ?? 0)/1024).toFixed(1)} KB`);

  // Confirm anchor transcript from V.5.4.3-002 is present
  const anchorRunPath = path.join(bakeoffRunsDir, "l4run_c341d462-fb78-45e3-8881-3a5325fe462d.json");
  if (fs.existsSync(anchorRunPath)) {
    const hash = crypto.createHash("sha256").update(fs.readFileSync(anchorRunPath)).digest("hex").slice(0, 24);
    console.log(`  anchor run  : c341d462 PRESENT · sha256[:24]=${hash}`);
    report.measurements.l4_bakeoff_runs.anchor_c341d462_sha24 = hash;
  } else {
    console.log(`  anchor run  : c341d462 MISSING (expected · V.5.4.3-002 evidence)`);
  }

  // ═══════════════════════════════════════════════════════════════
  // §4 · Postgres substrate probes (MEASURED where reachable · UNKNOWN otherwise)
  // ═══════════════════════════════════════════════════════════════
  console.log("");
  console.log("§4 · POSTGRES SUBSTRATE PROBES");
  console.log("─".repeat(72));

  if (!process.env.NEX_POSTGRES_URL) {
    console.log("  UNKNOWN · NEX_POSTGRES_URL unset · Postgres probes skipped");
    report.measurements.postgres_accommodation = { label: "UNKNOWN", reason: "NEX_POSTGRES_URL_unset" };
    report.measurements.postgres_object_blobs = { label: "UNKNOWN", reason: "NEX_POSTGRES_URL_unset" };
    report.measurements.postgres_knowledge_inbox = { label: "UNKNOWN", reason: "NEX_POSTGRES_URL_unset" };
  } else {
    let pgLib = null;
    try {
      pgLib = await import("pg");
    } catch (e) {
      console.log("  UNKNOWN · pg module not available in current node_modules");
      report.measurements.postgres_accommodation = { label: "UNKNOWN", reason: "pg_module_unavailable", error: e.message };
      report.measurements.postgres_object_blobs = { label: "UNKNOWN", reason: "pg_module_unavailable" };
      report.measurements.postgres_knowledge_inbox = { label: "UNKNOWN", reason: "pg_module_unavailable" };
    }
    if (pgLib) {
      const { Pool } = pgLib.default ?? pgLib;
      const pool = new Pool({ connectionString: process.env.NEX_POSTGRES_URL, connectionTimeoutMillis: 8000, max: 2 });
      const probeQuery = async (label, sql, params = []) => {
        const t0 = performance.now();
        try {
          const res = await pool.query(sql, params);
          const ms = performance.now() - t0;
          return { label: "MEASURED", rows: res.rows, row_count: res.rowCount, latency_ms: Math.round(ms * 100) / 100, sql };
        } catch (e) {
          const ms = performance.now() - t0;
          return { label: "UNKNOWN", error: e.message, latency_ms: Math.round(ms * 100) / 100, sql };
        }
      };
      // Accommodation
      report.measurements.postgres_accommodation = await probeQuery(
        "accommodation",
        `SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE claim_status IN ('listed','invited','claimed','paying'))::text AS visible,
          COUNT(*) FILTER (WHERE claim_status = 'listed')::text AS listed,
          COUNT(*) FILTER (WHERE claim_status = 'claimed')::text AS claimed,
          COUNT(*) FILTER (WHERE claim_status = 'paying')::text AS paying,
          COUNT(DISTINCT city)::text AS distinct_cities,
          COUNT(*) FILTER (WHERE coordinates_lat IS NOT NULL)::text AS with_coords
        FROM nex.accommodation_business`,
      );
      if (report.measurements.postgres_accommodation.label === "MEASURED") {
        const r = report.measurements.postgres_accommodation.rows[0];
        console.log(`  accommodation_business    : total=${r.total} · visible=${r.visible} · listed=${r.listed} · claimed=${r.claimed} · paying=${r.paying} · distinct_cities=${r.distinct_cities} · with_coords=${r.with_coords} · ${report.measurements.postgres_accommodation.latency_ms} ms`);
      } else {
        console.log(`  accommodation_business    : UNKNOWN · ${report.measurements.postgres_accommodation.error}`);
      }
      // Object blobs
      report.measurements.postgres_object_blobs = await probeQuery(
        "object_blobs",
        `SELECT
          COUNT(*)::text AS versions,
          COALESCE(SUM(octet_length(body))::text, '0') AS total_body_bytes,
          COUNT(DISTINCT bucket)::text AS distinct_buckets,
          COUNT(DISTINCT (bucket, key))::text AS distinct_keys,
          COALESCE(AVG(octet_length(body))::int::text, '0') AS avg_body_bytes,
          COALESCE(MAX(octet_length(body))::text, '0') AS max_body_bytes
        FROM nex.object_blobs`,
      );
      if (report.measurements.postgres_object_blobs.label === "MEASURED") {
        const r = report.measurements.postgres_object_blobs.rows[0];
        console.log(`  object_blobs              : versions=${r.versions} · distinct_keys=${r.distinct_keys} · buckets=${r.distinct_buckets} · body_bytes=${r.total_body_bytes} (avg=${r.avg_body_bytes} max=${r.max_body_bytes}) · ${report.measurements.postgres_object_blobs.latency_ms} ms`);
      } else {
        console.log(`  object_blobs              : UNKNOWN · ${report.measurements.postgres_object_blobs.error}`);
      }
      // object_blob_current (dedup indicator)
      const currentProbe = await probeQuery("object_blob_current",
        `SELECT COUNT(*)::text AS current_rows FROM nex.object_blob_current`);
      report.measurements.postgres_object_blobs.object_blob_current = currentProbe;
      if (currentProbe.label === "MEASURED") {
        console.log(`  object_blob_current       : ${currentProbe.rows[0].current_rows} rows · ${currentProbe.latency_ms} ms`);
      }
      // Knowledge inbox (Wave 11 shadow-write target)
      report.measurements.postgres_knowledge_inbox = await probeQuery(
        "knowledge_inbox",
        `SELECT COUNT(*)::text AS total, COUNT(DISTINCT source)::text AS sources FROM nex.knowledge_inbox`,
      );
      if (report.measurements.postgres_knowledge_inbox.label === "MEASURED") {
        const r = report.measurements.postgres_knowledge_inbox.rows[0];
        console.log(`  knowledge_inbox           : total=${r.total} · distinct_sources=${r.sources} · ${report.measurements.postgres_knowledge_inbox.latency_ms} ms`);
      } else {
        console.log(`  knowledge_inbox           : UNKNOWN · ${report.measurements.postgres_knowledge_inbox.error}`);
      }
      // Simple sample-read latency probe · 5 sequential reads of a small row
      const sampleReads = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        try {
          await pool.query("SELECT 1 AS ping");
          sampleReads.push({ ok: true, ms: Math.round((performance.now() - t0) * 100) / 100 });
        } catch (e) {
          sampleReads.push({ ok: false, error: e.message });
        }
      }
      report.measurements.filesystem_read_latency_samples = sampleReads;
      const okReads = sampleReads.filter((s) => s.ok);
      if (okReads.length > 0) {
        const median = okReads.map((r) => r.ms).sort((a,b) => a-b)[Math.floor(okReads.length/2)];
        console.log(`  pg SELECT 1 ping (n=${okReads.length}) : median=${median} ms · samples=${okReads.map((r) => r.ms).join(",")}`);
      }
      await pool.end();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // §5 · Ollama health probe (MEASURED where reachable · UNKNOWN otherwise)
  // ═══════════════════════════════════════════════════════════════
  console.log("");
  console.log("§5 · OLLAMA LOCAL INFERENCE HEALTH");
  console.log("─".repeat(72));
  const ollamaUrl = process.env.NEX_RESPONSE_MODEL_URL ?? process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
  try {
    const t0 = performance.now();
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    const latency = Math.round((performance.now() - t0) * 100) / 100;
    if (res.ok) {
      const json = await res.json();
      const models = (json.models ?? []).map((m) => ({ name: m.name, size: m.size, digest: m.digest?.slice(0, 24), modified_at: m.modified_at }));
      report.measurements.ollama_health = { label: "MEASURED", reachable: true, url: ollamaUrl, latency_ms: latency, model_count: models.length, models };
      console.log(`  reachable            : YES · ${latency} ms`);
      console.log(`  url                  : ${ollamaUrl}`);
      console.log(`  models installed     : ${models.length}`);
      for (const m of models.slice(0, 10)) {
        console.log(`    ${m.name.padEnd(30)} · ${(m.size/1024/1024/1024).toFixed(2)} GB · digest=${m.digest ?? "?"}`);
      }
    } else {
      report.measurements.ollama_health = { label: "UNKNOWN", reachable: false, url: ollamaUrl, http_status: res.status };
      console.log(`  reachable            : NO · HTTP ${res.status}`);
    }
  } catch (e) {
    report.measurements.ollama_health = { label: "UNKNOWN", reachable: false, url: ollamaUrl, error: e.message };
    console.log(`  reachable            : NO · ${e.message}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // §6 · Key file SHA-256 for provenance (MEASURED)
  // ═══════════════════════════════════════════════════════════════
  console.log("");
  console.log("§6 · KEY FILE HASHES (MEASURED · content_hash SHA-256[:24] for provenance)");
  console.log("─".repeat(72));
  const keyFiles = [
    "src/lib/nex/storage/object-registry.ts",
    "src/lib/nex/storage/adapters/object-postgres.ts",
    "src/lib/nex/storage/adapters/object-r2.ts",
    "src/lib/nex/storage/adapters/object-filesystem.ts",
    "src/lib/nex/master-ai/paths.ts",
    "src/lib/nex/master-ai/knowledge-ledger.ts",
    "src/lib/nex/master-ai/offline-reservoir.ts",
    "src/lib/nex/master-ai/learning-cycle.ts",
    "src/lib/nex/agent-runtime/worker-accommodation.ts",
    "src/lib/nex/brain/world-adapters/accommodation-postgres.ts",
    "src/lib/nex/brain/orchestrate.ts",
    "src/lib/nex/brain/provider.ts",
    "src/lib/nex/brain/providers/ollama.ts",
    "src/lib/nex/brain/model-registry.ts",
    "src/lib/nex/context.ts",
    "src/lib/nex/context-management/cache-breakpoints.ts",
    "src/lib/nex/semantic-memory/rag-pipeline.ts",
    "src/lib/nex/l4-bakeoff/hybrid-scoring-v1.ts",
    "src/lib/nex/l4-bakeoff/known-answer-registry-v1.ts",
  ];
  const hashes = [];
  for (const rel of keyFiles) {
    const abs = path.join(repoRoot, rel);
    if (fs.existsSync(abs)) {
      const buf = fs.readFileSync(abs);
      const h = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 24);
      hashes.push({ file: rel, sha256_24: h, bytes: buf.length });
    } else {
      hashes.push({ file: rel, sha256_24: null, bytes: null, note: "missing" });
    }
  }
  report.measurements.key_file_hashes = { label: "MEASURED", hashes };
  for (const h of hashes) {
    if (h.sha256_24) {
      console.log(`  ${h.sha256_24} · ${(h.bytes ?? 0).toString().padStart(7)} B · ${h.file}`);
    } else {
      console.log(`  MISSING · ${h.file}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // §7 · Persist immutable measurement record (Op-Truth §OP.5)
  // ═══════════════════════════════════════════════════════════════
  const outDir = path.join(repoRoot, "data", "reservoir-phase-1", "measurements");
  fs.mkdirSync(outDir, { recursive: true });
  const stampSafe = startedAtIso.replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `measurement_${stampSafe}.json`);

  report.completed_at_iso = new Date().toISOString();
  report.duration_ms = Date.now() - startedAtEpochMs;

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("");
  console.log("═".repeat(72));
  console.log("MEASUREMENT COMPLETE");
  console.log("═".repeat(72));
  console.log(`Immutable record   : ${path.relative(repoRoot, outPath)}`);
  console.log(`Duration           : ${report.duration_ms} ms`);
  console.log(`final_status       : ${report.final_status ?? "null (Founder-verifier per Op-Truth §OP.5)"}`);
  console.log("");
  process.exit(0);
}
