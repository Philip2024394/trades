// POST /api/studio/ai/match-reference
//
// The wow feature. User uploads a screenshot of a landing page they
// like; Opus 4.7 vision extracts structural signals; we score every
// template against those signals; top 5 come back with match reasons.
//
// Body: { imageBase64, imageMimeType } OR { imageUrl }
// Returns: { ok, matches: [{ templateId, score, reasons[] }] }

import { NextResponse } from "next/server";
import { askVisionJson } from "@/lib/llm/multimodal";
import { listTemplates, type Template, type TemplateTone } from "@/lib/studio/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VisionSignals = {
  tone: TemplateTone;
  length: "short" | "medium" | "long";
  heroType:
    | "full-photo"
    | "split-photo"
    | "video"
    | "minimal"
    | "product-showroom"
    | "search-anchored";
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  sections: string[];
  vibe: string;
  confidence: number;
};

const SYSTEM_PROMPT = `You are a design analyst for a UK-trades platform's template matcher.

The user uploaded a screenshot of a landing page they like. Extract structural signals so we can match it against our template gallery. NEVER invent — describe only what you see.

STRICT OUTPUT RULES:
- Return ONLY a JSON object matching the schema below. No prose. No markdown.
- Every enum field MUST use a listed value. Never invent.
- Palette must be 3 hex colours (# + 6 chars).
- Sections list: order top-to-bottom, use the shortest reasonable label per section ("hero", "trust bar", "services grid", "gallery", "testimonials", "faq", "cta", "footer").

SCHEMA:
{
  "tone": "trades-native" | "professional" | "premium" | "editorial" | "bold" | "friendly" | "urgent" | "documentary",
  "length": "short" | "medium" | "long",
  "heroType": "full-photo" | "split-photo" | "video" | "minimal" | "product-showroom" | "search-anchored",
  "palette": { "primary": "#RRGGBB", "secondary": "#RRGGBB", "accent": "#RRGGBB" },
  "sections": ["hero", "..."],
  "vibe": "one-line character descriptor",
  "confidence": 0.0-1.0
}

Return the raw JSON.`;

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function coerceSignals(raw: unknown): VisionSignals | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const tones: TemplateTone[] = [
    "trades-native", "professional", "premium", "editorial",
    "bold", "friendly", "urgent", "documentary"
  ];
  const tone = tones.includes(r.tone as TemplateTone)
    ? (r.tone as TemplateTone)
    : "trades-native";
  const lengths = ["short", "medium", "long"] as const;
  const length = lengths.includes(r.length as (typeof lengths)[number])
    ? (r.length as (typeof lengths)[number])
    : "medium";
  const heroTypes = [
    "full-photo", "split-photo", "video", "minimal",
    "product-showroom", "search-anchored"
  ] as const;
  const heroType = heroTypes.includes(r.heroType as (typeof heroTypes)[number])
    ? (r.heroType as (typeof heroTypes)[number])
    : "full-photo";

  const palRaw = r.palette && typeof r.palette === "object"
    ? (r.palette as Record<string, unknown>) : {};
  const pal = {
    primary: typeof palRaw.primary === "string" && HEX_RE.test(palRaw.primary) ? palRaw.primary : "#0A0A0A",
    secondary: typeof palRaw.secondary === "string" && HEX_RE.test(palRaw.secondary) ? palRaw.secondary : "#FFFFFF",
    accent: typeof palRaw.accent === "string" && HEX_RE.test(palRaw.accent) ? palRaw.accent : "#FFB300"
  };
  const sections = Array.isArray(r.sections)
    ? (r.sections as unknown[])
        .filter((s): s is string => typeof s === "string")
        .slice(0, 12)
    : [];
  const vibe = typeof r.vibe === "string" ? r.vibe.slice(0, 120) : "";
  const confidence = typeof r.confidence === "number"
    ? Math.max(0, Math.min(1, r.confidence)) : 0.5;

  return { tone, length, heroType, palette: pal, sections, vibe, confidence };
}

/** Colour distance in RGB space (0..441). Smaller = closer. */
function colorDistance(a: string, b: string): number {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ];
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/** Score a template against extracted signals. */
function scoreTemplate(
  t: Template,
  signals: VisionSignals
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Tone — heaviest single dimension.
  if (t.tone === signals.tone) {
    score += 40;
    reasons.push(`${t.tone} tone matches`);
  }

  // Length.
  if (t.length === signals.length) {
    score += 15;
    reasons.push(`${t.length}-length match`);
  }

  // Palette closeness — invert distance so smaller distance = higher score.
  if (t.palette) {
    const d = (
      colorDistance(t.palette.primary, signals.palette.primary) +
      colorDistance(t.palette.accent, signals.palette.accent)
    ) / 2;
    const paletteScore = Math.max(0, 30 - Math.round(d / 8));
    if (paletteScore > 8) {
      score += paletteScore;
      reasons.push(`palette within ${Math.round(d)} of yours`);
    }
  }

  // Section overlap by keyword.
  const templateBlob = (t.tagline + " " + t.description).toLowerCase();
  const overlap = signals.sections.filter((s) =>
    templateBlob.includes(s.toLowerCase())
  ).length;
  if (overlap > 0) {
    score += overlap * 5;
    reasons.push(`${overlap} matching section${overlap > 1 ? "s" : ""}`);
  }

  return { score, reasons };
}

async function fetchImageAsBase64(url: string): Promise<{
  base64: string;
  mimeType: string;
} | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") ?? "image/png";
    if (!mimeType.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    return { base64: Buffer.from(buf).toString("base64"), mimeType };
  } catch {
    return null;
  }
}

export async function POST(req: Request): Promise<Response> {
  let body: { imageBase64?: string; imageMimeType?: string; imageUrl?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  let imageBase64 = body.imageBase64;
  let imageMimeType = body.imageMimeType;

  if (!imageBase64 && body.imageUrl) {
    const fetched = await fetchImageAsBase64(body.imageUrl);
    if (!fetched) {
      return NextResponse.json({ ok: false, error: "image-fetch-failed" }, { status: 400 });
    }
    imageBase64 = fetched.base64;
    imageMimeType = fetched.mimeType;
  }

  if (!imageBase64 || !imageMimeType) {
    return NextResponse.json({ ok: false, error: "image-required" }, { status: 400 });
  }

  const raw = await askVisionJson<unknown>({
    imageBase64,
    imageMimeType,
    system: SYSTEM_PROMPT,
    userText: "Extract the landing-page signals per the schema.",
    maxTokens: 600,
    model: "claude-opus-4-7"
  });

  const signals = coerceSignals(raw);
  if (!signals) {
    return NextResponse.json({ ok: false, error: "extraction-failed" }, { status: 502 });
  }

  const scored = listTemplates()
    .map((t) => ({ template: t, ...scoreTemplate(t, signals) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return NextResponse.json({
    ok: true,
    signals,
    matches: scored.map((s) => ({
      templateId: s.template.id,
      template: s.template,
      score: s.score,
      reasons: s.reasons
    }))
  });
}
