// NEX Design System Finalisation · section enumeration (Philip 2026-08-14).
//
// Imports every registered section (populates the registry via side effects)
// and prints a structured JSON of the ENTIRE catalog: id · library · name ·
// description · editableFields count · industries · themes · responsive
// behaviour · category · has .meta sidecar file · has "use client".
//
// Output goes to data/design-system/section-inventory-<timestamp>.json.
// The markdown + live-page steps consume that JSON — enumeration is the
// single source of truth.
//
// Non-negotiable: do not import from anything that RUNS a section. We
// only need metadata. The renderer function reference is stored but never
// invoked here.

process.env.NEX_SESSION_SECRET = "test-secret-do-not-use-in-prod-abcdefghij1234567890";

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";

await import("../../src/lib/studio/sections/index.ts");
const { sectionRegistry } = await import("../../src/lib/studio/sectionRegistry.ts");

const ROOT = process.cwd();
const SECTIONS_DIR = join(ROOT, "src", "lib", "studio", "sections");
const OUT_DIR = join(ROOT, "data", "design-system");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ── Walk the sections tree to correlate each registration with a file ──
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
const allFiles = walk(SECTIONS_DIR);
const sourceByRegistryId = new Map();

for (const file of allFiles) {
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  if (!/\.(tsx|ts)$/.test(rel)) continue;
  const source = readFileSync(file, "utf8");
  // Extract every `id: "library.something_N"` pattern (matches registration entries).
  const idMatches = [...source.matchAll(/^\s*id:\s*["']([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)["']/gm)];
  for (const m of idMatches) {
    const id = m[1];
    const existing = sourceByRegistryId.get(id);
    // Prefer .meta.ts as the source-of-record file when both exist —
    // that's the SSR-authoritative registration.
    if (!existing || rel.endsWith(".meta.ts")) {
      sourceByRegistryId.set(id, {
        file: rel,
        isMeta: rel.endsWith(".meta.ts"),
        useClient: /^\s*["']use client["']/m.test(source)
      });
    }
  }
}

// ── Enumerate every registered section from the live registry ──
const registered = sectionRegistry.list();

const inventory = registered.map((s) => {
  const src = sourceByRegistryId.get(s.id) ?? { file: "(unknown)", isMeta: false, useClient: false };
  // If the renderer file is .tsx and has "use client", we require a .meta.ts sidecar.
  const rendererFile = src.file.endsWith(".meta.ts")
    ? src.file.replace(/\.meta\.ts$/, ".tsx")
    : src.file;
  const rendererIsClient =
    rendererFile !== src.file
      ? (() => {
          try { return /^\s*["']use client["']/m.test(readFileSync(join(ROOT, rendererFile), "utf8")); }
          catch { return null; }
        })()
      : src.useClient;

  return {
    id: s.id,
    library: s.library,
    name: s.name,
    version: s.version,
    description: s.description,
    category: s.category ?? null,
    supportedThemes: s.supportedThemes ?? [],
    supportedIndustries: s.supportedIndustries ?? [],
    bestForVerticals: s.bestForVerticals ?? [],
    responsiveBehaviour: s.responsiveBehaviour ?? null,
    editableFieldCount: (s.editableFields ?? []).length,
    editableFieldKeys: (s.editableFields ?? []).map((f) => f.key),
    aiPromptableFieldCount: (s.editableFields ?? []).filter((f) => f.aiPromptable).length,
    imagePlaceholderCount: (s.imagePlaceholders ?? []).length,
    telemetryTags: s.telemetryTags ?? [],
    thumbnail: s.thumbnail ?? null,
    sourceFile: src.file,
    hasMetaSidecar: src.isMeta,
    rendererIsClient: rendererIsClient
  };
});

// Sort deterministically by library then id.
inventory.sort((a, b) => (a.library + a.id).localeCompare(b.library + b.id));

// ── Summary counters ──
const byLibrary = {};
for (const s of inventory) {
  byLibrary[s.library] = (byLibrary[s.library] ?? 0) + 1;
}
const missingMetaSidecars = inventory
  .filter((s) => s.rendererIsClient === true && !s.hasMetaSidecar)
  .map((s) => s.id);

const summary = {
  ranAt: new Date().toISOString(),
  totalSections: inventory.length,
  byLibrary,
  latentSsrBombs: missingMetaSidecars,
  inventory
};

const outFile = join(OUT_DIR, `section-inventory-${Date.now()}.json`);
writeFileSync(outFile, JSON.stringify(summary, null, 2));

// Also write a stable-name copy so downstream scripts don't need to guess.
const stableFile = join(OUT_DIR, "section-inventory.json");
writeFileSync(stableFile, JSON.stringify(summary, null, 2));

console.log(`enumerated ${inventory.length} registered sections across ${Object.keys(byLibrary).length} libraries`);
console.log(`  per-library:`);
for (const [lib, n] of Object.entries(byLibrary).sort()) console.log(`    ${lib.padEnd(16)} ${n}`);
console.log(`  latent SSR bombs (client-only, no .meta): ${missingMetaSidecars.length}`);
for (const id of missingMetaSidecars) console.log(`    · ${id}`);
console.log(`  wrote ${relative(ROOT, outFile).replaceAll("\\", "/")} (+ stable name section-inventory.json)`);
