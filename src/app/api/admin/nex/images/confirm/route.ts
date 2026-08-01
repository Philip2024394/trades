// POST   /api/admin/nex/images/confirm   · add an image to Confirmed Library
// DELETE /api/admin/nex/images/confirm   · remove an image (moves back to Unconfirmed)
// GET    /api/admin/nex/images/confirm   · list all Confirmed images

import { NextResponse } from "next/server";
import {
  confirmImage,
  unconfirmImage,
  listConfirmedImages,
  type ConfirmedImage,
} from "@/lib/nex/images/confirmed-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Partial<ConfirmedImage>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body.url || !body.staircase_type || !body.design_style) {
    return NextResponse.json({ ok: false, error: "url, staircase_type, design_style required" }, { status: 400 });
  }
  const record = confirmImage({
    // Visual Brain v2 fields
    design_id:            body.design_id ? String(body.design_id) : undefined,
    title:                body.title ? String(body.title) : undefined,
    design_family:        body.design_family as ConfirmedImage["design_family"],
    primary_brain:        body.primary_brain ? String(body.primary_brain) : "staircase",
    image_id:             body.image_id ? String(body.image_id) : undefined,
    // Philip 2026-08-01 · Editorial ranking control
    priority:             body.priority as ConfirmedImage["priority"],
    ranking_weight:       typeof body.ranking_weight === "number" ? body.ranking_weight : undefined,
    url:                  String(body.url),
    additional_views:     Array.isArray(body.additional_views) ? body.additional_views : undefined,
    view_labels:          Array.isArray(body.view_labels) ? body.view_labels : undefined,
    view_types:           Array.isArray(body.view_types) ? body.view_types as ConfirmedImage["view_types"] : undefined,
    staircase_type:       String(body.staircase_type),
    layout:               String(body.layout ?? ""),
    materials:            Array.isArray(body.materials) ? body.materials : [],
    balustrade_style:     String(body.balustrade_style ?? ""),
    handrail_style:       String(body.handrail_style ?? ""),
    newel_style:          String(body.newel_style ?? ""),
    design_style:         String(body.design_style),
    project_suitability:  Array.isArray(body.project_suitability) ? body.project_suitability : [],
    related_articles:     Array.isArray(body.related_articles) ? body.related_articles : [],
    customer_description: String(body.customer_description ?? ""),
    designer_notes:       String(body.designer_notes ?? ""),
    confirmed_by:         body.confirmed_by ? String(body.confirmed_by) : undefined,
  });
  return NextResponse.json({ ok: true, image: record });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return NextResponse.json({ ok: false, error: "url query param required" }, { status: 400 });
  const removed = unconfirmImage(url);
  return NextResponse.json({ ok: true, removed });
}

export async function GET() {
  const confirmed = listConfirmedImages();
  return NextResponse.json({ ok: true, count: confirmed.length, confirmed });
}
