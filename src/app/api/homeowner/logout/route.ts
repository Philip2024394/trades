// POST /api/homeowner/logout — clear session cookie + null session_token.

import { NextResponse } from "next/server";
import { logoutHomeowner } from "@/lib/homeowners/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await logoutHomeowner();
  return NextResponse.redirect(new URL("/homeowners", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
}
