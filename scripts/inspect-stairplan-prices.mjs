import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const envText = readFileSync("C:\\Users\\Victus\\trades\\.env.local", "utf-8");
function e(name) { return envText.match(new RegExp(`^${name}=(.+)$`, "m"))[1].trim().replace(/^["']|["']$/g, ""); }
const sb = createClient(e("NEXT_PUBLIC_SUPABASE_URL"), e("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const brainId = "9354a294-c058-4a33-b2cd-1a8e54988d26";
const { data: pages } = await sb.from("brain_pages")
  .select("url, title, category, clean_text").eq("brain_id", brainId).limit(500);

let pagesWithPound = 0;
let pagesWithPoa = 0;
let pagesWithFromPrice = 0;
let pagesWithPlainPrice = 0;
const priceSamples = [];
const categoryCounts = {};

for (const p of pages) {
  categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  const text = p.clean_text;
  if (/£/.test(text)) pagesWithPound++;
  if (/\bPOA\b|price\s+on\s+application|call\s+for\s+price|price\s+on\s+request|enquire|quote/i.test(text)) pagesWithPoa++;
  const fromMatch = /(?:from|starting\s+at|starting\s+from|prices?\s+from)\s*£\s?[\d,]+/i.exec(text);
  const plainMatch = /£\s?[\d,]+(?:\.\d{2})?/.exec(text);
  if (fromMatch) { pagesWithFromPrice++; priceSamples.push({ url: p.url, hit: fromMatch[0], type: "from" }); }
  else if (plainMatch) { pagesWithPlainPrice++; if (priceSamples.length < 30) priceSamples.push({ url: p.url, hit: plainMatch[0], type: "plain" }); }
}

console.log(`Total pages: ${pages.length}`);
console.log(`\nCategory breakdown:`);
for (const [cat, count] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat}: ${count}`);
}
console.log(`\nPages containing £ symbol: ${pagesWithPound}`);
console.log(`Pages with "from £X": ${pagesWithFromPrice}`);
console.log(`Pages with plain £X (no "from"): ${pagesWithPlainPrice}`);
console.log(`Pages with POA / enquire / quote language: ${pagesWithPoa}`);

console.log(`\nFirst ${Math.min(15, priceSamples.length)} price hits:`);
for (const s of priceSamples.slice(0, 15)) {
  console.log(`  [${s.type}] ${s.hit} — ${s.url}`);
}
