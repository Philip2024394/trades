// Read all draft files + count facts/rules/playbooks per module.
// Read-only — writes nothing. Used to see what's already authored
// before adding interim-Author content.

import { readFileSync, readdirSync, existsSync } from "node:fs";

const dir = "C:\\Users\\Victus\\trades\\.author-studio-drafts\\staircase";
const modules = ["manifest", "craft", "regulations", "materials", "workflow", "defects", "pricing_model"];

console.log("═".repeat(70));
console.log("NEX STAIRCASE BRAIN — DRAFT INVENTORY (read-only)");
console.log("═".repeat(70));

for (const mod of modules) {
  const path = `${dir}\\${mod}.json`;
  if (!existsSync(path)) {
    console.log(`\n[${mod}] missing`);
    continue;
  }
  let raw;
  try { raw = JSON.parse(readFileSync(path, "utf-8")); }
  catch (e) { console.log(`\n[${mod}] parse error: ${e.message}`); continue; }

  const author = raw.author_id ?? "unknown";
  const version = raw.version ?? "?";
  const payload = raw.payload ?? {};

  console.log(`\n[${mod}] author=${author} version=${version}`);

  const counts = {};
  for (const key of ["facts", "rules", "playbooks", "hazards", "definitions", "materials", "regulations", "defects", "steps", "checkpoints"]) {
    if (Array.isArray(payload[key])) counts[key] = payload[key].length;
  }
  if (Object.keys(counts).length > 0) {
    for (const [k, v] of Object.entries(counts)) console.log(`    ${k}: ${v}`);
  }

  // Deep scan for arrays of facts inside sub-objects (some modules nest content)
  const nestedCounts = {};
  function scan(obj, path = "") {
    if (obj === null || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === "object" && obj[0] !== null && (obj[0].id || obj[0].statement || obj[0].title)) {
        nestedCounts[path || "root"] = (nestedCounts[path || "root"] || 0) + obj.length;
      }
      for (let i = 0; i < obj.length; i++) scan(obj[i], `${path}[${i}]`);
    } else {
      for (const [k, v] of Object.entries(obj)) {
        scan(v, path ? `${path}.${k}` : k);
      }
    }
  }
  scan(payload);
  const nestedFiltered = Object.entries(nestedCounts).filter(([k]) => !k.includes("["));
  if (nestedFiltered.length > 0) {
    console.log("    nested arrays with authored items:");
    for (const [k, v] of nestedFiltered) console.log(`      ${k}: ${v}`);
  }

  // Sample first item titles/statements so we can see what's covered
  function sampleTitles(obj, out = [], limit = 5) {
    if (out.length >= limit) return out;
    if (obj === null || typeof obj !== "object") return out;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (out.length >= limit) break;
        if (item && typeof item === "object") {
          const title = item.title ?? item.statement ?? item.name ?? item.slug ?? item.id;
          if (typeof title === "string" && title.length < 120) out.push(title);
        }
      }
      return out;
    }
    for (const v of Object.values(obj)) {
      if (out.length >= limit) break;
      sampleTitles(v, out, limit);
    }
    return out;
  }
  const samples = sampleTitles(payload, [], 8);
  if (samples.length > 0) {
    console.log("    sample items:");
    for (const s of samples) console.log(`      · ${s}`);
  }
}

console.log("\n" + "═".repeat(70));
