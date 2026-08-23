// scripts/nex-diag/test-vision-direct.mjs
//
// Task #69 · vision-model direct probe · 2026-08-22
// Generalises test-moondream-direct.mjs so any local Ollama vision model
// can be tested against any URL with the same three probes.
//
// Usage:
//   node scripts/nex-diag/test-vision-direct.mjs <model> <imageUrl>
//   node scripts/nex-diag/test-vision-direct.mjs qwen2.5vl:3b https://ik.imagekit.io/nepgaxllc/123.jpg
//
// Read-only · no DB writes · no adapter code changes. Purpose is to
// discover whether a given local model can (a) see the image, (b) produce
// structured JSON, before we commit to writing the adapter against it.

const MODEL = process.argv[2] ?? "moondream";
const URL = process.argv[3] ?? "https://ik.imagekit.io/nepgaxllc/Untitledh.png?updatedAt=1778678179560";
const OLLAMA = process.env.NEX_LOCAL_LLM_URL ?? "http://localhost:11434";

console.log(`[probe] model:  ${MODEL}`);
console.log(`[probe] target: ${URL}`);
console.log(`[probe] ollama: ${OLLAMA}`);
console.log("");

// 1. Fetch image bytes
console.log("[1/3] fetching image bytes...");
const t0 = Date.now();
const imgResp = await fetch(URL);
if (!imgResp.ok) {
  console.error(`[fail] image fetch: HTTP ${imgResp.status}`);
  process.exit(1);
}
const buf = Buffer.from(await imgResp.arrayBuffer());
const b64 = buf.toString("base64");
const contentType = imgResp.headers.get("content-type") ?? "unknown";
console.log(`[ok]  fetched ${buf.length} bytes · content-type ${contentType} · b64 length ${b64.length} chars · ${Date.now() - t0}ms`);
console.log("");

// 2. Prose probe (baseline · will it see the image?)
console.log("[2/3] prose probe...");
const t1 = Date.now();
const proseResp = await fetch(`${OLLAMA}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    messages: [{
      role: "user",
      content: "Describe exactly what you see in this image. Be specific. What objects are present, what materials or colors are visible, and does the image contain any readable text? If it is a product, staircase, tool, sign, or other trade-relevant subject, name it.",
      images: [b64],
    }],
    stream: false,
  }),
});
if (!proseResp.ok) {
  console.error(`[fail] ollama HTTP ${proseResp.status}`);
  console.error(await proseResp.text());
  process.exit(2);
}
const proseData = await proseResp.json();
console.log(`[ok]  ${Date.now() - t1}ms · done=${proseData.done}`);
console.log("--- prose output ---");
console.log(proseData.message?.content ?? JSON.stringify(proseData, null, 2));
console.log("--- end prose ---");
console.log("");

// 3. Structured JSON probe (the shape NEX needs)
console.log("[3/3] structured probe...");
const t2 = Date.now();
const jsonResp = await fetch(`${OLLAMA}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: "You are NEX's visual observation adapter. Analyse the image and return ONLY a single JSON object in this exact shape:\n" +
          '{"objects":["thing1","thing2"],"materials":["material1"],"colors":["color1"],"detected_text":"visible text or empty string","visible_details":["detail1","detail2"],"overall_confidence":0}\n' +
          "Rules: overall_confidence 0-100. Never invent things not visible. Never write sentences. Never repeat entries. Return one valid JSON object and stop.",
      },
      {
        role: "user",
        content: "Analyse this image and return the JSON object.",
        images: [b64],
      },
    ],
    stream: false,
    format: "json",
    options: {
      temperature: 0.1,
      num_predict: 512,
    },
  }),
});
if (!jsonResp.ok) {
  console.error(`[fail] ollama HTTP ${jsonResp.status}`);
  console.error(await jsonResp.text());
  process.exit(3);
}
const jsonData = await jsonResp.json();
console.log(`[ok]  ${Date.now() - t2}ms · done=${jsonData.done} · done_reason=${jsonData.done_reason ?? "-"}`);
console.log("--- structured output ---");
console.log(jsonData.message?.content ?? JSON.stringify(jsonData, null, 2));
console.log("--- end structured ---");
console.log("");

// 4. Parse check
let parsed = null;
try {
  parsed = JSON.parse(jsonData.message?.content ?? "{}");
  const objectsCount = Array.isArray(parsed.objects) ? parsed.objects.length : 0;
  const materialsCount = Array.isArray(parsed.materials) ? parsed.materials.length : 0;
  const colorsCount = Array.isArray(parsed.colors) ? parsed.colors.length : 0;
  const detailsCount = Array.isArray(parsed.visible_details) ? parsed.visible_details.length : 0;
  const hasText = typeof parsed.detected_text === "string" && parsed.detected_text.trim().length > 0;
  console.log("[ok] JSON parses cleanly");
  console.log(`     objects:            ${objectsCount}   ${objectsCount > 0 ? JSON.stringify(parsed.objects.slice(0, 5)) : ""}`);
  console.log(`     materials:          ${materialsCount} ${materialsCount > 0 ? JSON.stringify(parsed.materials.slice(0, 5)) : ""}`);
  console.log(`     colors:             ${colorsCount}    ${colorsCount > 0 ? JSON.stringify(parsed.colors.slice(0, 5)) : ""}`);
  console.log(`     visible_details:    ${detailsCount}   ${detailsCount > 0 ? JSON.stringify(parsed.visible_details.slice(0, 5)) : ""}`);
  console.log(`     detected_text:      ${hasText ? `"${parsed.detected_text.slice(0, 80)}"` : "(empty)"}`);
  console.log(`     overall_confidence: ${parsed.overall_confidence ?? "(unset)"}`);
} catch (err) {
  console.log(`[warn] JSON parse failed: ${err.message}`);
  console.log("       Adapter will need prompt tuning or coercion layer");
}

console.log("");
console.log(`[done] total elapsed: ${Date.now() - t0}ms · model=${MODEL}`);
