#!/usr/bin/env node
// verify-failover-recovery.mjs
//
// Live proof of the local-first / cloud-fallback / recovery contract.
// Exercises the exact composition the /api/nex/converse/stream route
// dispatches, using the same resolver + runtime helpers, against the
// real local Ollama server plus deliberately-broken configurations.
//
// Scenarios covered (each produces a discrete PASS/FAIL line):
//   1. Baseline · Ollama healthy · route serves query locally
//   2. Ollama URL unreachable · resolveNexBrainWithFallback returns
//      the graceful next-in-chain (Anthropic if key set, else stub)
//   3. Model not installed · resolver falls through same way
//   4. runLocalFirstStream · pre-first-text error swaps silently to
//      the fallback runtime (composition-level, using fake providers
//      so we don't depend on Anthropic being reachable)
//   5. Recovery · after "outage" resolved, resolver returns Ollama
//      again on the next call (proves no bad-state caching)
//   6. Vision · registry role vision.primary_local resolves to
//      Qwen2.5-VL and adapter reports supportsVision=true
//
// Prereq: Ollama running with qwen2.5:7b-instruct-q3_K_M installed.
// Usage:  node scripts/verify-failover-recovery.mjs
// Exit:   0 = all scenarios green, 1 = one or more red.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

if (!process.env.__VERIFY_FAILOVER_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", "--env-file=.env.local", fileURLToPath(import.meta.url)],
    {
      stdio: "inherit",
      cwd: repoRoot,
      shell: true,
      env: { ...process.env, __VERIFY_FAILOVER_INNER__: "1" },
    },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { resolveNexBrainWithFallback } = await import("../src/lib/nex/brain/resolve.ts");
  const { createOllamaBrainProvider, probeOllama } = await import("../src/lib/nex/brain/providers/ollama.ts");
  const { runProviderStream } = await import("../src/lib/nex/runtimeProviderStream.ts");
  const { runLocalFirstStream } = await import("../src/lib/nex/runtimeLocalFirst.ts");
  const { getModelForRole } = await import("../src/lib/nex/brain/model-registry.ts");

  let failed = 0;
  const ok  = (s) => console.log("  ✓ " + s);
  const bad = (s) => { console.log("  ✗ " + s); failed++; };
  const info = (s) => console.log("  · " + s);

  // ── 0. Pre-flight ────────────────────────────────────────────
  console.log("\n[0/6] Pre-flight · Ollama reachable?");
  const preProbe = await probeOllama();
  if (!preProbe.ok) {
    bad(`Ollama unreachable — start with 'ollama serve' then rerun. Error: ${preProbe.error}`);
    process.exit(1);
  }
  ok(`Ollama up at ${preProbe.url} · models: ${preProbe.models.join(", ")}`);

  // ── 1. Baseline · healthy Ollama serves the query ────────────
  console.log("\n[1/6] Baseline · healthy Ollama serves the query");
  process.env.NEX_BRAIN_PROVIDER = "ollama";
  const r1 = await resolveNexBrainWithFallback({ role: "brain.fast_local" });
  if (!r1.provider.id.startsWith("ollama:")) bad(`expected ollama, got ${r1.provider.id}`);
  else {
    ok(`resolved to ${r1.provider.id}`);
    const events = await streamOnce(runProviderStream({
      provider: r1.provider,
      systemPrompt: "You are NEX. Answer in one short sentence.",
      messages: [{ role: "user", content: "Hi NEX, are you there?" }],
      tools: [],
      ctx: { surface: "visitor", userKey: "verify-failover" },
      maxTokens: 60, temperature: 0.2,
    }));
    const text = events.filter((e) => e.type === "text").map((e) => e.delta).join("");
    const done = events.find((e) => e.type === "done");
    if (text.length > 0 && done?.stoppedBy === "end_turn") ok(`reply: "${text.trim()}"`);
    else bad(`no text or bad stop reason: text="${text}" stoppedBy=${done?.stoppedBy}`);
  }

  // ── 2. Ollama URL unreachable · graceful next-in-chain ──────
  console.log("\n[2/6] Ollama URL unreachable · resolveNexBrainWithFallback returns next-in-chain");
  const r2 = await resolveNexBrainWithFallback({ forceOllama: { url: "http://127.0.0.1:65533" } });
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  if (hasAnthropicKey) {
    if (r2.provider.id.startsWith("anthropic:")) ok(`fell back to ${r2.provider.id} · reason: ${r2.reason}`);
    else bad(`expected anthropic fallback, got ${r2.provider.id}`);
  } else {
    if (!r2.isLive && /Ollama unavailable/.test(r2.reason)) ok(`no ANTHROPIC_API_KEY · returned stub · reason: ${r2.reason}`);
    else bad(`unexpected: id=${r2.provider.id} isLive=${r2.isLive} reason=${r2.reason}`);
  }

  // ── 3. Model not installed · same graceful fallthrough ──────
  console.log("\n[3/6] Model not installed · resolver falls through");
  const r3 = await resolveNexBrainWithFallback({ forceOllama: { model: "definitely:not-installed" } });
  if (hasAnthropicKey) {
    if (r3.provider.id.startsWith("anthropic:") && /not installed/.test(r3.reason)) ok(`fell back to ${r3.provider.id} · reason: ${r3.reason}`);
    else bad(`expected anthropic fallback with 'not installed' reason, got id=${r3.provider.id} reason=${r3.reason}`);
  } else {
    if (!r3.isLive && /model missing|not installed/.test(r3.reason)) ok(`no key · returned stub · reason: ${r3.reason}`);
    else bad(`unexpected: id=${r3.provider.id} isLive=${r3.isLive} reason=${r3.reason}`);
  }

  // ── 4. runLocalFirstStream · silent swap on pre-first-text error
  console.log("\n[4/6] runLocalFirstStream · pre-first-text error swaps to fallback");
  const doneErr = { type: "done", finalText: "NEX had a problem reaching the model: ollama_unreachable", toolCalls: [], uiCards: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }, latencyMs: 30, stoppedBy: "error" };
  const doneOK  = { type: "done", finalText: "Hello from the fallback.", toolCalls: [], uiCards: [], usage: { inputTokens: 4, outputTokens: 4, cacheReadTokens: 0, cacheCreationTokens: 0 }, latencyMs: 900, stoppedBy: "end_turn" };
  let swaps = 0;
  const merged = await streamOnce(runLocalFirstStream({
    local:   async function* () { yield doneErr; },
    fallback: async function* () {
      yield { type: "text", delta: "Hello " };
      yield { type: "text", delta: "from the fallback." };
      yield doneOK;
    },
    onSwap: () => { swaps++; },
  }));
  const mergedText = merged.filter((e) => e.type === "text").map((e) => e.delta).join("");
  if (swaps === 1 && mergedText === "Hello from the fallback." && merged.find((e) => e.type === "done")?.stoppedBy === "end_turn") ok(`silent swap fired · user saw fallback text · error done discarded`);
  else bad(`swap failed · swaps=${swaps} text="${mergedText}" done.stoppedBy=${merged.find((e) => e.type === "done")?.stoppedBy}`);

  // ── 5. Recovery · resolver returns Ollama again on next call ─
  console.log("\n[5/6] Recovery · resolver returns Ollama again on next call after 'outage' resolved");
  const r5 = await resolveNexBrainWithFallback({ role: "brain.primary_local" });
  if (r5.provider.id.startsWith("ollama:") && r5.isLive) ok(`recovered · resolved to ${r5.provider.id} · reason: ${r5.reason}`);
  else bad(`recovery failed · got id=${r5.provider.id} reason=${r5.reason}`);
  // Stream one more query to prove end-to-end works post-outage.
  const eventsPost = await streamOnce(runProviderStream({
    provider: r5.provider,
    systemPrompt: "You are NEX. One sentence.",
    messages: [{ role: "user", content: "Say 'ready' if you are online." }],
    tools: [],
    ctx: { surface: "visitor", userKey: "verify-failover" },
    maxTokens: 40, temperature: 0.1,
  }));
  const postText = eventsPost.filter((e) => e.type === "text").map((e) => e.delta).join("");
  if (/ready/i.test(postText)) ok(`post-recovery reply matches: "${postText.trim()}"`);
  else info(`post-recovery reply: "${postText.trim()}" (didn't include 'ready' but stream succeeded)`);

  // ── 6. Vision · registry resolves to Qwen-VL, caps report vision
  console.log("\n[6/6] Vision · registry role vision.primary_local + capability check");
  const visionEntry = getModelForRole("vision.primary_local");
  info(`vision.primary_local → ${visionEntry.ollamaTag}`);
  const r6 = await resolveNexBrainWithFallback({ role: "vision.primary_local" });
  if (r6.provider.id === `ollama:${visionEntry.ollamaTag}`) ok(`resolved to ${r6.provider.id}`);
  else bad(`expected ollama:${visionEntry.ollamaTag}, got ${r6.provider.id}`);
  if (r6.provider.capabilities.supportsVision) ok(`capabilities.supportsVision = true`);
  else bad(`vision provider reports supportsVision = false`);

  // Actual vision inference · send a 1x1 pixel PNG so we don't burn 30s.
  // The 1×1 red PNG data URL below decodes to a valid PNG file.
  const tinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
  const t0 = Date.now();
  const visionEvents = await streamOnce(runProviderStream({
    provider: r6.provider,
    systemPrompt: "You are NEX. Describe images very concisely.",
    messages: [{ role: "user", content: [
      { type: "image_url", url: `data:image/png;base64,${tinyPngBase64}` },
      { type: "text", text: "What colour is this image?" },
    ] }],
    tools: [],
    ctx: { surface: "visitor", userKey: "verify-failover" },
    maxTokens: 40, temperature: 0.1,
  }));
  const visionText = visionEvents.filter((e) => e.type === "text").map((e) => e.delta).join("");
  const visionWall = Date.now() - t0;
  if (visionText.trim().length > 0) ok(`vision inference produced text (${visionWall}ms): "${visionText.trim().slice(0, 120)}"`);
  else bad(`vision produced no text · wall=${visionWall}ms`);

  console.log(failed === 0 ? "\n✅ All failover / recovery / vision scenarios green." : `\n❌ ${failed} scenario(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

async function streamOnce(gen) {
  const out = [];
  for await (const e of gen) out.push(e);
  return out;
}
