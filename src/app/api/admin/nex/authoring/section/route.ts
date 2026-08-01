// POST /api/admin/nex/authoring/section
// Update a single section · edit body · change status.

import { NextResponse } from "next/server";
import { updateSectionStatus, updateSectionBody, type SectionStatus } from "@/lib/nex/authoring/writer";
import { applyAutoFixes } from "@/lib/nex/authoring/parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  action?:      "approve" | "reject" | "needs_edit" | "edit" | "apply_fixes";
  file_slug?:   string;
  section_id?:  string;
  new_heading?: string;
  new_body?:    string;
};

const ACTION_TO_STATUS: Record<string, SectionStatus> = {
  approve:    "approved",
  reject:     "rejected",
  needs_edit: "needs_edit",
};

// Auth removed 2026-08-01 · Philip authoring page is open access on local dev.
export async function POST(req: Request) {
  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { action, file_slug, section_id, new_heading, new_body } = payload;
  if (!action || !file_slug || !section_id) {
    return NextResponse.json({ ok: false, error: "action, file_slug, section_id required" }, { status: 400 });
  }

  if (action === "edit" || action === "apply_fixes") {
    if (!new_body || !new_heading) {
      return NextResponse.json({ ok: false, error: "new_heading and new_body required for edit" }, { status: 400 });
    }
    const bodyToWrite = action === "apply_fixes" ? applyAutoFixes(new_body) : new_body;
    const ok = updateSectionBody(file_slug, section_id, new_heading, bodyToWrite);
    if (!ok) return NextResponse.json({ ok: false, error: "section not found" }, { status: 404 });
    return NextResponse.json({ ok: true, action: "edited", section_id });
  }

  const nextStatus = ACTION_TO_STATUS[action];
  if (!nextStatus) return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });

  const ok = updateSectionStatus(file_slug, section_id, nextStatus);
  if (!ok) return NextResponse.json({ ok: false, error: "section not found" }, { status: 404 });
  return NextResponse.json({ ok: true, action, section_id, new_status: nextStatus });
}
