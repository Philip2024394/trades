// POST /api/os/receipts/parse (multipart/form-data with receipt=File)
//
// Owner-only. Runs Claude Vision on the uploaded image and returns the
// structured extraction — without persisting anything. The form uses
// this to prefill the payment fields before the owner confirms.

import { NextResponse } from "next/server";
import { requireHomeownerSession } from "@/lib/os/homeownerSession";
import { extractReceipt } from "@/lib/os/receiptVision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireHomeownerSession();
  } catch {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("receipt");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, error: "file_too_large" },
      { status: 413 }
    );
  }

  const bytes = await file.arrayBuffer();
  const result = await extractReceipt({ bytes, mimeType: file.type });

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ai_configured: result.ai_configured,
    extraction: result.extraction
  });
}
