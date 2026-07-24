#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
const draftPath = path.join(process.cwd(), ".author-studio-drafts", "staircase", "craft.json");
const draft = JSON.parse(await fs.readFile(draftPath, "utf8"));
const fact = draft.payload.facts.find((f) => f.id === "direct.fact.mry696ek.6hff");
fact.statement = "Any professional staircase fitter working in occupied homes should carry public liability insurance to a level appropriate for the work — typical trade minimum is a few million cover, scaling higher for larger commercial jobs. The policy covers accidental damage to the client's property or injury to third parties during the work. Clients should always ask to see the current PL certificate before letting a fitter into their house. Any fitter who can't produce a current certificate isn't worth hiring — one dropped tool on a marble floor costs more than any insurance premium. Exact cover values vary by insurer and job type — always confirm with the specific fitter.";
draft.updated_at = new Date().toISOString();
await fs.writeFile(draftPath, JSON.stringify(draft, null, 2), "utf8");
console.log(JSON.stringify({ ok: true, updated: 1 }));
