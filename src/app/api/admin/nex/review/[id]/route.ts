// POST /api/admin/nex/review/[id]
// Body: { action: "approve" | "reject" | "archive" | "merge", notes?, merge_into_id? }

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { approveReview, rejectReview, archiveReview, mergeReview } from "@/lib/nex/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  if (!(await isAdminAuthed())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    action:        "approve" | "reject" | "archive" | "merge";
    notes?:        string;
    merge_into_id?: string;
  } | null;
  if (!body?.action) return NextResponse.json({ ok: false, error: "missing_action" }, { status: 400 });

  const reviewerId = "admin";  // hook to real admin user id once auth exposes it

  try {
    switch (body.action) {
      case "approve":
        return NextResponse.json({ ok: true, result: await approveReview({ reviewId: id, reviewerId, notes: body.notes }) });
      case "reject":
        if (!body.notes) return NextResponse.json({ ok: false, error: "notes_required" }, { status: 400 });
        await rejectReview({ reviewId: id, reviewerId, notes: body.notes });
        return NextResponse.json({ ok: true });
      case "archive":
        await archiveReview({ reviewId: id, reviewerId, notes: body.notes });
        return NextResponse.json({ ok: true });
      case "merge":
        if (!body.merge_into_id) return NextResponse.json({ ok: false, error: "merge_into_id_required" }, { status: 400 });
        await mergeReview({ reviewId: id, mergedIntoId: body.merge_into_id, reviewerId });
        return NextResponse.json({ ok: true });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "review_action_failed" }, { status: 500 });
  }
}
