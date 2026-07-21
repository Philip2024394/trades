// PATCH /api/admin/verifications/[id]
// Body: { action: "approve" | "reject", reason?: string, expiresAt?: string }

import { NextResponse } from "next/server";
import { assertAdminRole } from "@/lib/admin/rbac";
import { writeAuditLog, extractRequestContext } from "@/lib/admin/auditLog";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { approveVerification, rejectVerification } from "@/lib/verification/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdminRole(["admin", "moderator"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    action?: "approve" | "reject";
    reason?: string;
    expiresAt?: string;
  } | null;
  if (!body?.action) return NextResponse.json({ error: "missing-action" }, { status: 400 });

  const before = await supabaseAdmin
    .from("hammerex_verifications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let ok = false;
  if (body.action === "approve") {
    ok = await approveVerification({
      verificationId: id,
      reviewerAdminId: auth.identity.adminId,
      reviewerEmail:   auth.identity.email,
      expiresAt:       body.expiresAt ?? null
    });
  } else if (body.action === "reject") {
    if (!body.reason?.trim()) return NextResponse.json({ error: "missing-reason" }, { status: 400 });
    ok = await rejectVerification({
      verificationId: id,
      reviewerAdminId: auth.identity.adminId,
      reviewerEmail:   auth.identity.email,
      reason:          body.reason.trim()
    });
  }
  if (!ok) return NextResponse.json({ error: "update-failed" }, { status: 500 });

  const { ipAddress, userAgent } = extractRequestContext(req);
  void writeAuditLog({
    actorAdminId: auth.identity.adminId,
    actorEmail:   auth.identity.email,
    actorKind:    auth.identity.role,
    action:       `verification.${body.action}`,
    targetType:   "verification",
    targetId:     id,
    targetSlug:   (before.data as { subject_slug: string | null }).subject_slug,
    beforeState:  before.data as Record<string, unknown>,
    afterState:   { status: body.action === "approve" ? "verified" : "rejected", reason: body.reason ?? null },
    reason:       body.reason ?? null,
    ipAddress, userAgent
  });

  return NextResponse.json({ ok: true });
}
