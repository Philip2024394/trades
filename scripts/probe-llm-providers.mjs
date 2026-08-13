#!/usr/bin/env node
// probe-llm-providers.mjs
//
// Health probe for every free-tier LLM provider wired into
// src/lib/nex/brain/llm.ts. Hits each provider's chat-completions
// endpoint with a tiny "ping" prompt, reports OK/FAIL + latency +
// tokens, and flags which providers are ACTIVE for the 24/7
// Nex Brain worker on Fly.io.
//
// Usage:
//   node scripts/probe-llm-providers.mjs
//   node scripts/probe-llm-providers.mjs --only groq,gemini
//
// Env is loaded from .env.local (repo root). No dotenv dep.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILE = ".env.local";

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}
loadDotEnv(resolve(process.cwd(), ENV_FILE));

const PROBE_PROMPT = "Reply with the single word: pong";
const TIMEOUT_MS = 20_000;

const PROVIDERS = [
  {
    name: "sambanova",
    env: "SAMBANOVA_API_KEY",
    model: "Meta-Llama-3.3-70B-Instruct",
    call: openaiCompat("https://api.sambanova.ai/v1/chat/completions"),
  },
  {
    name: "groq",
    env: "GROQ_API_KEY",
    model: "llama-3.3-70b-versatile",
    call: openaiCompat("https://api.groq.com/openai/v1/chat/completions"),
  },
  {
    name: "gemini",
    env: "GOOGLE_GEMINI_API_KEY",
    model: "gemini-flash-latest",
    call: callGemini,
  },
  {
    name: "openrouter",
    env: "OPENROUTER_API_KEY",
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    call: openaiCompat("https://openrouter.ai/api/v1/chat/completions", {
      "http-referer": "https://asknex.app",
      "x-title": "NEX Brain",
    }),
  },
  {
    name: "cerebras",
    env: "CEREBRAS_API_KEY",
    model: "gpt-oss-120b",
    call: openaiCompat("https://api.cerebras.ai/v1/chat/completions"),
  },
  {
    name: "mistral",
    env: "MISTRAL_API_KEY",
    model: "mistral-small-latest",
    call: openaiCompat("https://api.mistral.ai/v1/chat/completions"),
  },
  {
    name: "cloudflare",
    env: "CLOUDFLARE_WORKERS_AI_TOKEN",
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    call: callCloudflare,
  },
  {
    name: "huggingface",
    env: "HUGGINGFACE_API_KEY",
    model: "meta-llama/Llama-3.3-70B-Instruct",
    call: openaiCompat("https://router.huggingface.co/v1/chat/completions"),
  },
  {
    name: "anthropic",
    env: "ANTHROPIC_API_KEY",
    model: "claude-haiku-4-5-20251001",
    call: callAnthropic,
    optional: true, // emergency only — expected empty
  },
];

function openaiCompat(url, extraHeaders = {}) {
  return async ({ key, model }) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
          ...extraHeaders,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: PROBE_PROMPT }],
          max_tokens: 8,
          temperature: 0,
        }),
        signal: ctrl.signal,
      });
      const raw = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 180)}`);
      const j = safeJson(raw);
      if (j?.error) throw new Error(`upstream: ${JSON.stringify(j.error).slice(0, 180)}`);
      return {
        text: j?.choices?.[0]?.message?.content ?? "",
        tokens_in: j?.usage?.prompt_tokens ?? 0,
        tokens_out: j?.usage?.completion_tokens ?? 0,
      };
    } finally {
      clearTimeout(t);
    }
  };
}

async function callGemini({ key, model }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: PROBE_PROMPT }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8 },
      }),
      signal: ctrl.signal,
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 180)}`);
    const j = safeJson(raw);
    if (j?.error) throw new Error(`upstream: ${JSON.stringify(j.error).slice(0, 180)}`);
    const text =
      j?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return {
      text,
      tokens_in: j?.usageMetadata?.promptTokenCount ?? 0,
      tokens_out: j?.usageMetadata?.candidatesTokenCount ?? 0,
    };
  } finally {
    clearTimeout(t);
  }
}

