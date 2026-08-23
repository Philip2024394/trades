// POST /api/nex-intake/batch
//
// Accepts up to 200 image items (URL or file · optional description) and runs
// them through the Image + Description Intelligence Worker.
//
// Doctrine anchors:
//   · project_nex_owns_intelligence_capabilities_2026_08_22
//     (NEX-owned interface · pluggable providers · stubs today)
//   · project_nex_visual_intelligence_architecture_2026_08_22
//     (design-locked · actual vision NOT YET GREEN)
//   · Philip 2026-08-22: 200-item batch · isolated failure · idempotent by hash
//     · never auto-teach Brain
//
// SHAPE:
//   Body: { items: [{ imageUrl: string, description?: string,
//                     aiGenerated?: boolean, rightsStatus?: string,
//                     filename?: string }] }
//   Returns: IntakeBatchResult (per-item results · counts · doctrine checks)
//
// HONEST STATUS: vision provider is stubbed. If no description is supplied
// and image has no readable text, extraction band = LOW/UNREADABLE. That's
// the correct behaviour until Task #69 (real NEX-owned visual perception
// adapter) opens.

import { NextResponse } from "next/server";
import { getFoodDbPool } from "@/lib/nex-food/db";
import { runIntakeBatch, type IntakeItem } from "@/lib/nex/intake/image-plus-description-worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;   // 200 images x network fetch may exceed default

const MAX_ITEMS = 200;

function bad(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

interface RequestBody {
  items?: Array<{
    imageUrl?: string;
    description?: string;
    aiGenerated?: boolean;
    rightsStatus?: "declared_by_user" | "unknown" | "restricted";
    filename?: string;
  }>;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RequestBody | null;
  if (!body) return bad(400, "Malformed JSON body");
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return bad(400, "items[] required · at least 1 item");
  }
  if (body.items.length > MAX_ITEMS) {
    return bad(400, `items[] too large · max ${MAX_ITEMS} per batch (submit another batch immediately after · resumable)`);
  }

  // Validate each item minimally · reject the whole batch only for malformed shape
  const items: IntakeItem[] = [];
  for (let i = 0; i < body.items.length; i++) {
    const it = body.items[i]!;
    if (!it.imageUrl?.trim()) {
      return bad(400, `items[${i}].imageUrl required`);
    }
    items.push({
      imageUrl: it.imageUrl.trim(),
      description: it.description?.trim() || undefined,
      aiGenerated: Boolean(it.aiGenerated),
      rightsStatus: it.rightsStatus ?? "unknown",
      filename: it.filename?.trim() || undefined,
    });
  }

  const pool = getFoodDbPool();
  try {
    const result = await runIntakeBatch(pool, items);
    return NextResponse.json({
      ok: true,
      ...result,
      doctrine: {
        vision_status: "STUBBED · Task #69 blocked behind Business #1 · classifications from description + hash only",
        never_auto_teach: true,
        no_ai_rejected: true,
        rights_status_preserved: true,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/nex-intake/batch] internal:", err);
    return bad(500, `batch failed: ${message}`);
  }
}
