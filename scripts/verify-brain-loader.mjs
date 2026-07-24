// One-shot verification that the platform loader discovers every
// brain.json + reads knowledge paths correctly. Runs in Node directly
// so no dev-server dependency.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const BRAINS_ROOT = resolve(process.cwd(), "brains");
const MAX_DEPTH = 4;

function walk(dir, depth, acc) {
  if (depth > MAX_DEPTH) return;
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, depth + 1, acc);
    else if (entry === "brain.json") acc.push(full);
  }
}

function resolveKnowledgePattern(brainDir, pattern) {
  const abs = resolve(brainDir, pattern);
  if (abs.endsWith("*.json")) {
    const dir = dirname(abs);
    if (!existsSync(dir)) return [];
    let files;
    try { files = readdirSync(dir); } catch { return []; }
    return files.filter((f) => f.endsWith(".json")).map((f) => join(dir, f));
  }
  return existsSync(abs) ? [abs] : [];
}

const found = [];
walk(BRAINS_ROOT, 0, found);
console.log(`Found ${found.length} brain.json files\n`);
console.log("═".repeat(80));

for (const p of found) {
  const raw = readFileSync(p, "utf-8");
  const m = JSON.parse(raw);
  const knowledge = m.knowledge_paths.flatMap((kp) => resolveKnowledgePattern(dirname(p), kp));
  const relative = p.replace(BRAINS_ROOT, "brains").replace(/\\/g, "/");
  console.log(`\n[${m.slug.padEnd(12)}] ${m.title}`);
  console.log(`  status: ${m.status}${m.enabled ? "" : " (disabled)"} · category: ${m.category} · priority: ${m.priority}`);
  console.log(`  manifest: ${relative}`);
  console.log(`  knowledge: ${knowledge.length} files resolved`);
  for (const k of knowledge.slice(0, 3)) {
    console.log(`    · ${k.replace(process.cwd(), "").replace(/\\/g, "/")}`);
  }
  if (knowledge.length > 3) console.log(`    · … +${knowledge.length - 3} more`);
}
console.log("\n" + "═".repeat(80));
