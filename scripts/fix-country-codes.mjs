#!/usr/bin/env node
// Fix regulation country codes to ISO format (max 4 chars).
// Scotland→SCT, Wales→WLS, Northern Ireland→NIR, UK→UK

import { promises as fs } from "node:fs";
import path from "node:path";

const p = path.join(process.cwd(), ".author-studio-drafts", "staircase", "regulations.json");
const draft = JSON.parse(await fs.readFile(p, "utf8"));

const map = {
  "Scotland": "SCT",
  "Wales": "WLS",
  "Northern Ireland": "NIR",
  "England": "ENG",
  "United Kingdom": "UK"
};

let fixed = 0;
for (const reg of draft.payload.regulations) {
  if (map[reg.country]) {
    reg.country = map[reg.country];
    fixed++;
  } else if (reg.country && reg.country.length > 4) {
    // Truncate anything else
    reg.country = reg.country.slice(0, 4);
    fixed++;
  }
}

draft.updated_at = new Date().toISOString();
await fs.writeFile(p, JSON.stringify(draft, null, 2), "utf8");
console.log(JSON.stringify({ ok: true, fixed, total: draft.payload.regulations.length }));
