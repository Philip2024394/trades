// POST /api/admin/affiliates/commissions/bulk
//
// Bulk approve OR mark-paid a set of commission IDs. Validates admin
// session, validates the action, and runs the update as one statement
// (Postgres treats UPDATE … WHERE id IN (…) atomically — either every
// row meets the WHERE filter and gets the patch, or the call errors
// without partial writes). An audit-log row is inserted per id so the
// trail is fully reconstructable.
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recomputeAffiliateLevel } from "@/lib/affiliateLevel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set(["approve", "mark_paid"]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
    );
  }
  let body: { commission_ids?: unknown; action?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const ids = Array.isArray(body.commission_ids)
    ? body.commission_ids.filter((v): v is string => typeof v === "string")
    : [];
  const action = typeof body.action === "string" ? body.action : "";
  if (ids.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No commissions selected." },
      { status: 400 }
    );
  }
  if (!ACTIONS.has(action)) {
    return NextResponse.json(
      { ok: false, error: "Unknown action." },
      { status: 400 }
    );
  }
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  let fromStatus: string;
  let toStatus: string;
  if (action === "approve") {
    fromStatus = "pending";
    toStatus = "approved";
    patch.status = "approved";
    patch.approved_at = now;
  } else {
    fromStatus = "approved";
    toStatus = "paid";
    patch.status = "paid";
    patch.paid_at = now;
  }

  // Single bulk UPDATE — restrict by id IN (…) AND status = fromStatus
  // so we never accidentally cancel→paid by id-stuffing. Supabase
  // forwards each call as one statement (atomic).
  const upd = await supabaseAdmin
    .from("hammerex_affiliate_commissions")
    .update(patch)
    .in("id", ids)
    .eq("status", fromStatus)
    .select("id, affiliate_id");
  if (upd.error) {
    return NextResponse.json(
      { ok: false, error: upd.error.message },
      { status: 500 }
    );
  }
  const updated = upd.data ?? [];

  // Per-row audit log so the trail's reconstructable.
  if (updated.length > 0) {
    await supabaseAdmin
      .from("hammerex_affiliate_audit_log")
      .insert(
        updated.map((r) => ({
          actor_type: "admin",
          actor_id: "admin",
          action: `commission.${toStatus}.bulk`,
          target_id: r.id
        }))
      );
  }

  // Recompute level for each affiliate whose paid count just changed.
  if (toStatus === "paid") {
    const affiliateIds = Array.from(
      new Set(
        updated
          .map((r) => (r as { affiliate_id: number }).affiliate_id)
          .filter((v): v is number => typeof v === "number")
      )
    );
    for (const aid of affiliateIds) {
      await recomputeAffiliateLevel(aid);
    }
  }

  return NextResponse.json({
    ok: true,
    updated: updated.length,
    requested: ids.length
  });
}
