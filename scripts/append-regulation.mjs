#!/usr/bin/env node
// Append a regulation entry to a Brain's regulations.json draft.
// Stdin JSON: { slug, id?, country, title, section?, requirement, applies_to, confidence }

import { promises as fs } from "node:fs";
import path from "node:path";

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));

const draftPath = path.join(process.cwd(), ".author-studio-drafts", input.slug, "regulations.json");
const draft = JSON.parse(await fs.readFile(draftPath, "utf8"));

const id = input.id ?? `direct.reg.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 6)}`;

const reg = {
  id,
  country:     input.country ?? "UK",
  title:       input.title,
  requirement: input.requirement,
  applies_to:  input.applies_to ?? [],
  evidence:    input.evidence ?? [{ source: "Nex", note: input.source_note ?? "" }],
  confidence:  input.confidence ?? "high"
};
if (input.section) reg.section = input.section;

draft.payload.regulations.push(reg);
draft.updated_at = new Date().toISOString();
await fs.writeFile(draftPath, JSON.stringify(draft, null, 2), "utf8");
console.log(JSON.stringify({ ok: true, id, total_regulations: draft.payload.regulations.length }));
