#!/usr/bin/env node
// scripts/batch-reclassify-unclassified.mjs
//
// Re-runs every currently-unclassified manifest row through the save
// endpoint so the ADR-0030 parseWithInheritance pipeline + updated
// classifier (staircase-family HARD LAWs) assign each row a
// primary_brain, knowledge_band, master_image_score, collection
// memberships, family_tree scaffold, and any inheritance signals.
//
// Cost: $0. No vision API calls. Purely local classifier + pipeline.
//
// Concurrency: 6 parallel POSTs to keep the local dev server busy
// without saturating it. Progress logged every 50 rows.

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";
const CONCURRENCY = 6;
const PROGRESS_EVERY = 50;

const manifestPath = path.join(process.cwd(), "data", "nex-image-manifest.json");

function snapshot(manifest) {
  const rows = Object.values(manifest.images);
  const brains = {};
  const bands = {};
  let scoreSum = 0, scored = 0;
  for (const r of rows) {
    const b = r.primary_brain || "(unclassified)";
    brains[b] = (brains[b] || 0) + 1;
    const band = r.knowledge_band_label || "(no band)";
    bands[band] = (bands[band] || 0) + 1;
    const s = r.master_image_score?.master_score;
    if (typeof s === "number") { scoreSum += s; scored++; }
  }
  return {
    total: rows.length,
    brains,
    bands,
    avgScore: scored ? scoreSum / scored : 0,
    scored,
  };
}

function fmtDist(d) {
  return Object.entries(d)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => "    " + k.padEnd(24) + " " + v)
    .join("\n");
}

async function save(url, description, notes, source, created_by) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      images: {
        [url]: {
          description: description || "",
          source: source || "unknown",
          created_by: created_by || "batch_reclassify",
          notes: notes || "",
        },
      },
    }),
  });
  const data = await res.json().catch(() => ({ ok: false, error: "invalid_json" }));
  return { ok: !!data.ok, error: data.error };
}

async function runPool(tasks, concurrency, onProgress) {
  const results = new Array(tasks.length);
  let i = 0;
  let completed = 0;
  const worker = async () => {
    while (true) {
      const idx = i++;
      if (idx >= tasks.length) return;
      try {
        results[idx] = await tasks[idx]();
      } catch (e) {
        results[idx] = { ok: false, error: e.message };
      }
      completed++;
      if (completed % PROGRESS_EVERY === 0 || completed === tasks.length) {
        onProgress(completed, tasks.length);
      }
    }
  };
  const workers = Array.from({ length: concurrency }, worker);
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log("=== NEX Batch Reclassify ===\n");

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const before = snapshot(manifest);
  console.log("BEFORE:");
  console.log("  total rows:      ", before.total);
  console.log("  avg score:       ", before.avgScore.toFixed(1), "/ 100 (", before.scored, "scored )");
  console.log("  brain distribution:");
  console.log(fmtDist(before.brains));
  console.log("  band distribution:");
  console.log(fmtDist(before.bands));
  console.log("");

  const targets = Object.entries(manifest.images)
    .filter(([, row]) => !row.primary_brain)
    .map(([url, row]) => ({
      url,
      description: row.description || row.master_description || "",
      notes: row.notes || "",
      source: row.source || "unknown",
      created_by: row.created_by || "batch_reclassify",
    }));

  console.log("Targets to reprocess:", targets.length);
  console.log("Concurrency:         ", CONCURRENCY);
  console.log("Progress every:      ", PROGRESS_EVERY, "rows");
  console.log("");

  const tasks = targets.map((t) => () => save(t.url, t.description, t.notes, t.source, t.created_by));
  const startedAt = Date.now();
  const results = await runPool(tasks, CONCURRENCY, (done, total) => {
    const elapsed = (Date.now() - startedAt) / 1000;
    const rate = done / elapsed;
    const remaining = ((total - done) / (rate || 0.001)).toFixed(0);
    console.log(`  ${done}/${total}  ·  ${rate.toFixed(1)} rows/s  ·  ~${remaining}s remaining`);
  });

  const okCount = results.filter((r) => r?.ok).length;
  const errCount = results.length - okCount;
  console.log("");
  console.log("Save result totals:");
  console.log("  OK:   ", okCount);
  console.log("  errs: ", errCount);
  if (errCount) {
    const sampleErrs = results.filter((r) => r && !r.ok).slice(0, 5);
    console.log("  sample errors:", sampleErrs.map((r) => r.error).join(", "));
  }
  console.log("");

  const after = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const post = snapshot(after);
  console.log("AFTER:");
  console.log("  total rows:      ", post.total);
  console.log("  avg score:       ", post.avgScore.toFixed(1), "/ 100 (", post.scored, "scored )");
  console.log("  brain distribution:");
  console.log(fmtDist(post.brains));
  console.log("  band distribution:");
  console.log(fmtDist(post.bands));
  console.log("");

  const delta = {};
  const allBrains = new Set([...Object.keys(before.brains), ...Object.keys(post.brains)]);
  for (const b of allBrains) delta[b] = (post.brains[b] || 0) - (before.brains[b] || 0);
  console.log("Brain delta (after − before):");
  console.log(fmtDist(delta));

  const elapsed = (Date.now() - startedAt) / 1000;
  console.log("");
  console.log("Elapsed:", elapsed.toFixed(1), "seconds");
  console.log("");
  console.log("Batch complete. Cost incurred: $0 (classifier + pipeline only).");
}

main().catch((e) => { console.error(e); process.exit(1); });
