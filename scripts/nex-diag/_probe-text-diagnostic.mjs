const URL = "https://ik.imagekit.io/nepgaxllc/UntitledDSDVVVVdfdffv.png?updatedAt=1778669593607";
const t0 = Date.now();
const img = await fetch(URL);
const buf = Buffer.from(await img.arrayBuffer());
const b64 = buf.toString("base64");
const r = await fetch("http://localhost:11434/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "qwen2.5vl:3b",
    messages: [{
      role: "user",
      content: "Look carefully at this image. Is there any visible text, numbers, symbols, or writing anywhere in the image (including on paper, blueprints, calculator buttons, or elsewhere)? Answer honestly. If yes, list what text you can read (even partial words or numbers). If no, say so.",
      images: [b64],
    }],
    stream: false,
  }),
});
const d = await r.json();
console.log("elapsed:", Date.now() - t0, "ms");
console.log("--- Qwen prose answer ---");
console.log(d.message?.content ?? JSON.stringify(d));
console.log("--- end ---");
