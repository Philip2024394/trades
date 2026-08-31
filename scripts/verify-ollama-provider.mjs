#!/usr/bin/env node
// verify-ollama-provider.mjs
//
// End-to-end verification of the NEX Brain Ollama provider against
// a real local Ollama server. Runs three probes:
//   1) Availability check (probeOllama)
//   2) Streaming EN chat  — token-by-token delta arrival
//   3) Streaming ID chat  — Indonesian coverage
//   4) Tool-call round-trip — model emits a structured function call
//   5) Fallback semantics — Ollama-down path via resolveNexBrainWithFallback
//
// Usage:
//   NEX_BRAIN_PROVIDER=ollama node scripts/verify-ollama-provider.mjs
//
// Exit codes:
//   0 · all probes green
//   1 · at least one probe failed (see console output)
//
// Design notes:
//   - Loads the compiled provider via tsx so this script tracks the
//     real production code path, not a stubbed copy.
//   - Never mocks fetch · always hits the local Ollama server.
//   - Prints wall-clock + token counts so we can see real throughput.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

// Run through tsx so the TS provider modules resolve exactly as they
// do in Next runtime · avoids compiling to /dist just for this script.
if (!process.env.__VERIFY_OLLAMA_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", "--env-file=.env.local", fileURLToPath(import.meta.url)],
    {
      stdio: "inherit",
      cwd: repoRoot,
      shell: true,
      env: { ...process.env, __VERIFY_OLLAMA_INNER__: "1" },
    },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { probeOllama, createOllamaBrainProvider } = await import("../src/lib/nex/brain/providers/ollama.ts");
  const { resolveNexBrainWithFallback } = await import("../src/lib/nex/brain/resolve.ts");
  const { runProviderStream } = await import("../src/lib/nex/runtimeProviderStream.ts");
  const { listRoleAssignments } = await import("../src/lib/nex/brain/model-registry.ts");

  let failed = 0;
  const line = (s) => console.log(s);
  const ok  = (s) => { console.log("  ✓ " + s); };
  const bad = (s) => { console.log("  ✗ " + s); failed++; };

  // ── 1. Availability probe ──────────────────────────────────────
  line("\n[1/5] Availability probe (probeOllama)");
  const probe = await probeOllama();
  if (!probe.ok) {
    bad(`probe failed: ${probe.error} · Ollama unreachable at ${probe.url}`);
    line("\nSkipping remaining probes — start Ollama with `ollama serve` then rerun.");
    process.exit(1);
  }
  ok(`server reachable at ${probe.url}`);
  ok(`${probe.models.length} model(s) installed: ${probe.models.join(", ")}`);
  if (!probe.modelInstalled) {
    bad(`selected model '${probe.selectedModel}' NOT installed · run 'ollama pull ${probe.selectedModel}'`);
  } else {
    ok(`selected model '${probe.selectedModel}' installed`);
  }

  const provider = createOllamaBrainProvider({ stream: true });
  line(`  provider.id = ${provider.id}`);
  line(`  capabilities = ${JSON.stringify(provider.capabilities)}`);

  // ── 2. Streaming EN ────────────────────────────────────────────
  line("\n[2/5] Streaming EN chat");
  await streamProbe({
    provider,
    systemPrompt: "You are NEX, a helpful concise assistant. Reply in one short sentence.",
    userMessage: "What is the capital of Indonesia?",
    expectContains: /jakarta/i,
    ok, bad,
  });

  // ── 3. Streaming ID ────────────────────────────────────────────
  line("\n[3/5] Streaming ID chat");
  await streamProbe({
    provider,
    systemPrompt: "Anda adalah NEX, asisten yang membantu. Jawab dalam satu kalimat singkat dalam Bahasa Indonesia.",
    userMessage: "Apa ibu kota Bali?",
    expectContains: /denpasar/i,
    ok, bad,
  });

  // ── 4. Tool-call round-trip ────────────────────────────────────
  line("\n[4/5] Tool-call round-trip");
  const toolEvents = await collect(provider.chat({
    systemPrompt: "You are NEX. When the user asks for a business, call the find_local_business tool.",
    messages: [{ role: "user", content: "Find me a Japanese restaurant in Seminyak, Bali." }],
    tools: [{
      name: "find_local_business",
      description: "Search the NEX directory for a business",
      inputSchema: {
        type: "object",
        properties: {
          cuisine: { type: "string", description: "Cuisine or business category" },
          area:    { type: "string", description: "Neighbourhood or city" },
        },
        required: ["cuisine", "area"],
      },
    }],
    maxTokens: 150,
  }));
  const ready = toolEvents.find((e) => e.type === "tool_call_ready");
  if (!ready) {
    bad("model did NOT emit a tool_call · downgrade to a simpler question or check model tools capability");
  } else {
    ok(`tool_call_ready emitted: name=${ready.toolName} input=${JSON.stringify(ready.input)}`);
    const done = toolEvents.find((e) => e.type === "done");
    if (done?.stopReason !== "tool_use") bad(`stopReason should be 'tool_use', got '${done?.stopReason}'`);
    else ok("stopReason=tool_use");
  }

  // ── 5. Fallback semantics ──────────────────────────────────────
  line("\n[5/5] resolveNexBrainWithFallback · Ollama available → picks Ollama");
  const r1 = await resolveNexBrainWithFallback({ forceOllama: true });
  if (r1.provider.id.startsWith("ollama:") && r1.isLive) {
    ok(`resolved to ${r1.provider.id} (reason: ${r1.reason})`);
  } else {
    bad(`expected ollama:*, got ${r1.provider.id} (reason: ${r1.reason})`);
  }

  line("\n[5/5b] resolveNexBrainWithFallback · Ollama URL unreachable → falls back if ANTHROPIC_API_KEY set");
  const r2 = await resolveNexBrainWithFallback({ forceOllama: { url: "http://127.0.0.1:65533" } });
  if (process.env.ANTHROPIC_API_KEY) {
    if (r2.provider.id.startsWith("anthropic:") && r2.isLive) {
      ok(`fell back to ${r2.provider.id} (reason: ${r2.reason})`);
    } else {
      bad(`expected anthropic:* fallback, got ${r2.provider.id} (reason: ${r2.reason})`);
    }
  } else {
    if (!r2.isLive && r2.reason.includes("Ollama unavailable")) {
      ok(`no ANTHROPIC_API_KEY · returned stub with reason: ${r2.reason}`);
    } else {
      bad(`unexpected resolution without ANTHROPIC_API_KEY: ${r2.provider.id} (reason: ${r2.reason})`);
    }
  }

  // ── 6. Model registry ─────────────────────────────────────────
  line("\n[6] Model registry · role assignments");
  const assignments = listRoleAssignments();
  for (const a of assignments) {
    line(`  ${a.role.padEnd(24)} → ${a.ollamaTag.padEnd(30)} · tools=${a.supportsTools} · vision=${a.supportsVision} · ctx=${a.contextTokens}`);
  }
  const brainPrimary = assignments.find((a) => a.role === "brain.primary_local");
  if (brainPrimary?.ollamaTag === probe.selectedModel) ok(`brain.primary_local aligns with adapter default`);
  else bad(`brain.primary_local (${brainPrimary?.ollamaTag}) != adapter default (${probe.selectedModel})`);

  // ── 7. Full runtime path · runProviderStream through Ollama ───
  line("\n[7] Full runtime path · runProviderStream → provider → Ollama");
  const runtimeResolution = await resolveNexBrainWithFallback({ forceOllama: true });
  const runtimeEvents = [];
  const t0 = Date.now();
  let firstDeltaAt = 0;
  let text = "";

  for await (const evt of runProviderStream({
    provider: runtimeResolution.provider,
    systemPrompt: "You are NEX, a helpful concise assistant. Reply in one short sentence.",
    messages: [{ role: "user", content: "What is 2 + 2?" }],
    tools: [],
    ctx: { surface: "visitor", userKey: "verify-script" },
    maxTokens: 80, temperature: 0.2,
  })) {
    runtimeEvents.push(evt);
    if (evt.type === "text") { if (!firstDeltaAt) firstDeltaAt = Date.now() - t0; text += evt.delta; }
  }
  const wall = Date.now() - t0;
  console.log(`  reply: ${text.replace(/\s+/g, " ").trim()}`);
  console.log(`  wall=${wall}ms  first_delta=${firstDeltaAt}ms  events=${runtimeEvents.length}`);

  const runtimeDone = runtimeEvents.find((e) => e.type === "done");
  if (!runtimeDone) bad("runtime did not emit a done event");
  else {
    ok(`stoppedBy=${runtimeDone.stoppedBy}`);
    ok(`usage: in=${runtimeDone.usage.inputTokens} out=${runtimeDone.usage.outputTokens}`);
    if (/4/.test(text)) ok("answer contains '4'");
    else bad("expected '4' in reply");
  }

  line(failed === 0 ? "\n✅ All probes passed." : `\n❌ ${failed} probe(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

async function streamProbe({ provider, systemPrompt, userMessage, expectContains, ok, bad }) {
  const t0 = Date.now();
  let firstDeltaAt = 0;
  let chunkCount = 0;
  let text = "";
  let doneEvent;

  for await (const e of provider.chat({ systemPrompt, messages: [{ role: "user", content: userMessage }], maxTokens: 120, temperature: 0.3 })) {
    if (e.type === "text_delta") {
      if (!firstDeltaAt) firstDeltaAt = Date.now() - t0;
      chunkCount++;
      text += e.text;
    } else if (e.type === "done") {
      doneEvent = e;
    } else if (e.type === "error") {
      bad(`stream error: ${e.error}`);
      return;
    }
  }
  const wall = Date.now() - t0;

  console.log(`  reply: ${text.replace(/\s+/g, " ").slice(0, 160)}${text.length > 160 ? "…" : ""}`);
  console.log(`  wall=${wall}ms  first_delta=${firstDeltaAt}ms  chunks=${chunkCount}  tokens=${doneEvent?.usage?.outputTokens ?? 0}  tps=${doneEvent?.usage?.outputTokens ? ((doneEvent.usage.outputTokens / (wall / 1000)) | 0) : "?"}`);

  if (chunkCount < 2) bad(`expected >1 stream chunks, got ${chunkCount} · streaming appears broken`);
  else ok(`streamed in ${chunkCount} chunks`);
  if (!expectContains.test(text)) bad(`response did not contain expected pattern ${expectContains}`);
  else ok(`response matched expected pattern`);
}

async function collect(gen) {
  const out = [];
  for await (const e of gen) out.push(e);
  return out;
}
