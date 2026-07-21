// POST   /api/admin/users/[id]/suspend — suspend a homeowner
// DELETE /api/admin/users/[id]/suspend — unsuspend a homeowner
//
// Both actions require admin OR support role. Body: { reason?: string }.
// Non-destructive (Rule 3) — sets suspended_at column, doesn't delete data.
// Audit log captures actor + before/after + reason.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdminRole } from "@/lib/admin/rbac";
import { writeAuditLog, extractRequestContext } from "@/lib/admin/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdminRole(["admin", "support"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body   = await req.json().catch(() => ({})) as { reason?: string };
  const reason = (body.reason || "").trim() || null;

  const before = await supabaseAdmin
    .from("hammerex_homeowners")
    .select("id, email, first_name, suspended_at, suspended_reason")
    .eq("id", id)
    .maybeSingle();
  if (!before.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date().toISOString();
  const upd = await supabaseAdmin
    .from("hammerex_homeowners")
    .update({ suspended_at: now, suspended_reason: reason })
    .eq("id", id);
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });

  const { ipAddress, userAgent } = extractRequestContext(req);
  void writeAuditLog({
    actorAdminId: auth.identity.adminId,
    actorEmail:   auth.identity.email,
    actorKind:    auth.identity.role,
    action:       "user.suspend",
    targetType:   "homeowner",
    targetId:     id,
    targetSlug:   (before.data as { email: string }).email,
    beforeState:  before.data,
    afterState:   { suspended_at: now, suspended_reason: reason },
    reason,
    ipAddress, userAgent
  });

  return NextResponse.json({ ok: true, suspended_at: now });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdminRole(["admin", "support"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const before = await supabaseAdmin
    .from("hammerex_homeowners")
    .select("id, email, first_name, suspended_at, suspended_reason")
    .eq("id", id)
    .maybeSingle();
  if (!before.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const upd = await supabaseAdmin
    .from("hammerex_homeowners")
    .update({ suspended_at: null, suspended_reason: null })
    .eq("id", id);
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });

  const { ipAddress, userAgent } = extractRequestContext(req);
  void writeAuditLog({
    actorAdminId: auth.identity.adminId,
    actorEmail:   auth.identity.email,
    actorKind:    auth.identity.role,
    action:       "user.unsuspend",
    targetType:   "homeowner",
    targetId:     id,
    targetSlug:   (before.data as { email: string }).email,
    beforeState:  before.data,
    afterState:   { suspended_at: null, suspended_reason: null },
    ipAddress, userAgent
  });

  return NextResponse.json({ ok: true });
}
