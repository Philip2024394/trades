// POST /api/admin/image-submissions/[id]/moderate
//
// Admin decision on a queued submission. Body: { decision: 'approve'
// | 'reject', note?: string }. Stamps moderated_by + moderated_at.

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { moderateSubmission } from "@/lib/imageSubmissions";

type Body = {
  decision?: unknown;
  note?: unknown;
};

const MODERATOR_SLUG = "admin";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });
  }

  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const decision = payload.decision === "approve" || payload.decision === "reject"
    ? payload.decision
    : null;
  if (!decision) {
    return NextResponse.json({ ok: false, error: "invalid-decision" }, { status: 400 });
  }
  const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 500) : null;

  const row = await moderateSubmission({
    id,
    moderatorSlug: MODERATOR_SLUG,
    decision,
    note
  });

  if (!row) {
    return NextResponse.json({ ok: false, error: "moderate-failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, submission: row });
}
