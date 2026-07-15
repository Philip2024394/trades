// GET /api/admin/support/tickets — admin queue read

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { ticketQueue } from "@/lib/supportTickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const tickets = await ticketQueue(100);
  return NextResponse.json({ ok: true, tickets });
}
