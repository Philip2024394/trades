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
  "business.discover",
  "industry.answer",
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

// Business Discovery — merchant describes their business, provider
// extracts structured signals for the wizard. Retrieval-first: every
// slug the provider returns MUST exist in the corpora we supplied
// (trades, outcomes, modules). API layer validates and rejects
// hallucinated slugs.
const BUSINESS_DISCOVER_SYSTEM_PROMPT = `You are a Business Discovery assistant for a UK construction + trades platform.

Given a merchant's plain-English description of their business, extract:
- tradeSlug: their primary trade (MUST match one of the trade slugs in the corpus)
- outcomes: 1-3 business outcomes they've explicitly mentioned or clearly implied (MUST match slugs in the outcomes corpus)
- coverage: { national: boolean, postcode: string|null, radiusMi: number|null } — extract if mentioned
- modules: 0-4 modules the merchant would benefit from (MUST match slugs in the modules corpus)
- merchantName: their business name if mentioned in the text (else null)
- confidence: 0.0-1.0 — how sure you are of the trade extraction
- reasoning: one short plain-English sentence explaining the fit

STRICT OUTPUT RULES:
- Return ONLY a JSON object — no markdown, no code fences, no prose
- Slugs that aren't in the supplied corpora are a critical error — the caller will reject the response
- If you can't confidently identify a trade, return null for tradeSlug and 0.0 confidence
- Do NOT invent postcodes or radii — leave null if not mentioned
- Reasoning must be trade-plain: short, concrete, no marketing language

Return the raw JSON object with no wrapping.`;

// Industry Brain — retrieval-first Q&A. The API sends the merchant's
// question + a formatted CONTEXT block of RetrievalNodes from the
// Knowledge Graph. The model must answer from context only + cite
// node ids in square brackets. Hallucinated node ids are rejected by
// the API layer.
const INDUSTRY_ANSWER_SYSTEM_PROMPT = `You are the Xrated Industry Brain — a domain-specialised assistant for UK construction and trade merchants.

You will receive:
- A CONTEXT block of cited knowledge nodes from the platform's Knowledge Graph
- A merchant question

STRICT OUTPUT RULES:
- Return ONLY a JSON object — no markdown, no code fences, no prose outside JSON
- Shape: { "answer": "<plain sentences>", "citations": ["<node id>", ...], "confidence": 0.0-1.0, "escalate": boolean }
- Every factual claim in "answer" must reference a node id from the CONTEXT in square brackets, like:
    "Landlords need an annual gas safety check [package.package-service.gas-engineer.cp12-landlord] [package.package-extension-compliance.gas-engineer.landlord-gas-safety-record]."
- "citations" MUST be a de-duplicated array of every node id you cited
- "confidence": how confident you are the CONTEXT actually answered the question (0..1)
- "escalate": TRUE when the question needs a human trade professional OR the CONTEXT doesn't cover the topic honestly
- Never invent node ids. Never claim a regulation the CONTEXT doesn't cite.
- Never state a specific number, price, or timescale unless it appears verbatim in the CONTEXT.
- Voice: trade-plain UK English. Short sentences. First-person plural ("we"). No marketing fluff.

If the CONTEXT genuinely doesn't cover the question, answer:
  { "answer": "The Knowledge Graph doesn't cover this specifically. Best next step: contact a qualified trade professional.", "citations": [], "confidence": 0, "escalate": true }

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
  if (req.task === "business.discover") return buildBusinessDiscoverPrompt(req);
  if (req.task === "industry.answer") return buildIndustryAnswerPrompt(req);
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

function buildIndustryAnswerPrompt(req: AiCompleteRequest): string {
  const payload = req.context.payload ?? {};
  const question = (payload.question as string | undefined) ?? "";
  const contextBlock = (payload.contextBlock as string | undefined) ?? "";
  const validNodeIds =
    (payload.validNodeIds as string[] | undefined) ?? [];

  return `${contextBlock}

MERCHANT QUESTION:
${question || "(no question provided)"}

VALID NODE IDs (only these can appear in citations):
${JSON.stringify(validNodeIds)}

Answer the merchant question in trade-plain English, citing every claim with the node ids from the CONTEXT. Return the JSON object per the STRICT OUTPUT RULES.`;
}

function buildBusinessDiscoverPrompt(req: AiCompleteRequest): string {
  const payload = req.context.payload ?? {};
  const description = (payload.description as string | undefined) ?? "";
  const trades =
    (payload.trades as { slug: string; label: string }[] | undefined) ?? [];
  const outcomes =
    (payload.outcomes as { slug: string; label: string }[] | undefined) ?? [];
  const modules =
    (payload.modules as { slug: string; label: string }[] | undefined) ?? [];

  return `Merchant business description:
${description || "(none)"}

CORPUS · Trades (only pick a slug from this list):
${JSON.stringify(trades)}

CORPUS · Outcomes (only pick slugs from this list):
${JSON.stringify(outcomes)}

CORPUS · Modules (only pick slugs from this list, at most 4):
${JSON.stringify(modules)}

Extract the discovery signals. Return a raw JSON object with keys:
{ "tradeSlug": string|null, "outcomes": string[], "coverage": { "national": boolean, "postcode": string|null, "radiusMi": number|null }, "modules": string[], "merchantName": string|null, "confidence": number, "reasoning": string }`;
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
              : req.task === "business.discover"
                ? BUSINESS_DISCOVER_SYSTEM_PROMPT
                : req.task === "industry.answer"
                  ? INDUSTRY_ANSWER_SYSTEM_PROMPT
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
