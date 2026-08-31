// /api/nex/driver/register · Philip 2026-08-29
//
// DEPRECATED · compatibility shim only · one-release migration window.
// Canonical path is /api/nex/provider/register (mobility doctrine v5).
//
// All verbs 308-redirect · preserves method + body per RFC 7538. Any new
// client integration MUST target the provider path directly. Remove this
// file after the migration window closes.

import { NextRequest, NextResponse } from "next/server";

function redirect(req: NextRequest): NextResponse {
  const url = new URL(req.url);
  url.pathname = "/api/nex/provider/register";
  return NextResponse.redirect(url, 308);
}

export function GET(req: NextRequest)    { return redirect(req); }
export function POST(req: NextRequest)   { return redirect(req); }
export function PUT(req: NextRequest)    { return redirect(req); }
export function PATCH(req: NextRequest)  { return redirect(req); }
export function DELETE(req: NextRequest) { return redirect(req); }
