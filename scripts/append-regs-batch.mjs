#!/usr/bin/env node
// Bulk-append regulations from a staging JSON file to the Brain's regulations draft.
// Usage: node scripts/append-regs-batch.mjs <slug> <path-to-staging.json>

import { promises as fs } from "node:fs";
import path from "node:path";

const [, , slug, stagingPath] = process.argv;
if (!slug || !stagingPath) {
  console.error("Usage: node scripts/append-regs-batch.mjs <slug> <staging.json>");
  process.exit(1);
}

const staging = JSON.parse(await fs.readFile(stagingPath, "utf8"));
const draftPath = path.join(process.cwd(), ".author-studio-drafts", slug, "regulations.json");
const draft = JSON.parse(await fs.readFile(draftPath, "utf8"));

let added = 0;
for (const r of staging.regulations) {
  const id = `direct.reg.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 6)}`;
  const reg = {
    id,
    country:     r.country ?? "UK",
    title:       r.title,
    requirement: r.requirement,
    applies_to:  r.applies_to ?? [],
    evidence:    r.evidence ?? [{ source: "Nex", note: "" }],
    confidence:  r.confidence ?? "high"
  };
  if (r.section) reg.section = r.section;
  draft.payload.regulations.push(reg);
  added++;
}

draft.updated_at = new Date().toISOString();
await fs.writeFile(draftPath, JSON.stringify(draft, null, 2), "utf8");
console.log(JSON.stringify({ ok: true, added, total_regulations: draft.payload.regulations.length }));
