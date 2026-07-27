#!/usr/bin/env node
// scripts/bulk-process-images-to-brain.mjs
//
// Constitution-compliant bulk processor. Reads every image URL in the
// inventory, assembles the richest MASTER DESCRIPTION possible from
// AVAILABLE data ONLY (no fabrication, no guesses, per ADR-0028), runs
// it through the parser + validation gate, writes the resulting
// knowledge row to data/nex-image-manifest.json.
//
// URLs with insufficient context are SKIPPED (not faked), per ADR-0029
// "NEVER create placeholder information · NEVER guess". Skipped URLs
// stay visible in the tagger for admin authoring.
//
// Usage:  node scripts/bulk-process-images-to-brain.mjs
//
// Output:
//   - data/nex-image-manifest.json updated
//   - console summary: processed · flagged · skipped
//
// Reference: ADR-0028 · ADR-0029 · ADR-0027 v1.2

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

// ── Build context map: URL → array of context blobs ─────────────

async function buildContextMap() {
  const map = new Map();
  function push(url, ctx) {
    const key = canonical(url);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ctx);
  }

  // 1. Staircase knowledge base (69 URLs with real Q+caption+category)
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
        alt: e.diagram.alt,
        classification: e.classification,
      });
    }
  }

  // 2. Wood gallery (8 real wood images with name + notes + country)
  const woodSrc = await loadText("src/lib/nex/brains/_wood_gallery.ts");
  const blocks = woodSrc.split(/{\s*id:\s*"/).slice(1);
  for (const b of blocks) {
    const idM = b.match(/^([^"]+)"/);
    const nameM = b.match(/name:\s*"([^"]+)"/);
    const countryM = b.match(/country:\s*"([^"]+)"/);
    const urlM = b.match(/imageUrl:\s*"([^"]+)"/);
    const notesM = b.match(/notes:\s*"([^"]+)"/);
    const strengthM = b.match(/strength:\s*"([^"]+)"/);
    const popularityM = b.match(/popularity:\s*"([^"]+)"/);
    if (urlM) {
      push(urlM[1], {
        source: "wood-gallery",
        wood: nameM?.[1],
        country: countryM?.[1],
        notes: notesM?.[1],
        strength: strengthM?.[1],
        popularity: popularityM?.[1],
        wood_id: idM?.[1],
      });
    }
  }

  // 3. Staircase-hero-candidates (has aggregated contexts)
  const candidates = await loadJson("data/staircase-hero-candidates.json", {
    candidates: [],
  });
  for (const c of candidates.candidates || []) {
    for (const ctx of c.contexts || []) {
      push(c.url, { source: "hero-candidate", ...ctx });
    }
  }

  return map;
}

// ── Assemble MASTER DESCRIPTION from context ────────────────────

function assembleMasterDescription(url, contexts, inventoryRow) {
  // Every URL gets a row — even with zero contextual data. Per ADR-0029:
  // "NEVER SKIP" — flag for admin review instead. Thin descriptions
  // land flagged with "missing MASTER DESCRIPTION" so admin knows
  // exactly what work remains.
  contexts = contexts || [];

  const filename = decodeURIComponent(url.split("/").pop() || "");
  const sections = [];

  // If the URL has zero context we still produce a manifest row with
  // the facts we DO know (URL, filename, referring files, inventory
  // classification). Every field is factual — no fabrication.
  if (contexts.length === 0 && !inventoryRow) return "";

  // IMAGE IDENTITY section — pulled from richest source
  const identity = [];
  identity.push(`Image Name:\n${filename}`);
  const category =
    contexts.find((c) => c.category)?.category ??
    (inventoryRow?.purpose ? inventoryRow.purpose : null);
  if (category) identity.push(`Category:\n${category}`);
  if (inventoryRow?.referring_files?.length) {
    identity.push(
      `Referenced in:\n${inventoryRow.referring_files
        .slice(0, 3)
        .map((f) => `- ${f}`)
        .join("\n")}`
    );
  }
  if (inventoryRow?.origin) {
    identity.push(`Source Origin:\n${inventoryRow.origin}`);
  }
  const primaryStyle = contexts.find((c) => c.wood)?.wood
    ? "Timber Sample Photography"
    : contexts.find((c) => c.question)
    ? "Staircase Reference Image"
    : "General Imagery";
  identity.push(`Primary Style:\n${primaryStyle}`);
  if (identity.length > 0) sections.push(`IMAGE IDENTITY\n${identity.join("\n\n")}`);

  // IMAGE DESCRIPTION — accumulate all context strings
  const descParts = [];
  for (const ctx of contexts) {
    if (ctx.question) descParts.push(`Q: ${ctx.question}`);
    if (ctx.answer_excerpt) descParts.push(ctx.answer_excerpt);
    if (ctx.caption) descParts.push(`Caption: ${ctx.caption}`);
    if (ctx.alt && ctx.alt !== ctx.caption) descParts.push(`Alt: ${ctx.alt}`);
    if (ctx.wood) {
      descParts.push(
        `Wood species: ${ctx.wood}${ctx.country ? ` (${ctx.country})` : ""}.`
      );
    }
    if (ctx.notes) descParts.push(ctx.notes);
    if (ctx.strength) descParts.push(`Strength: ${ctx.strength}.`);
    if (ctx.popularity) descParts.push(`Popularity: ${ctx.popularity}.`);
    if (ctx.material) descParts.push(`Material: ${ctx.material}.`);
  }
  if (descParts.length > 0) {
    sections.push(`IMAGE DESCRIPTION\n${descParts.join("\n\n")}`);
  }

  // MATERIAL ANALYSIS (only if wood-gallery)
  const woodCtx = contexts.find((c) => c.wood);
  if (woodCtx) {
    sections.push(
      `MATERIAL ANALYSIS\nPrimary Material:\n${woodCtx.wood}\n\nOrigin:\n${woodCtx.country ?? "Unknown"}`
    );
  }

  return sections.join("\n\n");
}

