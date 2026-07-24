#!/usr/bin/env node
// Second pass — fix the remaining "Cheap" variants my first regex missed.

import { promises as fs } from "node:fs";
import path from "node:path";
const p = path.join(process.cwd(), ".author-studio-drafts", "staircase", "craft.json");
const draft = JSON.parse(await fs.readFile(p, "utf8"));

const FIXES = [
  [/\bdoes the job cheaply\b/g,        "does the job at a modest cost"],
  [/^Cheaper, more stable/gm,          "Less expensive, more stable"],
  [/\. Cheaper, more stable/g,         ". Less expensive, more stable"],
  [/^Cheaper, easier to/gm,            "Less expensive, easier to"],
  [/\. Cheaper, easier to/g,           ". Less expensive, easier to"],
  [/^Cheaper, simpler/gm,              "Less expensive, simpler"],
  [/\. Cheaper, simpler/g,             ". Less expensive, simpler"],
  [/^Cheap, reliable/gm,               "Reliable, well-proven"],
  [/\. Cheap, reliable/g,              ". Reliable, well-proven"],
  [/^Cheapest to build/gm,             "Most affordable to build"],
  [/\. Cheapest to build/g,            ". Most affordable to build"]
];

let fixed = 0;
for (const fact of draft.payload.facts) {
  const before = fact.statement;
  let after = before;
  for (const [pat, rep] of FIXES) after = after.replace(pat, rep);
  if (before !== after) {
    fact.statement = after;
    fixed++;
  }
}

draft.updated_at = new Date().toISOString();
await fs.writeFile(p, JSON.stringify(draft, null, 2), "utf8");
console.log(JSON.stringify({ ok: true, fixed }));
