#!/usr/bin/env node
// Bulk-append craft facts from a staging JSON file to the Brain's craft draft.
// Usage: node scripts/append-facts-batch.mjs <slug> <staging.json>

import { promises as fs } from "node:fs";
import path from "node:path";

const [, , slug, stagingPath] = process.argv;
if (!slug || !stagingPath) {
  console.error("Usage: node scripts/append-facts-batch.mjs <slug> <staging.json>");
  process.exit(1);
}

const staging = JSON.parse(await fs.readFile(stagingPath, "utf8"));
const draftPath = path.join(process.cwd(), ".author-studio-drafts", slug, "craft.json");
const draft = JSON.parse(await fs.readFile(draftPath, "utf8"));

let added = 0;
for (const f of staging.facts) {
  const id = `direct.fact.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 6)}`;
  const fact = {
    id,
    statement:  f.statement,
    evidence:   [{ source: "Nex", note: f.source ?? f.topic ?? "" }],
    confidence: f.confidence ?? "high"
  };
  if (f.topic) fact.topic = f.topic;
  draft.payload.facts.push(fact);
  added++;
}

draft.updated_at = new Date().toISOString();
await fs.writeFile(draftPath, JSON.stringify(draft, null, 2), "utf8");
console.log(JSON.stringify({ ok: true, added, total_facts: draft.payload.facts.length }));
