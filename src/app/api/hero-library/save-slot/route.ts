// POST /api/hero-library/save-slot
//
// Persists a merchant's hero-slot choice. Called on preset change,
// edit change, image swap, and (in bulk) on "Apply series across site".
//
// Request body:
//   {
//     slotKey: "landing_hero" | "about_hero" | ...,
//     imageId: string,
//     preset: "full_bleed" | "framed" | "card",
//     edits: { brightness, warmth, vignette, focus_x, focus_y },
//     uploadUrl?: string | null,
//     uploadFocals?: { "16:9": {x,y}, "1:1": {x,y}, "3:4": {x,y} }
//   }
//
// Or for the bulk "apply series" save:
//   {
//     applyAcrossSlots: ["landing_hero", "about_hero", "services_hero"],
//     imageIdByKey: { "landing_hero": "carpenter-golden-frame-...",
//                     "about_hero": "joiner-workshop-sawing-...",
//                     "services_hero": "carpenter-golden-fence-..." },
//     preset: "full_bleed",
//     edits: {}
//   }
//
// Merchant identity comes from the authenticated Supabase session
// (RLS on merchant_hero_slots enforces merchant_id = auth.uid).

import { NextResponse } from "next/server";
import { saveMerchantHeroSlot } from "@/lib/hero-swap/supabaseLoader";

export const runtime = "nodejs";

type SingleSlotBody = {
  slotKey: string;
  imageId: string;
  preset: string;
  edits: Record<string, unknown>;
  uploadUrl?: string | null;
  uploadFocals?: Record<string, unknown> | null;
};

type BulkSlotBody = {
  applyAcrossSlots: string[];
  imageIdByKey: Record<string, string>;
  preset: string;
  edits: Record<string, unknown>;
};

function isBulk(
  body: SingleSlotBody | BulkSlotBody
): body is BulkSlotBody {
  return "applyAcrossSlots" in body;
}

export async function POST(request: Request) {
  const body = (await request.json()) as SingleSlotBody | BulkSlotBody;

  // Merchant id must come from the authenticated session — this route
  // assumes the caller has attached auth cookies. In demo mode with no
  // Supabase configured, we early-return success so the UI still works.
  const merchantId = request.headers.get("x-merchant-id") ?? "";
  if (!merchantId) {
    return NextResponse.json(
      { ok: true, demo: true, message: "No merchant session — nothing persisted." },
      { status: 200 }
    );
  }

  if (isBulk(body)) {
    const results = await Promise.all(
      body.applyAcrossSlots.map((slotKey) => {
        const imageId = body.imageIdByKey[slotKey];
        if (!imageId) return Promise.resolve(false);
        return saveMerchantHeroSlot({
          merchantId,
          slotKey,
          imageId,
          preset: body.preset,
          edits: body.edits
        });
      })
    );
    const ok = results.every(Boolean);
    return NextResponse.json({ ok, saved: results.filter(Boolean).length });
  }

  const ok = await saveMerchantHeroSlot({
    merchantId,
    slotKey: body.slotKey,
    imageId: body.imageId,
    preset: body.preset,
    edits: body.edits,
    uploadUrl: body.uploadUrl,
    uploadFocals: body.uploadFocals
  });
  return NextResponse.json({ ok });
}