// ── Main — calls the save endpoint per row so we reuse parser+validator ─

async function main() {
  console.log("NEX Bulk Image Processor · ADR-0028 · ADR-0029");
  console.log("=====================================================");

  const inventory = await loadJson("scripts/image-migration-inventory.json", {
    inventory: [],
  });
  const manifest = await loadJson("data/nex-image-manifest.json", {
    version: 1,
    images: {},
  });
  if (!manifest.images) manifest.images = {};

  const contextMap = await buildContextMap();
  console.log(`Loaded ${contextMap.size} URLs with real context`);
  console.log(`Inventory has ${inventory.inventory.length} unique URLs`);
  console.log(
    `Manifest already has ${Object.keys(manifest.images).length} tagged rows`
  );
  console.log("");

  const counters = {
    processed: 0,
    flagged: 0,
    clean: 0,
    skipped_no_context: 0,
    skipped_already_tagged: 0,
    api_errors: 0,
  };

  const beforeCount = Object.keys(manifest.images).length;

  // Batch payload for the save endpoint (single POST per chunk)
  const batchImages = {};
  const contextTracking = {};

  for (const row of inventory.inventory) {
    const url = row.canonical_url;
    const canonicalUrl = canonical(url);

    const existing = manifest.images[canonicalUrl];
    if (
      existing?.description &&
      typeof existing.description === "string" &&
      existing.description.trim().length > 100
    ) {
      counters.skipped_already_tagged++;
      continue;
    }

    const contexts = contextMap.get(canonicalUrl) ?? [];
    const master_description = assembleMasterDescription(canonicalUrl, contexts, row);

    // Per Philip's directive: catalogue ALL URLs even with thin
    // context. The validator flags them for admin review — never
    // silently skipped. Only skip TRULY zero-context URLs (which
    // assembleMasterDescription returns "" for).
    if (master_description.length === 0) {
      counters.skipped_no_context++;
      continue;
    }

    batchImages[canonicalUrl] = {
      source: "ai_generated",
      description: master_description,
      created_by: "bulk-processor",
      notes: `Auto-processed from ${contexts.length} context sources.`,
    };
    contextTracking[canonicalUrl] = contexts.length;
  }

  const totalToSend = Object.keys(batchImages).length;
  console.log(`Assembled ${totalToSend} rows ready to send to save endpoint`);

  if (totalToSend === 0) {
    console.log("Nothing to process. Done.");
    return;
  }

  // Chunk into groups of 50 to avoid huge single POSTs
  const urls = Object.keys(batchImages);
  const CHUNK = 50;
  for (let i = 0; i < urls.length; i += CHUNK) {
    const chunk = urls.slice(i, i + CHUNK);
    const payload = { images: {} };
    for (const u of chunk) payload.images[u] = batchImages[u];

    try {
      const res = await fetch("http://localhost:3008/api/admin/image-tagger/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        console.error(
          `  chunk ${i / CHUNK + 1}: API error`,
          data?.error ?? res.status
        );
        counters.api_errors += chunk.length;
        continue;
      }
      const rowFlags = data.validation_flags ?? {};
      for (const u of chunk) {
        counters.processed++;
        const flags = rowFlags[u] ?? [];
        if (flags.some((f) => f.severity === "critical" || f.severity === "warning")) {
          counters.flagged++;
        } else {
          counters.clean++;
        }
      }
      process.stdout.write(
        `  chunk ${i / CHUNK + 1}/${Math.ceil(urls.length / CHUNK)} · ${counters.processed}/${totalToSend} processed\r`
      );
    } catch (err) {
      console.error(`  chunk ${i / CHUNK + 1}: fetch error`, err.message);
      counters.api_errors += chunk.length;
    }
  }
  console.log("");

  // Read manifest back to get accurate final count
  const finalManifest = await loadJson("data/nex-image-manifest.json", {
    images: {},
  });
  const afterCount = Object.keys(finalManifest.images || {}).length;

  console.log("");
  console.log("=== BULK PROCESSING COMPLETE ===");
  console.log(`Processed:                ${counters.processed}`);
  console.log(`  ├─ Clean:               ${counters.clean}`);
  console.log(`  └─ Flagged for review:  ${counters.flagged}`);
  console.log(`Skipped (no context):     ${counters.skipped_no_context}`);
  console.log(`Skipped (already tagged): ${counters.skipped_already_tagged}`);
  if (counters.api_errors > 0) console.log(`API errors:              ${counters.api_errors}`);
  console.log("");
  console.log(`Manifest: ${beforeCount} → ${afterCount} rows`);
  console.log("");
  console.log("Per ADR-0029:");
  console.log(
    `  - ${counters.flagged} rows require admin review (visible on Flagged tab in /admin/image-tagger)`
  );
  console.log(
    `  - ${counters.skipped_no_context} URLs have no available context (need MASTER DESCRIPTION from admin — stay in tagger for authoring)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
