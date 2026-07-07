// POST /api/reviews/[token]/upload — homeowner uploads a photo for
// their review. Token is the auth: it's tied to a specific request
// which is tied to a specific merchant.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadImage } from "@/lib/os/media";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const { data: reqRow } = await supabaseAdmin
    .from("app_reviews_review_requests")
    .select("id, merchant_id, status, expires_at")
    .eq("share_token", token)
    .maybeSingle();
  if (!reqRow) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  if (reqRow.status === "completed" || reqRow.status === "declined") {
    return NextResponse.json({ ok: false, error: "Closed." }, { status: 409 });
  }
  if (reqRow.expires_at && new Date(reqRow.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "Expired." }, { status: 410 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-form" }, { status: 400 });
  }
  const raw = form.get("file");
  if (!(raw instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing-file" }, { status: 400 });
  }
  const result = await uploadImage({
    actor: { kind: "merchant", merchantId: reqRow.merchant_id },
    category: "reviews",
    scopeId: reqRow.id,
    file: raw
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.code === "file-too-large" ? 413 : 400 }
    );
  }
  return NextResponse.json({ ok: true, url: result.url });
}
