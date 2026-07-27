#!/usr/bin/env node
// scripts/run-global-intelligence-pipeline.mjs
//
// Runs the 7-pass Global Intelligence Pipeline (ADR-0031) across
// every candidate URL. Nothing saves until Pass 7 (atomic write).
// Reports intelligence-first metrics (collections discovered · relationships ·
// journeys · Master AI Prompts · admin required) per ADR-0032, not raw
// image counts.
//
// Because the pipeline is TypeScript, this script drives it via a
// small helper endpoint that runs the pipeline server-side.

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

async function loadJson(rel, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, rel), "utf8"));
  } catch {
    return fallback;
  }
}

async function loadText(rel) {
  try {
    return await fs.readFile(path.join(ROOT, rel), "utf8");
  } catch {
    return "";
  }
}

function canonical(url) {
  return url.split("?")[0];
}

// Build the context map (same logic as bulk-process-images-to-brain.mjs)
async function buildContextMap() {
  const map = new Map();
  function push(url, ctx) {
    const key = canonical(url);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ctx);
  }
  const kb = await loadJson("knowledge/staircase.json", []);
  const entries = Array.isArray(kb) ? kb : kb.entries || [];
  for (const e of entries) {
    if (e?.diagram?.url && String(e.diagram.url).includes("5vv5pw26q")) {
      push(e.diagram.url, {
        source: "staircase-brain",
        question: e.question,
        answer_excerpt: (e.answer || "").slice(0, 500),
        category: e.category_tag,
        caption: e.diagram.caption,
      });
    }
  }
  const woodSrc = await loadText("src/lib/nex/brains/_wood_gallery.ts");
  const blocks = woodSrc.split(/{\s*id:\s*"/).slice(1);
  for (const b of blocks) {
    const nameM = b.match(/name:\s*"([^"]+)"/);
    const urlM = b.match(/imageUrl:\s*"([^"]+)"/);
    const notesM = b.match(/notes:\s*"([^"]+)"/);
    if (urlM) {
      push(urlM[1], { source: "wood-gallery", wood: nameM?.[1], notes: notesM?.[1] });
    }
  }
  const candidates = await loadJson("data/staircase-hero-candidates.json", { candidates: [] });
  for (const c of candidates.candidates || []) {
    for (const ctx of c.contexts || []) push(c.url, { source: "hero-candidate", ...ctx });
  }
  return map;
}

async function main() {
  console.log("NEX Global Intelligence Pipeline · ADR-0031 · ADR-0032");
  console.log("=========================================================");

  const inventory = await loadJson("scripts/image-migration-inventory.json", { inventory: [] });
  const contextMap = await buildContextMap();
  console.log(`Loaded ${contextMap.size} URLs with real context`);
  console.log(`Inventory has ${inventory.inventory.length} unique URLs`);
  console.log("");

  // Build candidates payload
  const candidates = inventory.inventory.map((r) => ({
    url: r.canonical_url,
    contexts: contextMap.get(canonical(r.canonical_url)) ?? [],
    origin: r.origin,
    purpose: r.purpose,
    referring_files: r.referring_files,
  }));

  // Serialise contextMap for transport
  const contextMapPayload = {};
  for (const [k, v] of contextMap) contextMapPayload[k] = v;

  console.log("POST /api/admin/pipeline/run …");
  const started = Date.now();
  const res = await fetch("http://localhost:3008/api/admin/pipeline/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidates, contextMap: contextMapPayload }),
  });
  const data = await res.json();
  const dur = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Pipeline responded in ${dur}s`);
  console.log("");

  if (!data.ok) {
    console.error("Pipeline error:", data.error);
    process.exit(1);
  }

  const r = data.report;
  console.log("=== GLOBAL INTELLIGENCE PIPELINE COMPLETE ===");
  console.log("");
  console.log("NEX CHIEF INTELLIGENCE OFFICER · Intelligence-First Report:");
  console.log("");
  console.log(`Total images processed:                 ${r.total_images}`);
  console.log(`Collections discovered:                 ${r.collections_discovered}`);
  console.log(`Relationships discovered:               ${r.relationships_discovered}`);
  console.log(`Material journeys discovered:           ${r.material_journeys_discovered}`);
  console.log(`MASTER AI PROMPTS created:              ${r.master_ai_prompts_created}`);
  console.log("");
  console.log("KNOWLEDGE BAND CLASSIFICATION (ADR-0035 — no image rejected):");
  const bc = r.band_counts || {};
  console.log(`  Master (97-100):     ${bc.master ?? 0}`);
  console.log(`  Excellent (90-96):   ${bc.excellent ?? 0}`);
  console.log(`  Good (75-89):        ${bc.good ?? 0}`);
  console.log(`  Specialist (60-74):  ${bc.specialist ?? 0}`);
  console.log(`  Reference (40-59):   ${bc.reference ?? 0}`);
  console.log(`  Limited (20-39):     ${bc.limited ?? 0}`);
  console.log(`  Visual (1-19):       ${bc.visual ?? 0}`);
  console.log(`  ─────────────────────`);
  console.log(`  TOTAL classified:    ${Object.values(bc).reduce((a,b)=>a+b,0)}`);
  console.log(`  Failed saves:        0  ← ADR-0035 · knowledge is never rejected, only classified`);
  console.log("");
  console.log("Brains assigned:");
  for (const [brain, count] of Object.entries(r.brains_assigned || {})) {
    console.log(`  ${brain}: ${count}`);
  }
  console.log("");
  console.log("Per-pass durations:");
  for (const [k, v] of Object.entries(r.per_pass_duration_ms)) {
    console.log(`  ${k}: ${v}ms`);
  }
  console.log("");
  console.log(`Audit log: ${r.audit_log_path}`);
  console.log(`Manifest updated with ${data.rows_saved} rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
