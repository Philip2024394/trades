// POST /api/homeowner/login — email + password auth for homeowners.

import { NextResponse } from "next/server";
import { loginHomeowner } from "@/lib/homeowners/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { email?: string; password?: string } | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });

  const res = await loginHomeowner({ email: body.email || "", password: body.password || "" });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 401 });
  return NextResponse.json({ ok: true, homeownerId: res.homeowner.id });
}
