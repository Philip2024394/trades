// POST /api/nex/kitchen-chat · Philip 2026-08-04.
//
// Kitchen sibling to /api/nex/staircase-chat. MVP endpoint that acknowledges
// the currently-viewed kitchen and answers from the specimen's authored
// description + Material Genome / Joinery DNA libraries. Future revisions
// will delegate to a full kitchen Brain composer mirroring the staircase one.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

type FocusedDesign = {
  design_id?: string;
  title?: string;
  url?: string;
  materials?: readonly string[];
  design_style?: string;
  customer_description?: string;
};

type ManifestImage = { description?: string; style_class?: string; primary_material?: string; tags?: readonly string[] };

function loadManifest(): Record<string, ManifestImage> {
  const p = join(process.cwd(), "data", "nex-image-manifest.json");
  if (!existsSync(p)) return {};
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8")) as { images?: Record<string, ManifestImage> };
    return parsed.images ?? {};
  } catch { return {}; }
}

function firstSentence(text: string, max = 240): string {
  const trimmed = text.trim();
  const period = trimmed.indexOf(". ");
  if (period > 40 && period < max) return trimmed.slice(0, period + 1);
  return trimmed.slice(0, max);
}

function extractMaterials(image?: ManifestImage): string[] {
  if (!image) return [];
  const tags = image.tags ?? [];
  const candidates = new Set<string>();
  const materialWords = ["walnut", "oak", "brass", "stainless", "quartz", "porcelain", "painted", "glass", "aluminium", "marble", "granite", "concrete"];
  for (const t of tags) {
    const lower = t.toLowerCase();
    for (const m of materialWords) if (lower.includes(m)) candidates.add(m);
  }
  return Array.from(candidates);
}

function composeReply(message: string, focused: FocusedDesign | undefined, image: ManifestImage | undefined): string {
  const styleLabel = (focused?.design_style ?? image?.style_class ?? "kitchen").replace(/_/g, " ");
  const materials = extractMaterials(image);
  const materialLine = materials.length > 0 ? `Materials in this specimen: ${materials.join(" · ")}.` : "";
  const description = image?.description ? firstSentence(image.description) : (focused?.customer_description ?? "");
  const askLower = message.toLowerCase();

  if (askLower.includes("material") || askLower.includes("timber") || askLower.includes("what is") || askLower.includes("what's")) {
    return `${materialLine}\n\n${description}`.trim() || `This is a ${styleLabel} kitchen.`;
  }
  if (askLower.includes("style") || askLower.includes("look") || askLower.includes("design")) {
    return `Style: ${styleLabel}.\n\n${description}`.trim();
  }
  if (askLower.includes("cost") || askLower.includes("price") || askLower.includes("budget")) {
    return `I can't give a firm cost from an image alone. This ${styleLabel} specimen tends to be a premium tier build · ${materialLine || "specify the materials"} and I'll help you estimate.`;
  }
  if (askLower.includes("build") || askLower.includes("who") || askLower.includes("supplier")) {
    return `Trade Centre will surface verified kitchen manufacturers that match this ${styleLabel} style. Tap 'Trade Centre' from the home screen to see fitters in your area.`;
  }
  // Default · describe the specimen
  return description || `This is a ${styleLabel} kitchen specimen. Ask me about materials · style · finishes · or how it compares to other kitchens in the library.`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { message?: string; focused_design_context?: FocusedDesign; conversation_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const message = (body.message ?? "").trim();
  if (!message) return NextResponse.json({ ok: false, error: "empty_message" }, { status: 400 });

  const focused = body.focused_design_context;
  const manifest = loadManifest();
  const image = focused?.url ? manifest[focused.url] : undefined;

  const answer = composeReply(message, focused, image);

  return NextResponse.json({
    ok: true,
    answer,
    conversation_id: body.conversation_id ?? "kitchen_chat_" + Date.now().toString(36),
    stage: "kitchen_library_mvp",
    focused_design_id: focused?.design_id,
  });
}
