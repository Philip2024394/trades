// Anthropic Claude adapter for the AI Gateway.
//
// Registered via aiProviders/index.ts at module load. Zero preferred
// status — the gateway picks based on task support + health + cost /
// latency, exactly as Module 0.7 defined. Adding a second provider
// (OpenAI, Google, DeepSeek) means one more file behind the same
// AiProvider interface.
//
// Sonnet cost / latency numbers below are indicative — the router
// picks with them but nothing else depends on the exact figures. When
// pricing shifts, update this file and the gateway repicks.

import type {
  AiCompleteRequest,
  AiCompleteResponse,
  AiProvider,
  AiTaskKind
} from "@/lib/studio/aiTypes";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 2000;

const SUPPORTED_TASKS: AiTaskKind[] = [
  "section.explain",
  "section.improve",
  "section.rewrite",
  "section.score",
  "section.suggestAlternative",
  "page.score",
  "page.improve",
  "page.recommend",
  "app.recommend",
  "copy.rewrite",
  "copy.translate",
  "design.suggestPalette",
  "custom"
];

const SYSTEM_PROMPT = `You are a UK trades design assistant helping merchants improve their landing pages.

STRICT OUTPUT RULES:
- Return ONLY a JSON object — no markdown, no code fences, no prose, no explanations
- Only include fields you're changing (partial patch)
- NEVER touch keys that aren't in the aiPromptable list
- NEVER exceed each field's maxLength
- Preserve the merchant's trade-plain voice — no marketing fluff, no superlatives, no jargon
- Real UK-trade facts (e.g. "Gas Safe", "£5M public liability", "CPCS", "NICEIC") stay factual
- Keep numbers, prices, and accreditations exactly as-is unless the task explicitly changes them

STYLE:
- Trade-plain by default: short sentences, first-person plural ("we"), no "delight"/"revolutionise"/"unlock"
- If a tone is specified in hints, apply it consistently

Return the raw JSON object with no wrapping.`;

// Retrieval-only system prompt for the App Store recommender. The
// merchant asks for something in plain English; we match against a
// finite corpus of installed Apps. Hallucinating a slug that isn't in
// the corpus is a critical failure — the API layer will reject it.
const APP_RECOMMEND_SYSTEM_PROMPT = `You are a Studio App Store recommender for UK trades.

Given a merchant's description of what they want to build, pick the Apps from the CORPUS that best fit. The corpus is finite — you can ONLY reference slugs that appear in it. Do not invent Apps. Do not suggest categories that aren't represented.

STRICT OUTPUT RULES:
- Return ONLY a JSON object — no markdown, no code fences, no prose
- Shape: { "matches": [ { "slug": "<from-corpus>", "confidence": 0.0-1.0, "reasoning": "<one plain sentence explaining the fit>" } ] }
- Return up to 3 matches, ordered best-first
- If nothing in the corpus fits, return { "matches": [] } — never invent
- Reasoning must be trade-plain: short, concrete, no marketing fluff

Return the raw JSON object with no wrapping.`;

/** Extract the first JSON object from a text blob. Handles the case
 *  where the model leaks a preamble ("Here's the patch:") or wraps in
 *  code fences. */
function extractJson(text: string): unknown | null {
  const stripped = text.trim();
  // Find outermost { … }
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end < 0 || end < start) return null;
  const slice = stripped.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function buildPrompt(req: AiCompleteRequest): string {
  if (req.task === "app.recommend") return buildAppRecommendPrompt(req);
  const payload = req.context.payload ?? {};
  const promptTemplate =
    (payload.promptTemplate as string | undefined) ??
    "Improve this section without changing the layout.";
  const currentConfig = payload.currentConfig ?? {};
  const aiPromptable = payload.aiPromptable ?? [];
  const hints = req.hints ?? {};

  const tone = hints.tone ? `\n\nTone: ${hints.tone}` : "";
  const locale = hints.locale ? `\n\nLocale: ${hints.locale}` : "";

  return `Task: ${promptTemplate}${tone}${locale}

Current config:
${JSON.stringify(currentConfig, null, 2)}

Editable fields (only these can be changed):
${JSON.stringify(aiPromptable, null, 2)}

Return a JSON object with only the fields you're changing.`;
}

function buildAppRecommendPrompt(req: AiCompleteRequest): string {
  const payload = req.context.payload ?? {};
  const description = (payload.description as string | undefined) ?? "";
  const corpus =
    (payload.corpus as
      | { slug: string; name: string; tagline: string; category: string; tags: string[]; description?: string }[]
      | undefined) ?? [];

  return `Merchant description:
${description || "(no description provided)"}

Corpus of installable Apps (only recommend slugs from this list):
${JSON.stringify(corpus, null, 2)}

Return the top 3 best-fit Apps as { "matches": [...] }. If nothing fits, return { "matches": [] }.`;
}

export const anthropicProvider: AiProvider = {
  id: "anthropic-claude-opus-4-7",
  name: "Anthropic Claude Opus 4.7",
  supports: SUPPORTED_TASKS,
  cost: { inputPerKtok: 3, outputPerKtok: 15 },
  latencyP50Ms: 2500,
  async isHealthy() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },
  async complete(req: AiCompleteRequest): Promise<AiCompleteResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        error: {
          code: "provider-unhealthy",
          message: "ANTHROPIC_API_KEY not configured on server.",
          retryable: false
        }
      };
    }

    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system:
            req.task === "app.recommend"
              ? APP_RECOMMEND_SYSTEM_PROMPT
              : SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildPrompt(req) }]
        })
      });
    } catch (e) {
      return {
        ok: false,
        error: {
          code: "internal",
          message: `Network: ${(e as Error).message}`,
          retryable: true
        }
      };
    }

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      return {
        ok: false,
        error: {
          code:
            res.status === 429
              ? "budget-exceeded"
              : res.status >= 500
                ? "internal"
                : "invalid-request",
          message: `HTTP ${res.status} · ${bodyText.slice(0, 200)}`,
          retryable: res.status >= 500 || res.status === 429
        }
      };
    }

    const body = (await res.json()) as {
      content?: { type: string; text: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const textBlock = body.content?.find((c) => c.type === "text");
    if (!textBlock?.text) {
      return {
        ok: false,
        error: {
          code: "internal",
          message: "No text content in response.",
          retryable: true
        }
      };
    }
    const parsed = extractJson(textBlock.text);
    if (!parsed || typeof parsed !== "object") {
      return {
        ok: false,
        error: {
          code: "internal",
          message: "Response was not valid JSON.",
          retryable: true
        }
      };
    }

    return {
      ok: true,
      result: parsed,
      meta: {
        provider: "anthropic-claude-opus-4-7",
        model: MODEL,
        latencyMs: Date.now() - started,
        inputTokens: body.usage?.input_tokens,
        outputTokens: body.usage?.output_tokens
      }
    };
  }
};
