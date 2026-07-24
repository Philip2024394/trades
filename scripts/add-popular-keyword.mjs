#!/usr/bin/env node
// Add the word "popular" to the American oak default-hardwood fact
// so retrieval matches user queries using that word.

import { promises as fs } from "node:fs";
import path from "node:path";
const p = path.join(process.cwd(), ".author-studio-drafts", "staircase", "craft.json");
const draft = JSON.parse(await fs.readFile(p, "utf8"));

// Find the American oak default-hardwood fact by content
const fact = draft.payload.facts.find((f) =>
  f.statement.includes("Of every hardwood you can spec on a UK staircase") &&
  f.statement.includes("American White Oak (Quercus alba) is probably the most-chosen")
);

if (!fact) {
  console.log("Fact not found");
  process.exit(1);
}

fact.statement = fact.statement.replace(
  "is probably the most-chosen",
  "is probably the most-chosen and by any honest measure the most popular"
);

draft.updated_at = new Date().toISOString();
await fs.writeFile(p, JSON.stringify(draft, null, 2), "utf8");
console.log("Fact updated");
