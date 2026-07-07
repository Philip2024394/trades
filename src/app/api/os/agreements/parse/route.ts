// POST /api/os/agreements/parse (multipart/form-data with agreement_image=File)
// Prefills the hire form with fields extracted from a handwritten
// site note or WhatsApp screenshot.

import { NextResponse } from "next/server";
import { requireHomeownerSession } from "@/lib/os/homeownerSession";
import { requireEntityRole } from "@/lib/os/entitySession";
import { extractAgreement } from "@/lib/os/agreementVision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireHomeownerSession();
    await requireEntityRole("foreman");
  } catch {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("agreement_image");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 413 });
  }

  const bytes = await file.arrayBuffer();
  const result = await extractAgreement({ bytes, mimeType: file.type });
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ai_configured: result.ai_configured,
    extraction: result.extraction
  });
}
