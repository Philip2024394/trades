// Studio receipt config.
//
//   GET  /api/studio/payments/receipt
//     → { ok, config }
//
//   PUT  /api/studio/payments/receipt
//     Body: { enabled?, from_email?, from_name?, logo_url?, reply_to?,
//             footer_note?, bcc_merchant? }

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type ReceiptConfig = {
  enabled: boolean;
  from_email: string | null;
  from_name: string | null;
  logo_url: string | null;
  reply_to: string | null;
  footer_note: string | null;
  bcc_merchant: boolean;
};

const DEFAULT: ReceiptConfig = {
  enabled: false,
  from_email: null,
  from_name: null,
  logo_url: null,
  reply_to: null,
  footer_note: null,
  bcc_merchant: true
};

export async function GET() {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const res = await supabaseAdmin
    .from("studio_payment_receipt_config")
    .select("enabled, from_email, from_name, logo_url, reply_to, footer_note, bcc_merchant")
    .eq("brand_id", session.brand.id)
    .maybeSingle();
  const config = (res.data as ReceiptConfig | null) ?? DEFAULT;
  return NextResponse.json({ ok: true, config });
}

type PutBody = Partial<{
  enabled: boolean;
  from_email: string | null;
  from_name: string | null;
  logo_url: string | null;
  reply_to: string | null;
  footer_note: string | null;
  bcc_merchant: boolean;
}>;

export async function PUT(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  const existing = await supabaseAdmin
    .from("studio_payment_receipt_config")
    .select("id")
    .eq("brand_id", session.brand.id)
    .maybeSingle();

  const payload = {
    brand_id: session.brand.id,
    enabled: body.enabled ?? false,
    from_email: body.from_email ?? null,
    from_name: body.from_name ?? null,
    logo_url: body.logo_url ?? null,
    reply_to: body.reply_to ?? null,
    footer_note: body.footer_note ?? null,
    bcc_merchant: body.bcc_merchant ?? true
  };

  if (existing.data) {
    const upd = await supabaseAdmin
      .from("studio_payment_receipt_config")
      .update(payload)
      .eq("id", existing.data.id);
    if (upd.error) {
      return NextResponse.json(
        { ok: false, error: upd.error.message },
        { status: 500 }
      );
    }
  } else {
    const ins = await supabaseAdmin
      .from("studio_payment_receipt_config")
      .insert(payload);
    if (ins.error) {
      return NextResponse.json(
        { ok: false, error: ins.error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
