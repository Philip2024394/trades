// POST /api/vision/preprocess
//
// Called by the capture UI immediately after the merchant picks
// photos, BEFORE the /api/events/emit call.
//
// Body: multipart/form-data with `photo` field + `merchantId` +
//   optional `consent` ("granted" | "not_required")
//
// Response: the findings + suggested_action + a base64-encoded
// processed buffer the client can then send along to the emit call
// as photo_urls (real production: uploads to Supabase Storage +
// returns the URL).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { preprocessImage } from "@/lib/vision/preprocess";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "expected multipart" }, { status: 400 });
  }
  const file = form.get("photo");
  const merchantId = form.get("merchantId");
  const consent = (form.get("consent") ?? "").toString();
  if (!(file instanceof File) || typeof merchantId !== "string") {
    return NextResponse.json(
      { error: "photo + merchantId required" },
      { status: 400 }
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const consentGranted = consent === "granted" || consent === "not_required";
  const result = await preprocessImage(buffer, { consentGranted });

  // Persist a preprocess record so the merchant activity feed can
  // explain why a photo was accepted / held / rejected.
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const c = createClient(url, key, { auth: { persistSession: false } });
    await c.from("vision_preprocess_records").insert({
      merchant_id: merchantId,
      original_url: file.name ? `upload://${file.name}` : "upload://unnamed",
      processed_url: null,
      findings: result.findings,
      suggested_action: result.suggested_action
    });
  }

  return NextResponse.json({
    findings: result.findings,
    ai_understanding: result.ai_understanding,
    suggested_action: result.suggested_action,
    suggested_reason: result.suggested_reason,
    processed_base64: result.buffer.toString("base64")
  });
}
