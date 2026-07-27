#!/usr/bin/env node
// scripts/staircase-hero-manifest-builder.mjs
//
// Builds a review manifest of every staircase image on the NEX
// ImageKit account (5vv5pw26q) with its surrounding context so
// Philip can curate an A+ subset for directory-card heroes.
//
// Sources scanned:
//   1. knowledge/staircase.json entries (question + diagram caption)
//   2. data/staircase-materials.json (material label + image)
//   3. Any other .ts / .tsx / .json under src+data referencing 5vv5pw26q URLs
//
// Output:
//   docs/STAIRCASE_HERO_MANIFEST.md  — human-readable manifest
//   data/staircase-hero-candidates.json — machine-readable
//
// Zero URLs wired to cards. Philip curates → I wire only the approved subset.

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const NEX_IK_PREFIX = "https://ik.imagekit.io/5vv5pw26q/";

/** Every URL → { context strings gathered from various sources } */
const urlContext = new Map();

function addContext(url, context) {
  const key = url.split("?")[0]; // strip cache params for grouping
  if (!urlContext.has(key)) {
    urlContext.set(key, { url: key, contexts: [] });
  }
  urlContext.get(key).contexts.push(context);
}

// ── Source 1: knowledge/staircase.json ─────────────────────────
async function ingestStaircaseKB() {
  const raw = await fs.readFile(
    path.join(ROOT, "knowledge", "staircase.json"),
    "utf8"
  );
  const entries = JSON.parse(raw);
  for (const e of entries) {
    if (!e.diagram || !e.diagram.url) continue;
    if (!e.diagram.url.startsWith(NEX_IK_PREFIX)) continue;
    addContext(e.diagram.url, {
      source: "staircase-brain",
      category: e.category_tag ?? null,
      question: e.question ?? null,
      caption: e.diagram.caption ?? e.diagram.alt ?? null,
      classification: e.classification ?? null,
    });
  }
}

// ── Source 2: data/staircase-materials.json ────────────────────
async function ingestMaterials() {
  try {
    const raw = await fs.readFile(
      path.join(ROOT, "data", "staircase-materials.json"),
      "utf8"
    );
    // Naïvely find every 5vv5pw26q URL + preceding label
    const text = raw;
    const urlRe = /"([^"]*ik\.imagekit\.io\/5vv5pw26q\/[^"]+)"/g;
    for (const m of text.matchAll(urlRe)) {
      const url = m[1];
      // Find nearest preceding "name":"..." or "label":"..." within 400 chars
      const before = text.slice(Math.max(0, m.index - 400), m.index);
      const labelMatch = before.match(/"(?:name|label|title|material)"\s*:\s*"([^"]+)"[^{}]*$/);
      addContext(url, {
        source: "staircase-materials",
        material: labelMatch ? labelMatch[1] : null,
      });
    }
  } catch {
    // no materials file
  }
}

// ── Source 3: hero art / discover / centre feed ────────────────
async function ingestHeroReferences() {
  const candidates = [
    "src/components/nex-app/centre/NexCentreLiveFeed.tsx",
    "src/components/nex-app/centre/NexPinterestFeed.tsx",
    "src/components/nex-app/discover/DiscoverShell.tsx",
  ];
  for (const rel of candidates) {
    try {
      const text = await fs.readFile(path.join(ROOT, rel), "utf8");
      const urlRe = /(https?:\/\/ik\.imagekit\.io\/5vv5pw26q\/[^\s"'`)]+)/g;
      for (const m of text.matchAll(urlRe)) {
        addContext(m[1], { source: rel.split("/").pop(), role: "hero_or_background" });
      }
    } catch {
      // skip
    }
  }
}

// ── Source 4: _wood_gallery.ts (label + notes) ─────────────────
async function ingestWoodGallery() {
  try {
    const text = await fs.readFile(
      path.join(ROOT, "src/lib/nex/brains/_wood_gallery.ts"),
      "utf8"
    );
    const blocks = text.split(/{\s*id:/).slice(1);
    for (const b of blocks) {
      const nameM = b.match(/name:\s*"([^"]+)"/);
      const urlM = b.match(/imageUrl:\s*"([^"]+)"/);
      const notesM = b.match(/notes:\s*"([^"]+)"/);
      if (urlM) {
        addContext(urlM[1], {
          source: "wood-gallery",
          wood: nameM ? nameM[1] : null,
          notes: notesM ? notesM[1] : null,
        });
      }
    }
  } catch {}
}

async function main() {
  console.log("Ingesting sources…");
  await ingestStaircaseKB();
  await ingestMaterials();
  await ingestHeroReferences();
  await ingestWoodGallery();

  const rows = [...urlContext.values()].sort((a, b) => a.url.localeCompare(b.url));
  console.log(`  ${rows.length} unique staircase-relevant URLs collated`);

  // Write JSON
  const jsonOut = path.join(ROOT, "data", "staircase-hero-candidates.json");
  await fs.writeFile(
    jsonOut,
    JSON.stringify({ generated_at: new Date().toISOString(), count: rows.length, candidates: rows }, null, 2),
    "utf8"
  );
  console.log(`  wrote ${path.relative(ROOT, jsonOut)}`);

  // Write markdown manifest
  const mdOut = path.join(ROOT, "docs", "STAIRCASE_HERO_MANIFEST.md");
  const md = buildMarkdown(rows);
  await fs.writeFile(mdOut, md, "utf8");
  console.log(`  wrote ${path.relative(ROOT, mdOut)}`);
}

function truncate(s, n) {
  if (!s) return "";
  const oneLine = String(s).replace(/\s+/g, " ").trim();
  return oneLine.length > n ? oneLine.slice(0, n - 1) + "…" : oneLine;
}

function buildMarkdown(rows) {
  const lines = [];
  lines.push("# Staircase Hero Manifest — for Philip's A+ curation");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("Every staircase-relevant image URL on the NEX ImageKit account");
  lines.push("(`5vv5pw26q`) with context from where it's used in the app.");
  lines.push("");
  lines.push("**Purpose:** Philip curates the A+ subset (mark with ✅) and tags each");
  lines.push("by dominant subject/style (oak / glass / floating / renovation / etc.)");
  lines.push("so directory cards can be matched by what the business actually does.");
  lines.push("");
  lines.push("**Usage:** append to the end of each row you approve:");
  lines.push("");
  lines.push("  `✅ tags: <oak|glass|floating|renovation|steel|traditional|modern|balustrade|handrail>`");
  lines.push("");
  lines.push(`**Total candidates:** ${rows.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  for (const row of rows) {
    const filename = decodeURIComponent(row.url.split("/").pop());
    lines.push(`## \`${filename}\``);
    lines.push("");
    lines.push(`URL: ${row.url}`);
    lines.push("");
    for (const ctx of row.contexts) {
      const parts = [];
      if (ctx.source) parts.push(`**source:** ${ctx.source}`);
      if (ctx.category) parts.push(`**category:** ${ctx.category}`);
      if (ctx.question) parts.push(`**question:** ${truncate(ctx.question, 140)}`);
      if (ctx.caption) parts.push(`**caption:** ${truncate(ctx.caption, 140)}`);
      if (ctx.material) parts.push(`**material:** ${ctx.material}`);
      if (ctx.wood) parts.push(`**wood:** ${ctx.wood}`);
      if (ctx.notes) parts.push(`**notes:** ${truncate(ctx.notes, 120)}`);
      if (ctx.role) parts.push(`**role:** ${ctx.role}`);
      lines.push(`- ${parts.join(" · ")}`);
    }
    lines.push("");
    lines.push("_curation:_ `☐ approve | tags: `");
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
