// POST /api/admin/gdpr/[id]/fulfill — fulfil a GDPR request.
//
// For "export": builds the bundle, returns JSON inline (v1). Phase 6+ uploads
// to Supabase Storage with a 7-day pre-signed URL emailed to the subject.
//
// For "delete": runs eraseHomeowner() (or equivalent), marks fulfilled,
// audit-logs the erasure with a snapshot of the subject state before nulling.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdminRole, getAdminIdentity } from "@/lib/admin/rbac";
import { writeAuditLog, extractRequestContext } from "@/lib/admin/auditLog";
import { buildExportBundle, eraseHomeowner, markFulfilled } from "@/lib/gdpr/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await assertAdminRole(["admin"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const identity = await getAdminIdentity();

  const reqRow = await supabaseAdmin
    .from("hammerex_gdpr_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!reqRow.data) return NextResponse.json({ error: "request not found" }, { status: 404 });
  const gdpr = reqRow.data as {
    id: string; subject_kind: string; subject_id: string; subject_email: string;
    request_kind: "export" | "delete"; status: string;
  };
  if (gdpr.status === "fulfilled") return NextResponse.json({ error: "already fulfilled" }, { status: 400 });

  if (gdpr.request_kind === "export") {
    const bundle = await buildExportBundle(gdpr.subject_kind as never, gdpr.subject_id);
    const bytes  = new TextEncoder().encode(JSON.stringify(bundle)).length;
    await markFulfilled({
      requestId:       id,
      reviewerEmail:   identity?.email   ?? "root",
      reviewerAdminId: identity?.adminId ?? null,
      bundleBytes:     bytes
    });
    void writeAuditLog({
      ...extractRequestContext(req),
      actorAdminId: identity?.adminId ?? null,
      actorEmail:   identity?.email   ?? null,
      actorKind:    identity?.role    ?? "admin",
      action:       "gdpr.export.fulfilled",
      targetType:   "gdpr_request",
      targetId:     id,
      targetSlug:   gdpr.subject_kind,
      beforeState:  { status: gdpr.status },
      afterState:   { status: "fulfilled", bytes }
    });
    return NextResponse.json({ ok: true, bundle });
  }

  // request_kind === "delete"
  if (gdpr.subject_kind !== "homeowner") {
    return NextResponse.json({ error: "delete not yet supported for this subject_kind" }, { status: 501 });
  }
  const snapshot = await buildExportBundle("homeowner", gdpr.subject_id);
  const erase    = await eraseHomeowner(gdpr.subject_id);
  if (!erase.ok) return NextResponse.json({ error: erase.error }, { status: 500 });
  await markFulfilled({
    requestId:       id,
    reviewerEmail:   identity?.email   ?? "root",
    reviewerAdminId: identity?.adminId ?? null
  });
  void writeAuditLog({
    ...extractRequestContext(req),
    actorAdminId: identity?.adminId ?? null,
    actorEmail:   identity?.email   ?? null,
    actorKind:    identity?.role    ?? "admin",
    action:       "gdpr.delete.fulfilled",
    targetType:   "homeowner",
    targetId:     gdpr.subject_id,
    targetSlug:   gdpr.subject_email,
    beforeState:  snapshot as unknown as Record<string, unknown>,
    afterState:   { status: "erased" }
  });
  return NextResponse.json({ ok: true, erased: true });
}
