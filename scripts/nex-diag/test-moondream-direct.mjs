// scripts/nex-diag/test-moondream-direct.mjs
//
// Task #69 · Step 2 verification · 2026-08-22
// Directly probe Moondream2 via local Ollama against one of Philip's
// existing ImageKit URLs. Read-only · no DB writes · no adapter code yet.
// Purpose: prove the model can actually inspect pixels on THIS machine
// before committing to write vision-moondream.ts.
//
// Success criteria (evidence-based):
//   1 · Ollama responds within reasonable time (<60s first cold call)
//   2 · Model output mentions concrete visible content
//   3 · Model can be steered toward structured output via prompt
//
// If any criterion fails, we stop and reassess — don't build the adapter
// against a model that can't actually see.

const URL = process.argv[2] ?? "https://ik.imagekit.io/nepgaxllc/Untitledh.png?updatedAt=1778678179560";
const OLLAMA = process.env.NEX_LOCAL_LLM_URL ?? "http://localhost:11434";

console.log(`[probe] target: ${URL}`);
console.log(`[probe] ollama: ${OLLAMA}`);
console.log(`[probe] model:  moondream`);
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

// 2. Ask Moondream in prose mode first (baseline · will it see the image?)
console.log("[2/3] prose probe · asking moondream to describe the image...");
const t1 = Date.now();
const proseResp = await fetch(`${OLLAMA}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "moondream",
    messages: [{
      role: "user",
      content: "Describe exactly what you see in this image. Be specific. What are the objects, colors, and any text visible?",
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

// 3. Ask Moondream for STRUCTURED JSON (the shape NEX actually needs)
console.log("[3/3] structured probe · same image, JSON output...");
const t2 = Date.now();
const jsonResp = await fetch(`${OLLAMA}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "moondream",
    messages: [
      {
        role: "system",
        content: "You are NEX's visual observation adapter. Return ONLY valid JSON in this exact shape and nothing else:\n" +
          '{"objects":["item1","item2"],"attributes":[{"target":"objectName","value":"attribute description"}],"detected_text":"text or empty","overall_confidence":0}\n' +
          "Confidence 0-100. Never write sentences. Never invent objects not visible.",
      },
      {
        role: "user",
        content: "Analyse this image and return the JSON.",
        images: [b64],
      },
    ],
    stream: false,
    format: "json",
  }),
});
if (!jsonResp.ok) {
  console.error(`[fail] ollama HTTP ${jsonResp.status}`);
  console.error(await jsonResp.text());
  process.exit(3);
}
const jsonData = await jsonResp.json();
console.log(`[ok]  ${Date.now() - t2}ms · done=${jsonData.done}`);
console.log("--- structured output ---");
console.log(jsonData.message?.content ?? JSON.stringify(jsonData, null, 2));
console.log("--- end structured ---");
console.log("");

// 4. Sanity check · can it be parsed as JSON?
let parsed = null;
try {
  parsed = JSON.parse(jsonData.message?.content ?? "{}");
  console.log("[ok] JSON parses cleanly");
  console.log(`     objects:          ${(parsed.objects ?? []).length}`);
  console.log(`     attributes:       ${(parsed.attributes ?? []).length}`);
  console.log(`     detected_text:    ${parsed.detected_text ? `"${parsed.detected_text.slice(0, 60)}"` : "(empty)"}`);
  console.log(`     overall_confidence: ${parsed.overall_confidence ?? "(unset)"}`);
} catch (err) {
  console.log(`[warn] JSON parse failed: ${err.message}`);
  console.log("       Adapter will need prompt tuning or coercion layer");
}

console.log("");
console.log(`[done] total elapsed: ${Date.now() - t0}ms`);
