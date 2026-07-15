// GET  /api/admin/featured-placements   — list all (recent, any status)
// POST /api/admin/featured-placements   — create a placement (admin manual)

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { createPlacement, recentPlacements } from "@/lib/featuredPlacements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const placements = await recentPlacements(120);
  return NextResponse.json({ ok: true, placements });
}

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  let payload: {
    tradeSlug?: unknown;
    category?: unknown;
    days?: unknown;
    adminNote?: unknown;
    override?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const tradeSlug = typeof payload.tradeSlug === "string" ? payload.tradeSlug.trim() : "";
  const category  = typeof payload.category === "string" ? payload.category.trim() : "";
  const days      = typeof payload.days === "number" && payload.days > 0 && payload.days <= 90 ? Math.floor(payload.days) : 7;
  const adminNote = typeof payload.adminNote === "string" ? payload.adminNote.slice(0, 500) : null;
  const override  = payload.override === true;

  const result = await createPlacement({
    tradeSlug, category, days,
    billingSource: "admin",
    adminNote, override
  });
  if (!result.ok) {
    const status = result.error === "category-full" ? 409
                 : result.error === "trade-already-featured" ? 409
                 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, placement: result.placement });
}
