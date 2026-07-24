// Before / after comparison. Sends TWO images in one request so the
// model can reason about changes between them.
//
// reviewImage() only supports one image; for compare we craft the
// message parts ourselves via a small local helper that mirrors the
// vision wrapper's shape but sends both frames.

import { cacheKey, getCached, setCached } from "./cache";
import { COMPARE_PROMPT, COMPARE_SYSTEM } from "./prompts";
import { DISCLAIMERS, evidenceFor, type Confidence, type ImageComparison } from "./types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL      = "gpt-4o";

type ModelCompare = {
  summary?:      unknown;
  changes?:      unknown;
  improvements?: unknown;
  concerns?:     unknown;
};

export type CompareImagesInput = {
  beforeUrl: string;
  afterUrl:  string;
  hint?:     string;
};

export async function compareImages(input: CompareImagesInput): Promise<ImageComparison> {
  const key = cacheKey([input.beforeUrl, input.afterUrl], "compare", { hint: input.hint });
  const cached = getCached<ImageComparison>(key);
  if (cached) return cached;

  const evidence = evidenceFor("OpenAI GPT-4o vision (compare prompt)", []);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return emptyCompare(evidence, "no_vision_key");

  const userText = input.hint ? `${COMPARE_PROMPT} User note: ${input.hint}` : COMPARE_PROMPT;
  const body = {
    model: MODEL,
    max_tokens: 1500,
    temperature: 0.2,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system", content: COMPARE_SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: `BEFORE image → then AFTER image. ${userText}` },
          { type: "image_url", image_url: { url: input.beforeUrl } },
          { type: "image_url", image_url: { url: input.afterUrl  } }
        ]
      }
    ]
  };

  let parsed: ModelCompare | null = null;
  try {
    const res = await fetch(OPENAI_URL, {
      method:  "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body:    JSON.stringify(body)
    });
    if (!res.ok) return emptyCompare(evidence, "model_failed");
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw  = data.choices?.[0]?.message?.content ?? "";
    if (!raw) return emptyCompare(evidence, "model_failed");
    try {
      const cleaned = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      parsed = JSON.parse(cleaned) as ModelCompare;
    } catch {
      return emptyCompare(evidence, "model_failed");
    }
  } catch {
    return emptyCompare(evidence, "model_failed");
  }

  if (!parsed) return emptyCompare(evidence, "model_failed");

  const cmp: ImageComparison = {
    summary:      typeof parsed.summary === "string" && parsed.summary ? parsed.summary : "Compared.",
    changes:      normaliseChanges(parsed.changes),
    improvements: normaliseStringList(parsed.improvements),
    concerns:     normaliseStringList(parsed.concerns),
    disclaimer:   DISCLAIMERS.general,
    evidence
  };
  setCached(key, cmp);
  return cmp;
}

function normaliseChanges(v: unknown): ImageComparison["changes"] {
  if (!Array.isArray(v)) return [];
  const out: ImageComparison["changes"] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label  = typeof o.label  === "string" ? o.label  : "";
    const detail = typeof o.detail === "string" ? o.detail : "";
    if (!label && !detail) continue;
    out.push({ label: label || detail, detail, confidence: confidenceOf(o.confidence) });
  }
  return out;
}

function normaliseStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((s): s is string => typeof s === "string" && s.length > 0);
}

function confidenceOf(v: unknown): Confidence {
  return v === "high" || v === "medium" || v === "low" ? v : "low";
}

function emptyCompare(evidence: ReturnType<typeof evidenceFor>, err: string): ImageComparison {
  return {
    summary:      err === "no_vision_key"
      ? "Vision needs an OpenAI key set on the server — can't compare images right now."
      : "Image comparison didn't produce a usable response.",
    changes:      [],
    improvements: [],
    concerns:     [],
    disclaimer:   DISCLAIMERS.general,
    evidence,
    error:        err
  };
}
