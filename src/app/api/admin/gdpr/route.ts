// POST /api/admin/gdpr — create a new GDPR request (export or delete).
// Body: { subjectKind, subjectId, subjectEmail, requestKind, reason? }

import { NextResponse } from "next/server";
import { assertAdminRole, getAdminIdentity } from "@/lib/admin/rbac";
import { writeAuditLog, extractRequestContext } from "@/lib/admin/auditLog";
import { createRequest, type GdprRequestKind, type GdprSubjectKind } from "@/lib/gdpr/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await assertAdminRole(["admin"]);   // GDPR is admin-only
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null) as {
    subjectKind?:  GdprSubjectKind;
    subjectId?:    string;
    subjectEmail?: string;
    requestKind?:  GdprRequestKind;
    reason?:       string;
  } | null;
  if (!body?.subjectKind || !body.subjectId || !body.subjectEmail || !body.requestKind) {
    return NextResponse.json({ error: "subjectKind + subjectId + subjectEmail + requestKind required" }, { status: 400 });
  }

  const res = await createRequest({
    subjectKind:      body.subjectKind,
    subjectId:        body.subjectId,
    subjectEmail:     body.subjectEmail,
    requestKind:      body.requestKind,
    submissionSource: "admin_manual",
    reason:           body.reason
  });
  if (!res.ok || !res.id) return NextResponse.json({ error: res.error }, { status: 500 });

  const identity = await getAdminIdentity();
  void writeAuditLog({
    ...extractRequestContext(req),
    actorAdminId: identity?.adminId ?? null,
    actorEmail:   identity?.email   ?? null,
    actorKind:    identity?.role    ?? "admin",
    action:       `gdpr.${body.requestKind}.created`,
    targetType:   "gdpr_request",
    targetId:     res.id,
    targetSlug:   body.subjectKind,
    beforeState:  null,
    afterState:   { ...body }
  });

  return NextResponse.json({ ok: true, id: res.id });
}
