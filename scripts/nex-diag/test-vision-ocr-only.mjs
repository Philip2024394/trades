// scripts/nex-diag/test-vision-ocr-only.mjs
//
// Task #69 · dedicated OCR-focused probe · 2026-08-22
// Isolates the text-detection capability from the general
// prose/structured probes. Read-only · no adapter code.
//
// Usage:
//   node scripts/nex-diag/test-vision-ocr-only.mjs <model> <imageUrl>

const MODEL = process.argv[2] ?? "qwen2.5vl:3b";
const URL = process.argv[3] ?? "";
const OLLAMA = process.env.NEX_LOCAL_LLM_URL ?? "http://localhost:11434";

if (!URL) { console.error("usage: node test-vision-ocr-only.mjs <model> <imageUrl>"); process.exit(1); }

console.log(`[probe] model:  ${MODEL}`);
console.log(`[probe] target: ${URL}`);
console.log("");

const t0 = Date.now();
const imgResp = await fetch(URL);
const buf = Buffer.from(await imgResp.arrayBuffer());
const b64 = buf.toString("base64");
console.log(`[fetched] ${buf.length} bytes · ${Date.now() - t0}ms`);
console.log("");

console.log("[ocr probe] asking model to enumerate all visible text...");
const t1 = Date.now();
const resp = await fetch(`${OLLAMA}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: "You are NEX's OCR observer. Read every piece of visible text in the image and return ONLY a single JSON object matching this schema (no example values shown · fill from the actual image only):\n" +
          "  text_regions: array of objects; each object has a 'text' field (verbatim text you read) and a 'location' field (short position hint like 'top center' or 'lower left');\n" +
          "  has_any_text: boolean; true if ANY text is visible (even one letter), false only if no text exists;\n" +
          "  reading_confidence: integer 0-100;\n" +
          "Hard rules: never invent text · never copy schema field names into text values · if no text exists return text_regions:[] · read every distinct block or line of text you can see.",
      },
      {
        role: "user",
        content: "Read all visible text in this image and return the JSON.",
        images: [b64],
      },
    ],
    stream: false,
    format: "json",
    options: { temperature: 0.1, num_predict: 512 },
  }),
});
const data = await resp.json();
console.log(`[ok] ${Date.now() - t1}ms · done_reason=${data.done_reason ?? "-"}`);
console.log("--- ocr output ---");
console.log(data.message?.content ?? JSON.stringify(data, null, 2));
console.log("--- end ---");

try {
  const p = JSON.parse(data.message?.content ?? "{}");
  const regions = Array.isArray(p.text_regions) ? p.text_regions : [];
  console.log("[parsed]");
  console.log(`  has_any_text:       ${p.has_any_text}`);
  console.log(`  text_regions:       ${regions.length}`);
  regions.slice(0, 10).forEach((r, i) => console.log(`    [${i}] "${(r.text ?? "").slice(0, 100)}" @ ${r.location ?? "?"}`));
  console.log(`  reading_confidence: ${p.reading_confidence}`);
} catch (err) {
  console.log(`[warn] JSON parse failed: ${err.message}`);
}
console.log(`[done] total ${Date.now() - t0}ms · model=${MODEL}`);
