// GET /api/admin/image-submissions/queue
//
// Admin-only pull of the current moderation queue. Returns pending +
// auto_approved rows so admin can see what the gate let through.

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { imageSubmissionsQueue } from "@/lib/imageSubmissions";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const submissions = await imageSubmissionsQueue(120);
  return NextResponse.json({ ok: true, submissions });
}
