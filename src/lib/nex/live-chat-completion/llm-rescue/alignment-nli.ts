// src/lib/nex/live-chat-completion/llm-rescue/alignment-nli.ts
//
// Founder RB-3 · Ollama NLI hook for Fabrication Gate v2 alignment.
//
// Optional higher-fidelity scorer that uses a local Ollama model to
// judge whether the cited evidence text ENTAILS the claim text. When
// enabled and Ollama is reachable, this score is combined with the
// deterministic char-trigram + token-overlap score (max wins). When
// disabled OR Ollama is unreachable, this module silently returns
// null and the deterministic score alone gates the claim.
//
// Doctrine #1 preserved: this can only STRENGTHEN alignment — if the
// combined score rises, the claim survives when it would've been
// borderline. If Ollama rejects (low NLI score), the deterministic
// score is what gates. The NLI hook never elevates a claim that the
// deterministic scorer already rejected — it can only add signal.
//
// Non-blocking · always returns quickly · never crashes the gate.

const OLLAMA_BASE = process.env.NEX_OLLAMA_URL ?? "http://localhost:11434";
const NLI_MODEL = process.env.NEX_GATE_ALIGNMENT_NLI_MODEL ?? "qwen2.5:3b";
const NLI_TIMEOUT_MS = (() => {
  const raw = Number(process.env.NEX_GATE_ALIGNMENT_NLI_TIMEOUT_MS ?? 800);
  return Number.isFinite(raw) && raw >= 100 && raw <= 10_000 ? raw : 800;
})();

const _NLI_SYSTEM = `You are an entailment classifier. Given EVIDENCE and CLAIM, respond with EXACTLY one word:
- ENTAILS   · if the evidence supports the claim
- CONTRADICTS · if the evidence contradicts the claim
- NEUTRAL   · if the evidence is not related to the claim
No other output. No explanation. One word only.`;

export function isNliEnabled(): boolean {
  const v = process.env.NEX_GATE_ALIGNMENT_NLI;
  return v === "1" || v === "true" || v === "on";
}

export interface NliScore {
  score: number;                // 0..1 · higher = evidence supports claim
  verdict: "entails" | "contradicts" | "neutral" | "error";
  latency_ms: number;
  error?: string;
}

/**
 * Score alignment via Ollama NLI-style classification.
 * Returns null when disabled or Ollama unreachable so the caller can
 * cleanly fall back to the deterministic scorer.
 */
export async function scoreNliAlignment(claim_text: string, cited_text: string): Promise<NliScore | null> {
  if (!isNliEnabled()) return null;
  const t0 = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("nli_timeout", "AbortError")), NLI_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: NLI_MODEL,
        system: _NLI_SYSTEM,
        prompt: `EVIDENCE: ${cited_text.slice(0, 1500)}\nCLAIM: ${claim_text.slice(0, 400)}\nRESPONSE:`,
        stream: false,
        options: {
          temperature: 0,
          top_p: 0.1,
          num_predict: 4,
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => ({}));
    const raw = String(body?.response ?? "").trim().toUpperCase();
    const verdict: NliScore["verdict"] = raw.startsWith("ENTAILS") ? "entails"
      : raw.startsWith("CONTRADICTS") ? "contradicts"
      : raw.startsWith("NEUTRAL") ? "neutral"
      : "error";
    const score = verdict === "entails" ? 0.9
      : verdict === "neutral" ? 0.3
      : verdict === "contradicts" ? 0.05
      : 0.0;
    return { score, verdict, latency_ms: Math.round(performance.now() - t0) };
  } catch (e) {
    // Ollama unreachable · timeout · JSON parse · all silent.
    // Caller falls back to deterministic scorer.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
