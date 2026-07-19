// GET /api/user-menu-context — returns the current visitor's
// identity context for the UserMenuDropdown. Used by client
// components (XratedHeader) that can't call resolveUserMenuContext
// directly. Server components should call the resolver instead.

import { NextResponse } from "next/server";
import { resolveUserMenuContext } from "@/lib/userMenuContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await resolveUserMenuContext();
  return NextResponse.json({ ok: true, ctx });
}
