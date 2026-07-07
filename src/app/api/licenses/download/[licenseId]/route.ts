// GET /api/licenses/download/[licenseId]
//
// Serves the licensed image bytes to the licence holder. For external
// buyers this is the URL emailed to them post-checkout. For merchants
// the auto-upgraded serve endpoint handles the same job — this is a
// convenience route mainly used by the delivery email.
//
// We proxy through the standard serve endpoint so the same watermark
// tier logic applies (buyout → clean, standard/extended → standard
// with steg + metadata only).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ licenseId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { licenseId } = await context.params;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "backend unavailable" },
      { status: 503 }
    );
  }
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client
    .from("image_licenses")
    .select("image_id, buyer_email, status")
    .eq("id", licenseId)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (data.status !== "active") {
    return NextResponse.json(
      { error: "licence not active" },
      { status: 402 }
    );
  }

  // Proxy through the watermark serve endpoint with the buyer's email
  // as the tier resolver hint. Cache stays coherent because the serve
  // endpoint keys its cache by (imageId, tier).
  const origin = new URL(request.url).origin;
  const proxied = await fetch(
    `${origin}/api/image/serve/${encodeURIComponent(
      data.image_id as string
    )}?email=${encodeURIComponent((data.buyer_email as string) ?? "")}`
  );
  const arr = await proxied.arrayBuffer();
  const contentType = proxied.headers.get("Content-Type") ?? "image/png";
  return new NextResponse(new Uint8Array(arr), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${data.image_id}.png"`
    }
  });
}
