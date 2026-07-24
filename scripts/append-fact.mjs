#!/usr/bin/env node
// One-off Fact appender. Reads stdin as JSON, appends to a Brain's
// craft.json draft, saves. Used for direct chat imports.
//
// Stdin JSON shape:
//   { slug, statement, question, evidence, confidence, classification, image_url?, glossary? }

import { promises as fs } from "node:fs";
import path from "node:path";

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));

const draftPath = path.join(process.cwd(), ".author-studio-drafts", input.slug, "craft.json");
const raw = await fs.readFile(draftPath, "utf8");
const draft = JSON.parse(raw);

const id = `direct.fact.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 6)}`;
const evidence = input.evidence ?? [{ source: "Nex", note: input.question ?? "" }];
if (input.image_url) evidence.push({ source: "Nex image reference", url: input.image_url });

const fact = {
  id,
  statement:      input.statement,
  evidence,
  confidence:     input.confidence ?? "high",
  classification: input.classification ?? "expert_observation"
};
if (input.audience_level) fact.audience_level = input.audience_level;

draft.payload.facts.push(fact);

if (input.glossary) {
  draft.payload.glossary = draft.payload.glossary ?? [];
  draft.payload.glossary.push(input.glossary);
}

draft.updated_at = new Date().toISOString();
await fs.writeFile(draftPath, JSON.stringify(draft, null, 2), "utf8");
console.log(JSON.stringify({ ok: true, added_fact_id: id, total_facts: draft.payload.facts.length, total_glossary: draft.payload.glossary?.length ?? 0 }));
