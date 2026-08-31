// scripts/nex-ollama/_client.mjs
//
// NEX Ollama HTTP client · Philip 2026-08-28.
//
// All local LLM calls flow through this. Zero API cost · Ollama runs on the
// same machine. Follows NEX Free Infrastructure principle: never pay per-token
// when we can run OSS locally.
//
// Contract:
//   generate({ model, prompt, system, temperature, num_predict }) → { text, ms }
//
// Errors surface as thrown Error with a clear reason so batch loops can retry.

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";

export async function generate({
  model,
  prompt,
  system = null,
  temperature = 0.2,
  num_predict = 512,
  timeoutMs = 120_000,
}) {
  if (!model) throw new Error("model required");
  if (!prompt) throw new Error("prompt required");

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        system,
        stream: false,
        options: { temperature, num_predict },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`ollama http ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    const text = String(json.response ?? "").trim();
    return { text, ms: Date.now() - started, raw: json };
  } finally {
    clearTimeout(timer);
  }
}

export async function health() {
  const res = await fetch(`${OLLAMA_URL}/api/tags`, { method: "GET" });
  if (!res.ok) throw new Error(`ollama tags http ${res.status}`);
  const json = await res.json();
  return {
    ok: true,
    models: (json.models ?? []).map((m) => m.name),
  };
}

export const MODELS = {
  translate: "qwen2.5:7b-instruct-q3_K_M",
  reason: "qwen2.5:7b-instruct-q3_K_M",
  fast: "qwen2.5:3b",
};
