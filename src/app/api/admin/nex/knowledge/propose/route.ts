// POST /api/admin/nex/knowledge/propose
// Body: { kind: "create" | "edit", target_entry_id?, draft, change_summary? }
//
// Even admins go through the review queue. Only difference is admins
// can auto-approve their own submissions via the review UI.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { submitCreate, submitEdit, type KnowledgeEntryDraft } from "@/lib/nex/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null) as {
    kind:            "create" | "edit";
    target_entry_id?: string;
    draft:           KnowledgeEntryDraft;
    change_summary?: string;
  } | null;
  if (!body?.draft) return NextResponse.json({ ok: false, error: "missing_draft" }, { status: 400 });

  try {
    const submittedBy = "admin";  // hook to real admin user id once auth exposes it
    if (body.kind === "create") {
      const r = await submitCreate({
        draft:            body.draft,
        submittedBy,
        submittedByKind:  "staff"
      });
      return NextResponse.json({ ok: true, review_id: r.id });
    }
    if (body.kind === "edit") {
      if (!body.target_entry_id) return NextResponse.json({ ok: false, error: "missing_target_entry_id" }, { status: 400 });
      const r = await submitEdit({
        entryId:         body.target_entry_id,
        draft:           body.draft,
        submittedBy,
        submittedByKind: "staff",
        changeSummary:   body.change_summary ?? "Admin edit"
      });
      return NextResponse.json({ ok: true, review_id: r.id });
    }
    return NextResponse.json({ ok: false, error: "unknown_kind" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "propose_failed" }, { status: 500 });
  }
}
