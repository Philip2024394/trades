// src/lib/nex/live-chat-completion/vision/ollama-provider.ts
//
// Founder BEGIN Phase 3.8 · Ollama vision provider (llava / llama3.2-vision).
//
// Real provider using Ollama's /api/chat with vision-capable models.
// Zero paid API. Bounded timeout. Structured JSON output enforced.
//
// Non-fatal on any failure — returns { output: null, error } so downstream
// treats it as "no facts extracted" rather than throwing.

import type { VisionProvider, VisionExtractInput, VisionExtractResult } from "./contract";
import { hashImageBase64, VisionProviderOutputSchema } from "./contract";

const OLLAMA_BASE = process.env.NEX_OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_VISION_MODEL = process.env.NEX_OLLAMA_VISION_MODEL ?? "llava:7b";

const SYSTEM_PROMPT = `You are NEX Vision. You extract STRUCTURED facts from a single image.

STRICT RULES:
1. Only report facts you can CLEARLY see in the image. Never invent.
2. Every fact must have a category from this exact list: receipt, menu, facility, contact, address, identity_document, other.
3. Every fact must have a confidence between 0.0 and 1.0.
4. If nothing legible or relevant is present, return facts: [] with a low extraction_confidence.
5. Never return prose or markdown. Only the JSON object described below.

OUTPUT FORMAT (JSON only, no fences):
{
  "facts": [
    { "claim_text": "short factual claim", "category": "receipt|menu|facility|contact|address|identity_document|other", "confidence": 0.0..1.0 }
  ],
  "overall_caption": "one short sentence describing the whole image",
  "extraction_confidence": 0.0..1.0
}`;

export function makeOllamaVisionProvider(): VisionProvider {
  return {
    name: `ollama-vision:${OLLAMA_VISION_MODEL}`,
    async extract(input: VisionExtractInput): Promise<VisionExtractResult> {
      const t0 = performance.now();
      const hash = hashImageBase64(input.image_base64);
      const controller = new AbortController();
      const budgetTimer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(60_000, input.budget_ms)));
      if (input.signal) input.signal.addEventListener("abort", () => controller.abort(), { once: true });
      try {
        const userPrompt = input.hint
          ? `User hint: ${input.hint}\nExtract structured facts from the attached image.`
          : `Extract structured facts from the attached image.`;
        const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: OLLAMA_VISION_MODEL,
            stream: false,
            keep_alive: "5m",
            format: "json",
            options: { temperature: 0.1, num_predict: 512 },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt, images: [input.image_base64] },
            ],
          }),
          signal: controller.signal,
        });
        clearTimeout(budgetTimer);
        if (!res.ok) {
          return {
            output: null,
            provider_meta: {
              provider: `ollama-vision:${OLLAMA_VISION_MODEL}`,
              request_ms: Math.round(performance.now() - t0),
              completed: false,
              error: `http_${res.status}`,
              image_hash: hash,
            },
          };
        }
        const j = await res.json() as { message?: { content?: string } };
        const rawJson = String(j?.message?.content ?? "").trim();
        const stripped = rawJson.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```\s*$/i, "").trim();
        let parsedObj: unknown;
        try { parsedObj = JSON.parse(stripped); }
        catch (e) {
          return {
            output: null,
            provider_meta: {
              provider: `ollama-vision:${OLLAMA_VISION_MODEL}`,
              request_ms: Math.round(performance.now() - t0),
              completed: true,
              error: `output_not_json:${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`,
              image_hash: hash,
            },
          };
        }
        const validated = VisionProviderOutputSchema.safeParse(parsedObj);
        if (!validated.success) {
          const errs = validated.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}:${i.message}`).join(";");
          return {
            output: null,
            provider_meta: {
              provider: `ollama-vision:${OLLAMA_VISION_MODEL}`,
              request_ms: Math.round(performance.now() - t0),
              completed: true,
              error: `schema_violation:${errs}`.slice(0, 200),
              image_hash: hash,
            },
          };
        }
        return {
          output: validated.data,
          provider_meta: {
            provider: `ollama-vision:${OLLAMA_VISION_MODEL}`,
            request_ms: Math.round(performance.now() - t0),
            completed: true,
            image_hash: hash,
          },
        };
      } catch (e) {
        clearTimeout(budgetTimer);
        return {
          output: null,
          provider_meta: {
            provider: `ollama-vision:${OLLAMA_VISION_MODEL}`,
            request_ms: Math.round(performance.now() - t0),
            completed: false,
            error: e instanceof Error ? e.message.slice(0, 100) : "unknown",
            image_hash: hash,
          },
        };
      }
    },
  };
}
