// POST /api/apps/job-diary/[jobId]/upload
//
// Photo upload for a job. Merchant-only. Uses os/media.uploadImage —
// zero hard-coded bucket, zero re-implemented validation. Cap +
// allowlist come from os/storage.ts.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantId } from "@/lib/os/merchantSession";
import { uploadImage } from "@/lib/os/media";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await ctx.params;
  const merchantId = await getMerchantId();
  if (!merchantId) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }
  const { data: job } = await supabaseAdmin
    .from("app_job_diary_jobs")
    .select("id, merchant_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.merchant_id !== merchantId) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
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
    actor: { kind: "merchant", merchantId },
    category: "job-diary",
    scopeId: jobId,
    file: raw
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.code === "file-too-large" ? 413 : 400 }
    );
  }
  return NextResponse.json({ ok: true, url: result.url, path: result.path });
}
