// POST /api/repurpose/monthly/send
//
// Composes AND sends the monthly digest via Resend. Body:
//   { merchantId, toEmail, fromName?, fromEmail? }

import { NextResponse } from "next/server";
import { composeMonthlyDigest } from "@/lib/repurpose/monthlyDigest";
import { deliverMonthlyDigest } from "@/lib/repurpose/deliverDigest";

export const runtime = "nodejs";

type Body = {
  merchantId?: string;
  toEmail?: string;
  fromName?: string;
  fromEmail?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.merchantId || !body?.toEmail) {
    return NextResponse.json(
      { error: "merchantId + toEmail required" },
      { status: 400 }
    );
  }
  const draft = await composeMonthlyDigest(body.merchantId);
  if (!draft) {
    return NextResponse.json(
      { error: "no eligible posts in the last 30 days" },
      { status: 404 }
    );
  }
  const result = await deliverMonthlyDigest({
    merchantId: body.merchantId,
    toEmail: body.toEmail,
    fromName: body.fromName,
    fromEmail: body.fromEmail,
    draft
  });
  return NextResponse.json(result);
}
