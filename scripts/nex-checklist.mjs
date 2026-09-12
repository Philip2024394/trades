#!/usr/bin/env node
// scripts/nex-checklist.mjs
//
// Founder Phase 12 · post-task tracker.
// Reads data/nex-master-checklist.json and prints a colored chart showing
// how many items remain RED / YELLOW / GREEN. Grouped by category so it's
// obvious where the biggest RED clusters are.
//
// Usage:
//   node scripts/nex-checklist.mjs          # print chart
//   node scripts/nex-checklist.mjs --red    # list only red items
//   node scripts/nex-checklist.mjs --json   # machine-readable summary

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(readFileSync(join(__dirname, "..", "data", "nex-master-checklist.json"), "utf8"));

const ANSI = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m",
  bgRed: "\x1b[41m", bgGreen: "\x1b[42m", bgYellow: "\x1b[43m",
};
const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (color, s) => (supportsColor ? `${ANSI[color]}${s}${ANSI.reset}` : s);

const args = new Set(process.argv.slice(2));

// ═══════════════════════════════════════════════════════════════════
// Tally
// ═══════════════════════════════════════════════════════════════════
let total = 0;
const totals = { green: 0, yellow: 0, red: 0 };
const perCat = [];
for (const cat of DATA.categories) {
  const t = { green: 0, yellow: 0, red: 0 };
  for (const it of cat.items) {
    t[it.status] = (t[it.status] ?? 0) + 1;
    totals[it.status] = (totals[it.status] ?? 0) + 1;
    total += 1;
  }
  perCat.push({ id: cat.id, name: cat.name, items: cat.items.length, ...t });
}

if (args.has("--json")) {
  process.stdout.write(JSON.stringify({ total, totals, perCat, updated_at: DATA.updated_at }, null, 2));
  process.exit(0);
}

if (args.has("--red")) {
  console.log(c("bold", "\n🔴 Remaining RED items:\n"));
  for (const cat of DATA.categories) {
    const reds = cat.items.filter((i) => i.status === "red");
    if (reds.length === 0) continue;
    console.log(`  ${c("cyan", cat.name)}`);
    for (const r of reds) console.log(`    · ${r.name}${r.evidence ? c("dim", `  — ${r.evidence}`) : ""}`);
  }
  console.log();
  process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════
// Chart
// ═══════════════════════════════════════════════════════════════════
const barWidth = 40;
function bar(g, y, r, w) {
  const denom = g + y + r || 1;
  const gN = Math.round((g / denom) * w);
  const yN = Math.round((y / denom) * w);
  const rN = Math.max(0, w - gN - yN);
  return c("green", "█".repeat(gN)) + c("yellow", "█".repeat(yN)) + c("red", "█".repeat(rN));
}

console.log(c("bold", "\n═══ NEX WORLD-CLASS MASTER SYSTEM CHECKLIST ═══"));
console.log(c("dim", `Updated: ${DATA.updated_at}  ·  Categories: ${DATA.categories.length}  ·  Items: ${total}\n`));

// Overall bar
const pct = (n) => Math.round((n / total) * 100);
console.log(`  ${bar(totals.green, totals.yellow, totals.red, barWidth)}  ` +
  `${c("green", `${totals.green} GREEN (${pct(totals.green)}%)`)}  ` +
  `${c("yellow", `${totals.yellow} YELLOW (${pct(totals.yellow)}%)`)}  ` +
  `${c("red", `${totals.red} RED (${pct(totals.red)}%)`)}\n`);

// Per-category rows · sorted by red-count desc so biggest gaps are first
const sortedCat = [...perCat].sort((a, b) => (b.red - a.red) || (b.yellow - a.yellow) || a.name.localeCompare(b.name));
const nameW = Math.max(...sortedCat.map((c) => c.name.length));
for (const cat of sortedCat) {
  const b = bar(cat.green, cat.yellow, cat.red, 24);
  const pad = " ".repeat(Math.max(0, nameW - cat.name.length));
  const line = `  ${cat.name}${pad}  ${b}  ${c("green", String(cat.green).padStart(2))} ${c("yellow", String(cat.yellow).padStart(2))} ${c("red", String(cat.red).padStart(2))}`;
  console.log(line);
}

// Delta hint if there's a JSON diff possible
console.log(`\n  Run ${c("cyan", "node scripts/nex-checklist.mjs --red")} to list remaining RED items.`);
console.log(`  Run ${c("cyan", "node scripts/nex-checklist.mjs --json")} for machine-readable output.\n`);
