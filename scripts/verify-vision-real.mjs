#!/usr/bin/env node
// verify-vision-real.mjs
//
// Real vision test with real images through the actual NEX provider
// layer. Uses three real repo images with known ground truth so we
// can verify model answers rather than eyeball them.
//
// Test images (in public/):
//   badge-01.png     · yellow flatbed truck loaded with lumber ·
//                      text "HOT OFF THE TRUCK" · 467×202
//   staircase-01.png · interior mahogany staircase · text
//                      "MAHOGANY STAIRS · CLASSIC ELEGANCE ·
//                      BUILT TO INSPIRE" + bullets + CTA
//   kitchens-01.png  · modern kitchen · island + green bar stools
//                      · text "KITCHEN MANIA · PRICES JUST DROPPED"
//
// Scenarios (per the audit spec):
//   1. Object recognition
//   2. Text reading
//   3. Screenshot / composed image understanding
//   4. Indonesian question
//   5. Mixed Indonesian/English
//   6. Business/product image · no hallucination check
//
// Also runs each test twice: warm timing + a moondream comparison.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFile } from "node:fs/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

if (!process.env.__VERIFY_VISION_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", "--env-file=.env.local", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __VERIFY_VISION_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { createOllamaBrainProvider, probeOllama } = await import("../src/lib/nex/brain/providers/ollama.ts");
  const { runProviderStream } = await import("../src/lib/nex/runtimeProviderStream.ts");

  const line = (s) => console.log(s);

  const preProbe = await probeOllama();
  if (!preProbe.ok) { console.log("Ollama not up: " + preProbe.error); process.exit(1); }
  line(`Ollama at ${preProbe.url} · ${preProbe.models.length} models installed`);

  // Force-unload every vision model first · isolates the test from any
  // prior corrupted-state from other test runs (see verify-failover-recovery
  // + verify-vision-real interaction on 2026-08-30 · qwen-vl produced @@@
  // gibberish when hit rapidly after moondream).
  for (const m of ["qwen2.5vl:3b", "moondream:latest", "qwen2.5:7b-instruct-q3_K_M", "qwen2.5:3b"]) {
    await fetch("http://localhost:11434/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: m, keep_alive: 0 }),
    }).catch(() => undefined);
  }
  await new Promise((r) => setTimeout(r, 2000));
  line("(force-unloaded all models · starting from cold)");

  // Load test images.
  const imgs = {
    truck:      await loadImage(path.join(repoRoot, "public/badges/badge-01.png")),
    staircase:  await loadImage(path.join(repoRoot, "public/crown-banners/staircase-01.png")),
    kitchen:    await loadImage(path.join(repoRoot, "public/crown-banners/kitchens-01.png")),
  };
  for (const [name, img] of Object.entries(imgs)) line(`  · ${name}: ${(img.base64.length / 1024).toFixed(1)} KB base64 · ${img.mime}`);

  const modelUnderTest = "qwen2.5vl:3b";
  const provider = createOllamaBrainProvider({ model: modelUnderTest, stream: true });
  line(`\n=== Vision model: ${modelUnderTest} · supportsVision=${provider.capabilities.supportsVision} ===`);

  const results = [];

  // ── 1. Object recognition ────────────────────────────────────
  results.push(await runVisionCase({
    provider, id: "1_object",
    img: imgs.truck,
    system: "You are NEX, a helpful concise assistant. Describe images in one short sentence.",
    prompt: "What do you see in this image?",
    expect: [/truck/i, /lumber|wood|timber|log|plank/i],
  }));

  // ── 2. Text reading ──────────────────────────────────────────
  results.push(await runVisionCase({
    provider, id: "2_text",
    img: imgs.staircase,
    system: "You are NEX. Read text from images accurately. Reply with just the text you see, nothing else.",
    prompt: "What text appears in this image? Just list the text, no commentary.",
    expect: [/mahogany/i, /(elegance|classic)/i],
  }));

  // ── 3. Screenshot / composed-image understanding ─────────────
  results.push(await runVisionCase({
    provider, id: "3_compose",
    img: imgs.staircase,
    system: "You are NEX. Explain what a user would understand from an ad image.",
    prompt: "This is a marketing image. What product is it selling, and what is the main visual?",
    expect: [/(stair|staircase)/i, /(mahogany|wood)/i],
  }));

  // ── 4. Indonesian ────────────────────────────────────────────
  results.push(await runVisionCase({
    provider, id: "4_indonesian",
    img: imgs.kitchen,
    system: "Anda adalah NEX. Jawab dalam Bahasa Indonesia yang jelas dan singkat.",
    prompt: "Apa yang Anda lihat dalam gambar ini? Sebutkan objek utama.",
    // Response should mention kitchen elements in Indonesian
    expect: [/(dapur|kitchen|island|kursi|bar|stool)/i],
  }));

  // ── 5. Mixed Indonesian + English terms ──────────────────────
  results.push(await runVisionCase({
    provider, id: "5_mixed",
    img: imgs.kitchen,
    system: "Anda adalah NEX. Boleh gunakan istilah teknis dalam Bahasa Inggris ketika perlu.",
    prompt: "Ini gambar dapur untuk marketing. Jelaskan style-nya dan komponen apa saja yang terlihat (island, bar stool, appliances, dsb).",
    expect: [/(dapur|kitchen)/i, /(modern|island|bar|stool|kursi)/i],
  }));

  // ── 6. Business/product · no-hallucination check ─────────────
  results.push(await runVisionCase({
    provider, id: "6_business",
    img: imgs.truck,
    system: "You are NEX. Only describe what is actually visible in the image. Do NOT invent prices, brand names, phone numbers, or details you cannot see.",
    prompt: "Describe this product photograph as if writing an honest inventory note. Do not invent anything.",
    // Should NOT contain fabricated prices/phones
    expect: [/(truck|vehicle)/i],
    rejectPatterns: [/\$\d/, /£\d/, /\+\d{7,}/, /\d{3}-\d{3}-\d{4}/],
  }));

  // ── 7. Optional · moondream comparison on the object test ───
  const moondreamInstalled = preProbe.models.includes("moondream:latest");
  if (moondreamInstalled) {
    line(`\n=== Comparison model: moondream:latest ===`);
    const md = createOllamaBrainProvider({ model: "moondream:latest", stream: true });
    results.push(await runVisionCase({
      provider: md, id: "1_object_moondream",
      img: imgs.truck,
      system: "Describe images in one short sentence.",
      prompt: "What do you see in this image?",
      expect: [/truck/i],
    }));
  }

  // Summary
  line("\n═══════════════════════════════════════════════════════════");
  line("  #  case                wall     first    tokens  verdict");
  line("─────────────────────────────────────────────────────────────");
  let passed = 0, failed = 0;
  for (const r of results) {
    const pad = (s, w) => (String(s) + " ".repeat(w)).slice(0, w);
    const okStr = r.pass ? "✓ PASS" : "✗ FAIL";
    line(`  ${pad(r.id, 22)}${pad(r.wall + "ms", 9)}${pad(r.firstDelta + "ms", 9)}${pad(r.tokens, 8)}${okStr}`);
    if (r.pass) passed++; else failed++;
  }
  line("─────────────────────────────────────────────────────────────");
  line(`  ${passed} passed · ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

async function loadImage(filePath) {
  const buf = await readFile(filePath);
  const base64 = buf.toString("base64");
  const mime = filePath.endsWith(".png") ? "image/png" : "image/jpeg";
  return { base64, mime };
}

async function runVisionCase({ provider, id, img, system, prompt, expect, rejectPatterns }) {
  console.log(`\n[${id}] ${prompt}`);
  const t0 = Date.now();
  let firstDelta = 0;
  let text = "";
  let tokens = 0;
  let stoppedBy = "unknown";

  try {
    for await (const evt of provider.chat({
      systemPrompt: system,
      messages: [{ role: "user", content: [
        { type: "image_url", url: `data:${img.mime};base64,${img.base64}` },
        { type: "text", text: prompt },
      ] }],
      maxTokens: 220,
      temperature: 0.2,
    })) {
      if (evt.type === "text_delta") {
        if (!firstDelta) firstDelta = Date.now() - t0;
        text += evt.text;
      } else if (evt.type === "done") {
        tokens = evt.usage.outputTokens;
        stoppedBy = evt.stopReason;
      } else if (evt.type === "error") {
        console.log("  ERROR:", evt.error);
        return { id, wall: Date.now() - t0, firstDelta, tokens, pass: false, text: evt.error };
      }
    }
  } catch (e) {
    console.log("  EXC:", e.message);
    return { id, wall: Date.now() - t0, firstDelta: 0, tokens: 0, pass: false, text: e.message };
  }
  const wall = Date.now() - t0;
  console.log(`  reply: ${text.replace(/\s+/g, " ").trim().slice(0, 260)}`);
  console.log(`  wall=${wall}ms first=${firstDelta}ms tokens=${tokens} stop=${stoppedBy}`);

  let pass = true;
  const misses = [];
  for (const rx of expect) {
    if (!rx.test(text)) { pass = false; misses.push(rx.toString()); }
  }
  if (rejectPatterns) {
    for (const rx of rejectPatterns) {
      if (rx.test(text)) { pass = false; misses.push(`REJECT ${rx}`); }
    }
  }
  if (!pass) console.log(`  MISS: ${misses.join(", ")}`);

  return { id, wall, firstDelta, tokens, pass, text };
}
