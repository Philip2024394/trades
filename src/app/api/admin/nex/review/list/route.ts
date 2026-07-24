// GET /api/admin/nex/review/list?status=pending&kind=&by=
// Admin review queue listing.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { listReviews, countPending, type ReviewKind, type ReviewStatus, type ReviewSubmitterKind } from "@/lib/nex/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") as ReviewStatus | null) ?? "pending";
  const kind   = searchParams.get("kind") as ReviewKind | null;
  const by     = searchParams.get("by") as ReviewSubmitterKind | null;

  const [items, pending] = await Promise.all([
    listReviews({
      status,
      kind: kind ?? undefined,
      submittedByKind: by ?? undefined,
      limit: 100
    }),
    countPending()
  ]);

  return NextResponse.json({ ok: true, items, pending_count: pending });
}
