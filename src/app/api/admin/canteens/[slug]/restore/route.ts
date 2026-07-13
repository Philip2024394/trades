// POST /api/admin/canteens/[slug]/restore
//
// Admin-only canteen restore. Under Customer Support tools — used when
// a paid merchant has broken their canteen and asks for a rollback.
//
// Safety gates (all required):
//   1. Admin session cookie must be valid
//   2. Body.passcode must match ADMIN_RESET_PASSCODE env (second factor
//      so muscle memory can't accidentally fire this on the wrong row)
//   3. Body.slugConfirmation must exactly match the canteen slug in the
//      URL (typed by admin, forces intentional targeting)
//   4. Body.reason must be ≥ 20 chars (permanent audit note)
//
// On success:
//   - Non-destructive restore (pre_restore snapshot captured first)
//   - Audit log row written
//   - Response includes preRestoreSnapshotId so admin can undo

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { restoreCanteenSnapshot } from "@/lib/canteens.snapshots.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_REASON_LENGTH = 20;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  // Gate 1 — admin session
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ ok: false, error: "Not authorised" }, { status: 401 });
  }

  const { slug } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    snapshotId?: string;
    passcode?: string;
    slugConfirmation?: string;
    reason?: string;
  };

  const { snapshotId, passcode, slugConfirmation, reason } = body;

  // Gate 2 — reset passcode (second factor)
  const expectedPasscode = process.env.ADMIN_RESET_PASSCODE ?? "";
  if (!expectedPasscode) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_RESET_PASSCODE not configured in env" },
      { status: 500 }
    );
  }
  if (!passcode || passcode !== expectedPasscode) {
    return NextResponse.json(
      { ok: false, error: "Passcode incorrect" },
      { status: 403 }
    );
  }

  // Gate 3 — slug confirmation (must match URL exactly)
  if (!slugConfirmation || slugConfirmation !== slug) {
    return NextResponse.json(
      { ok: false, error: `Slug confirmation must match "${slug}" exactly` },
      { status: 400 }
    );
  }

  // Gate 4 — reason note (audit trail)
  if (!reason || reason.trim().length < MIN_REASON_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `Reason must be at least ${MIN_REASON_LENGTH} characters — this goes into the permanent audit log` },
      { status: 400 }
    );
  }

  if (!snapshotId) {
    return NextResponse.json({ ok: false, error: "snapshotId required" }, { status: 400 });
  }

  // Verify the snapshot actually belongs to this canteen (belt + braces
  // — prevents cross-canteen restore even if the admin has a stale UI).
  const canteenRes = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (canteenRes.error || !canteenRes.data) {
    return NextResponse.json({ ok: false, error: "Canteen not found" }, { status: 404 });
  }
  const canteenId = String(canteenRes.data.id);

  const snapshotRes = await supabaseAdmin
    .from("hammerex_canteen_snapshots")
    .select("canteen_id")
    .eq("id", snapshotId)
    .maybeSingle();
  if (snapshotRes.error || !snapshotRes.data) {
    return NextResponse.json({ ok: false, error: "Snapshot not found" }, { status: 404 });
  }
  if (String(snapshotRes.data.canteen_id) !== canteenId) {
    return NextResponse.json(
      { ok: false, error: "Snapshot does not belong to this canteen" },
      { status: 400 }
    );
  }

  // Fire the restore
  const result = await restoreCanteenSnapshot({
    snapshotId,
    actor: "admin",
    reason: reason.trim()
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    preRestoreSnapshotId: result.preRestoreSnapshotId,
    message: `Canteen "${slug}" restored. Pre-restore snapshot saved as ${result.preRestoreSnapshotId} — restore to that ID to undo.`
  });
}
