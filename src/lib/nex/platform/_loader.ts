// Filesystem Brain Loader — scans brains/**/brain.json at boot,
// validates each manifest, resolves knowledge-file globs, registers
// into an in-memory registry.
//
// Per Platform architecture: dropping a folder into brains/ MUST
// register a Brain with no code changes. This loader is the substrate
// that makes that promise real.
//
// Server-only (node:fs). Called lazily via ensureLoaded so hot-reload
// during dev doesn't rescan on every request.

import "server-only";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { BrainManifestSchema, type BrainDescriptor, type BrainManifest } from "./_manifest";

const BRAINS_ROOT = resolve(process.cwd(), "brains");
const MAX_DEPTH = 4;   // brains/<category>/<subcategory>/<brain>/brain.json max

let registry: Map<string, BrainDescriptor> | null = null;
let lastScanAt = 0;

// Recursively find every brain.json under the brains/ root.
function walk(dir: string, depth: number, acc: string[]): void {
  if (depth > MAX_DEPTH) return;
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, depth + 1, acc);
    else if (entry === "brain.json") acc.push(full);
  }
}

// Resolve a single glob-ish pattern (only trailing `*.json` supported —
// no full glob engine; keeps zero dependencies). Absolute or
// brain-root-relative paths supported.
function resolveKnowledgePattern(brainDir: string, pattern: string): string[] {
  const abs = resolve(brainDir, pattern);
  if (abs.endsWith("*.json")) {
    const dir = dirname(abs);
    if (!existsSync(dir)) return [];
    let files: string[];
    try { files = readdirSync(dir); } catch { return []; }
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => join(dir, f));
  }
  return existsSync(abs) ? [abs] : [];
}

function loadOne(manifestPath: string): BrainDescriptor | null {
  let raw: string;
  try { raw = readFileSync(manifestPath, "utf-8"); }
  catch { return null; }
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return null; }
  const parsed = BrainManifestSchema.safeParse(json);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.warn(`[brain-loader] manifest invalid: ${manifestPath}`, parsed.error.issues.slice(0, 3));
    return null;
  }
  const manifest: BrainManifest = parsed.data;
  const rootDir = dirname(manifestPath);
  const resolvedKnowledge = manifest.knowledge_paths
    .flatMap((p) => resolveKnowledgePattern(rootDir, p));
  return {
    ...manifest,
    _manifestPath:      manifestPath,
    _rootDir:           rootDir,
    _resolvedKnowledge: resolvedKnowledge,
    _loadedAt:          Date.now()
  };
}

export function loadAllBrains(): Map<string, BrainDescriptor> {
  const found: string[] = [];
  if (existsSync(BRAINS_ROOT)) walk(BRAINS_ROOT, 0, found);
  const map = new Map<string, BrainDescriptor>();
  for (const p of found) {
    const desc = loadOne(p);
    if (!desc) continue;
    if (map.has(desc.slug)) {
      // eslint-disable-next-line no-console
      console.warn(`[brain-loader] duplicate slug '${desc.slug}' at ${p} — keeping first-loaded from ${map.get(desc.slug)?._manifestPath}`);
      continue;
    }
    map.set(desc.slug, desc);
  }
  registry = map;
  lastScanAt = Date.now();
  return map;
}

export function ensureLoaded(): Map<string, BrainDescriptor> {
  if (!registry) return loadAllBrains();
  return registry;
}

export function forceReload(): Map<string, BrainDescriptor> {
  return loadAllBrains();
}

export function getLastScanAt(): number {
  return lastScanAt;
}

export function getBrainsRootPath(): string {
  return BRAINS_ROOT;
}