async function callCloudflare({ key, model }) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID not set (required alongside token)");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: PROBE_PROMPT }],
        max_tokens: 8,
        temperature: 0,
        stream: false,
      }),
      signal: ctrl.signal,
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 180)}`);
    const j = safeJson(raw);
    if (j && j.success === false) throw new Error(`upstream: ${JSON.stringify(j.errors ?? []).slice(0, 180)}`);
    return {
      text: j?.result?.response ?? "",
      tokens_in: j?.result?.usage?.prompt_tokens ?? 0,
      tokens_out: j?.result?.usage?.completion_tokens ?? 0,
    };
  } finally {
    clearTimeout(t);
  }
}

async function callAnthropic({ key, model }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8,
        messages: [{ role: "user", content: PROBE_PROMPT }],
      }),
      signal: ctrl.signal,
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 180)}`);
    const j = safeJson(raw);
    if (j?.error) throw new Error(`upstream: ${JSON.stringify(j.error).slice(0, 180)}`);
    return {
      text: j?.content?.map((b) => b.text ?? "").join("") ?? "",
      tokens_in: j?.usage?.input_tokens ?? 0,
      tokens_out: j?.usage?.output_tokens ?? 0,
    };
  } finally {
    clearTimeout(t);
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function maskKey(k) {
  if (!k) return "—";
  if (k.length <= 10) return "***";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

async function probe(p) {
  const key = process.env[p.env];
  if (!key) {
    return { ...p, status: "MISSING", ms: 0, key: null };
  }
  const start = Date.now();
  try {
    const r = await p.call({ key, model: p.model });
    return {
      ...p,
      status: "OK",
      ms: Date.now() - start,
      key,
      reply: (r.text || "").trim().slice(0, 40),
      tokens_in: r.tokens_in,
      tokens_out: r.tokens_out,
    };
  } catch (e) {
    return {
      ...p,
      status: "FAIL",
      ms: Date.now() - start,
      key,
      error: e?.message ?? String(e),
    };
  }
}

const only = (() => {
  const arg = process.argv.find((a) => a.startsWith("--only="));
  if (!arg) return null;
  return new Set(arg.slice("--only=".length).split(",").map((s) => s.trim()));
})();

const targets = only ? PROVIDERS.filter((p) => only.has(p.name)) : PROVIDERS;

console.log(`\nProbing ${targets.length} providers · timeout ${TIMEOUT_MS / 1000}s each · in parallel`);
console.log(`Chain in .env.local · LLM_PROVIDER_CHAIN=${process.env.LLM_PROVIDER_CHAIN || "(unset)"}\n`);

const results = await Promise.all(targets.map(probe));

const row = (r) => {
  const badge =
    r.status === "OK" ? "\x1b[32m✓ OK\x1b[0m" :
    r.status === "MISSING" ? "\x1b[90m∅ MISSING\x1b[0m" :
    "\x1b[31m✗ FAIL\x1b[0m";
  const timing = r.status === "OK" ? `${String(r.ms).padStart(5)} ms` : "      ";
  const tokens = r.status === "OK" ? `in=${r.tokens_in} out=${r.tokens_out}` : "";
  const key = maskKey(r.key);
  const detail =
    r.status === "OK" ? `reply="${r.reply}" ${tokens}` :
    r.status === "FAIL" ? `\x1b[31m${(r.error || "").slice(0, 140)}\x1b[0m` :
    "not set";
  console.log(
    `  ${badge.padEnd(20)} ${r.name.padEnd(11)} ${key.padEnd(12)} ${timing}  ${detail}`
  );
};

results.forEach(row);

const ok = results.filter((r) => r.status === "OK").map((r) => r.name);
const fail = results.filter((r) => r.status === "FAIL").map((r) => r.name);
const missing = results.filter((r) => r.status === "MISSING").map((r) => r.name);

console.log("");
console.log(`Active  : ${ok.length ? ok.join(", ") : "(none)"}`);
if (fail.length) console.log(`Failing : ${fail.join(", ")}`);
if (missing.length) console.log(`Unset   : ${missing.join(", ")}`);

const chain = (process.env.LLM_PROVIDER_CHAIN || "").split(",").map((s) => s.trim()).filter(Boolean);
if (chain.length) {
  const dead = chain.filter((c) => !ok.includes(c));
  if (dead.length) {
    console.log(`\n\x1b[33mWarning:\x1b[0m LLM_PROVIDER_CHAIN references providers that failed the probe: ${dead.join(", ")}`);
  } else {
    console.log(`\n\x1b[32mAll providers in LLM_PROVIDER_CHAIN passed.\x1b[0m`);
  }
  const unused = ok.filter((o) => !chain.includes(o));
  if (unused.length) {
    console.log(`Note: ${unused.join(", ")} ${unused.length === 1 ? "is" : "are"} healthy but not in the chain.`);
  }
}

process.exit(fail.length ? 1 : 0);
