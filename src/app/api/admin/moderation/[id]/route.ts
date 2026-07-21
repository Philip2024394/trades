// PATCH /api/admin/moderation/[id] — resolve a moderation flag.
//
// Body: { status: "approved" | "hidden" | "removed" | "escalated", note?: string }
// Approved = leave content visible + close flag
// Hidden   = soft-hide via product adapter (Rule 3 non-destructive)
// Removed  = still soft-hide in v1 (hard delete goes through GDPR)
// Escalated = kicks to /admin/moderation/escalated (legal/ops queue)

import { NextResponse } from "next/server";
import { assertAdminRole, getAdminIdentity } from "@/lib/admin/rbac";
import { writeAuditLog, extractRequestContext } from "@/lib/admin/auditLog";
import { resolveFlag, loadFlag } from "@/lib/moderation/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await assertAdminRole(["admin", "moderator"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    status?: "approved" | "hidden" | "removed" | "escalated";
    note?:   string;
  } | null;
  if (!body?.status) return NextResponse.json({ error: "status required" }, { status: 400 });

  const before   = await loadFlag(id);
  const identity = await getAdminIdentity();
  const res = await resolveFlag({
    flagId:          id,
    status:          body.status,
    reviewerAdminId: identity?.adminId ?? null,
    reviewerEmail:   identity?.email   ?? "root",
    resolutionNote:  body.note
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });

  void writeAuditLog({
    ...extractRequestContext(req),
    actorAdminId: identity?.adminId ?? null,
    actorEmail:   identity?.email   ?? "root",
    actorKind:    identity?.role    ?? "admin",
    action:       `moderation.flag.${body.status}`,
    targetType:   "moderation_flag",
    targetId:     id,
    targetSlug:   before?.subject_kind ?? null,
    beforeState:  before,
    afterState:   res.flag ?? null,
    reason:       body.note ?? null
  });

  return NextResponse.json({ ok: true });
}
