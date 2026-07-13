// POST /api/studio/ai/extract-logo-palette
//
// The merchant uploads their logo in the review-flow branding step.
// This route reads the image, pulls the dominant background + accent
// colours, derives an ink contrast pair, and returns a BrandPalette
// Studio can apply directly to brand.overrides.
//
// Contract:
//   Body: { imageBase64: string, imageMimeType: string }
//        OR
//        { imageUrl: string }  ← we fetch it server-side
//   → { ok, palette: BrandPalette } | { ok:false, error }
//
// Uses the shared multimodal helper (Opus 4.7 vision) — same model
// that powers receipt + agreement vision. The prompt asks the model
// to return colour hex values only.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { askVisionJson } from "@/lib/llm/multimodal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PostBody = {
  imageBase64?: string;
  imageMimeType?: string;
  imageUrl?: string;
};

type VisionPalette = {
  background: string;
  surface: string;
  ink: string;
  accent: string;
  accentInk: string;
  mode: "light" | "dark";
  confidence: number;
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const SYSTEM_PROMPT = `You are a brand-palette extractor for a UK-trades platform.

The user has uploaded their logo. Extract the dominant background colour and one accent colour, then derive an ink (text) colour that meets WCAG 4.5:1 contrast against the background.

STRICT OUTPUT RULES:
- Return ONLY a JSON object matching the schema below. No prose.
- Every colour is a 6-digit hex string starting with # (e.g. "#E87500"). No 3-digit shortcuts.
- background = the logo's dominant / most-common background colour. If the logo has a transparent background, use "#FFFFFF" and set mode: "light".
- surface = a 1-2% darker (light mode) or lighter (dark mode) neighbour of background — the card colour.
- accent = the logo's most distinctive brand colour (a mark, wordmark stroke, or highlight). If none stands out, pick a colour that harmonises with the background using a 60° hue rotation.
- ink = the text colour with ≥4.5:1 contrast against background. Prefer near-black on light backgrounds, near-white on dark.
- accentInk = the text colour with ≥4.5:1 contrast against accent.
- mode = "light" when background is lighter than #808080, else "dark".
- confidence = 0..1 — how confident you are the extraction matches the logo's actual palette.

SCHEMA:
{
  "background": "#RRGGBB",
  "surface": "#RRGGBB",
  "ink": "#RRGGBB",
  "accent": "#RRGGBB",
  "accentInk": "#RRGGBB",
  "mode": "light" | "dark",
  "confidence": 0.0-1.0
}

Return the raw JSON object.`;

function coercePalette(raw: unknown): VisionPalette | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const fields: Array<keyof VisionPalette> = [
    "background",
    "surface",
    "ink",
    "accent",
    "accentInk"
  ];
  const out: Partial<VisionPalette> = {};
  for (const f of fields) {
    const v = r[f];
    if (typeof v !== "string" || !HEX_RE.test(v)) return null;
    (out as Record<string, string>)[f] = v.toUpperCase();
  }
  const mode = r.mode === "dark" ? "dark" : "light";
  const confidence =
    typeof r.confidence === "number"
      ? Math.max(0, Math.min(1, r.confidence))
      : 0.5;
  return {
    background: out.background!,
    surface: out.surface!,
    ink: out.ink!,
    accent: out.accent!,
    accentInk: out.accentInk!,
    mode,
    confidence
  };
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

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  let imageBase64 = body.imageBase64;
  let imageMimeType = body.imageMimeType;

  if (!imageBase64 && body.imageUrl) {
    const fetched = await fetchImageAsBase64(body.imageUrl);
    if (!fetched) {
      return NextResponse.json(
        { ok: false, error: "logo-fetch-failed" },
        { status: 400 }
      );
    }
    imageBase64 = fetched.base64;
    imageMimeType = fetched.mimeType;
  }

  if (!imageBase64 || !imageMimeType) {
    return NextResponse.json(
      { ok: false, error: "logo-required" },
      { status: 400 }
    );
  }
  if (!imageMimeType.startsWith("image/")) {
    return NextResponse.json(
      { ok: false, error: "not-an-image", mimeType: imageMimeType },
      { status: 400 }
    );
  }

  const raw = await askVisionJson<unknown>({
    imageBase64,
    imageMimeType,
    system: SYSTEM_PROMPT,
    userText:
      "Extract the palette from this logo per the schema. Focus on the dominant background colour.",
    maxTokens: 400,
    model: "claude-opus-4-7"
  });

  const palette = coercePalette(raw);
  if (!palette) {
    return NextResponse.json(
      { ok: false, error: "extraction-failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    palette: {
      slug: "from-logo",
      name: "From your logo",
      description: "Palette auto-derived from your uploaded logo.",
      background: palette.background,
      surface: palette.surface,
      ink: palette.ink,
      accent: palette.accent,
      accentInk: palette.accentInk,
      mode: palette.mode,
      confidence: palette.confidence
    }
  });
}
