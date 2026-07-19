// POST /api/homeowner/signup — create homeowner account + session cookie.

import { NextResponse } from "next/server";
import { signupHomeowner } from "@/lib/homeowners/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as {
    email?: string; password?: string; firstName?: string;
    postcode?: string; city?: string; whatsappNumber?: string;
    houseNickname?: string;
  } | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });

  const res = await signupHomeowner({
    email:          (body.email || "").trim(),
    password:       body.password || "",
    firstName:      (body.firstName || "").trim(),
    postcode:       body.postcode || undefined,
    city:           body.city || undefined,
    whatsappNumber: body.whatsappNumber || undefined,
    houseNickname:  body.houseNickname || undefined
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, homeownerId: res.homeowner.id });
}
