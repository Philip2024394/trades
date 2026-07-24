#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
const p = path.join(process.cwd(), ".author-studio-drafts", "staircase", "craft.json");
const d = JSON.parse(await fs.readFile(p, "utf8"));
const fact = d.payload.facts.find((f) => f.id === "direct.fact.mry8gai9.vsex");
fact.statement = "Standard UK trade practice: quotes to VAT-registered businesses often show 'plus VAT' or 'ex VAT' — 20% needs to be added to reach the final invoice number. Quotes to consumers should show the total price INCLUDING VAT. This regularly causes shock at invoice stage when a homeowner thought the quoted number was final and finds another 20% on top. Always ask directly: is this price inclusive of VAT? If a quote doesn't say either way, assume it's plus VAT and factor accordingly. The one thing worse than a surprise price is a surprise price at the back end of a project when you've already committed.";
d.updated_at = new Date().toISOString();
await fs.writeFile(p, JSON.stringify(d, null, 2), "utf8");
console.log("fixed");
