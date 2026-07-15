// POST /api/admin/support/tickets/[id]/moderate — admin decision

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { moderateTicket, type TicketStatus } from "@/lib/supportTickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: TicketStatus[] = [
  "open", "reviewing", "action_required", "resolved", "closed", "spam"
];

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

  let payload: {
    status?: unknown;
    resolution?: unknown;
    moderatorNote?: unknown;
    restoreContent?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const status = typeof payload.status === "string" ? payload.status : null;
  if (!status || !VALID_STATUSES.includes(status as TicketStatus)) {
    return NextResponse.json({ ok: false, error: "invalid-status" }, { status: 400 });
  }
  const resolution    = typeof payload.resolution === "string"    ? payload.resolution.slice(0, 500)    : null;
  const moderatorNote = typeof payload.moderatorNote === "string" ? payload.moderatorNote.slice(0, 500) : null;
  const restoreContent = payload.restoreContent === true;

  const ticket = await moderateTicket({
    id,
    moderatorSlug: MODERATOR_SLUG,
    status: status as TicketStatus,
    resolution,
    moderatorNote,
    restoreContent
  });
  if (!ticket) {
    return NextResponse.json({ ok: false, error: "moderate-failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ticket });
}
