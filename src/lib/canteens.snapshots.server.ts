// Canteen snapshot helpers — server-side only.
//
// Take a snapshot (called on merchant save + daily cron), list snapshots
// per canteen, and restore a snapshot with full safety-gate + audit log.
//
// Restore is NON-DESTRUCTIVE: we always create a "pre_restore" snapshot
// of current state BEFORE applying the target snapshot. If the restore
// was a mistake, admin can restore forward to that pre_restore snapshot.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ─── Types ───────────────────────────────────────────────

export type CanteenSnapshotKind = "auto" | "named" | "pre_restore";

export type CanteenSnapshotRow = {
  id: string;
  canteenId: string;
  kind: CanteenSnapshotKind;
  note: string | null;
  createdBy: string;
  createdAt: string;
  /** Loaded on demand for the diff preview. Undefined in list view. */
  snapshotData?: CanteenSnapshotPayload;
};

/** The JSONB shape stored in hammerex_canteen_snapshots.snapshot_data. */
export type CanteenSnapshotPayload = {
  canteen: Record<string, unknown> | null;
  admin: Record<string, unknown> | null;
  products: Record<string, unknown>[];
  designs: Record<string, unknown>[];
};

// ─── Take snapshot ────────────────────────────────────────
//
// Captures the current editable state of a canteen. Called from every
// merchant-save endpoint (auto) + daily cron (auto) + Save Version
// button (named) + before every restore (pre_restore).

export async function takeCanteenSnapshot(opts: {
  canteenId: string;
  kind: CanteenSnapshotKind;
  note?: string;
  createdBy?: string;
}): Promise<{ id: string } | null> {
  const { canteenId, kind, note = null, createdBy = "system:auto-save" } = opts;

  // Load current state — parallel reads.
  const [canteenRes, productsRes, designsRes] = await Promise.all([
    supabaseAdmin
      .from("hammerex_canteens")
      .select("*")
      .eq("id", canteenId)
      .maybeSingle(),
    supabaseAdmin
      .from("hammerex_canteen_products")
      .select("*")
      .eq("canteen_id", canteenId),
    supabaseAdmin
      .from("hammerex_canteen_designs")
      .select("*")
      .eq("canteen_id", canteenId)
      .is("archived_at", null)
  ]);

  if (canteenRes.error || !canteenRes.data) {
    // eslint-disable-next-line no-console
    console.error("[canteens.snapshots] takeSnapshot canteen read failed", canteenRes.error);
    return null;
  }

  // Load admin/host row — separate query since it lives in a different
  // table and we need the host_slug from the canteen row to fetch it.
  const hostSlug = (canteenRes.data.host_slug ?? null) as string | null;
  let adminRow: Record<string, unknown> | null = null;
  if (hostSlug) {
    const adminRes = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("*")
      .eq("slug", hostSlug)
      .maybeSingle();
    if (!adminRes.error && adminRes.data) adminRow = adminRes.data;
  }

  const payload: CanteenSnapshotPayload = {
    canteen: canteenRes.data,
    admin: adminRow,
    products: productsRes.data ?? [],
    designs: designsRes.data ?? []
  };

  const res = await supabaseAdmin
    .from("hammerex_canteen_snapshots")
    .insert({
      canteen_id: canteenId,
      kind,
      note,
      snapshot_data: payload,
      created_by: createdBy
    })
    .select("id")
    .maybeSingle();

  if (res.error || !res.data) {
    // eslint-disable-next-line no-console
    console.error("[canteens.snapshots] insert failed", res.error);
    return null;
  }
  return { id: String(res.data.id) };
}

// ─── List snapshots ───────────────────────────────────────

export async function listCanteenSnapshots(canteenId: string): Promise<CanteenSnapshotRow[]> {
  const res = await supabaseAdmin
    .from("hammerex_canteen_snapshots")
    .select("id, canteen_id, kind, note, created_by, created_at")
    .eq("canteen_id", canteenId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.snapshots] list failed", res.error);
    return [];
  }
  return (res.data ?? []).map((r) => ({
    id:         String(r.id),
    canteenId:  String(r.canteen_id),
    kind:       r.kind as CanteenSnapshotKind,
    note:       (r.note as string | null) ?? null,
    createdBy:  String(r.created_by),
    createdAt:  String(r.created_at)
  }));
}

// ─── Load one snapshot with payload (for diff preview) ────

export async function loadCanteenSnapshot(snapshotId: string): Promise<CanteenSnapshotRow | null> {
  const res = await supabaseAdmin
    .from("hammerex_canteen_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return {
    id:            String(res.data.id),
    canteenId:     String(res.data.canteen_id),
    kind:          res.data.kind as CanteenSnapshotKind,
    note:          (res.data.note as string | null) ?? null,
    createdBy:     String(res.data.created_by),
    createdAt:     String(res.data.created_at),
    snapshotData:  res.data.snapshot_data as CanteenSnapshotPayload
  };
}

// ─── Restore snapshot ─────────────────────────────────────
//
// Applies a stored snapshot to the current canteen state. Steps:
//   1. Load target snapshot (400 if not found)
//   2. Take a pre_restore snapshot of CURRENT state (so undo works)
//   3. Update canteen row from snapshot.canteen
//   4. Update admin row from snapshot.admin (if present)
//   5. Replace products: delete current, insert snapshot.products
//   6. Replace designs: delete current, insert snapshot.designs
//   7. Write to hammerex_canteen_restore_log
//
// Actor + reason are required. Reason must be ≥ 20 chars — enforced by
// the calling API route, not this function, so the DB layer stays clean.

export async function restoreCanteenSnapshot(opts: {
  snapshotId: string;
  actor: string;
  reason: string;
}): Promise<
  | { ok: true; preRestoreSnapshotId: string }
  | { ok: false; error: string }
> {
  const { snapshotId, actor, reason } = opts;

  const target = await loadCanteenSnapshot(snapshotId);
  if (!target || !target.snapshotData) {
    return { ok: false, error: "Snapshot not found" };
  }
  const payload = target.snapshotData;
  const canteenId = target.canteenId;

  // Step 1 — pre_restore snapshot of CURRENT state.
  const preRestore = await takeCanteenSnapshot({
    canteenId,
    kind: "pre_restore",
    note: `Pre-restore snapshot for ${snapshotId}`,
    createdBy: actor
  });
  if (!preRestore) {
    return { ok: false, error: "Failed to capture pre-restore snapshot; aborting" };
  }

  // Step 2 — restore canteen row.
  if (payload.canteen) {
    // Strip fields we don't want to overwrite (id, timestamps).
    const {
      id: _canteenId,
      created_at: _createdAt,
      updated_at: _updatedAt,
      ...canteenFields
    } = payload.canteen as Record<string, unknown>;
    void _canteenId; void _createdAt; void _updatedAt;
    const canteenRes = await supabaseAdmin
      .from("hammerex_canteens")
      .update(canteenFields)
      .eq("id", canteenId);
    if (canteenRes.error) {
      return { ok: false, error: `Canteen restore failed: ${canteenRes.error.message}` };
    }
  }

  // Step 3 — restore admin row.
  if (payload.admin && payload.admin.slug) {
    const { id: _adminId, created_at: _adminCreated, ...adminFields } =
      payload.admin as Record<string, unknown>;
    void _adminId; void _adminCreated;
    const adminRes = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .update(adminFields)
      .eq("slug", payload.admin.slug);
    if (adminRes.error) {
      // eslint-disable-next-line no-console
      console.error("[canteens.snapshots] admin restore failed", adminRes.error);
      // Don't hard-fail — canteen still needs product/design restore.
    }
  }

  // Step 4 — replace products.
  {
    const del = await supabaseAdmin
      .from("hammerex_canteen_products")
      .delete()
      .eq("canteen_id", canteenId);
    if (del.error) {
      return { ok: false, error: `Product delete failed: ${del.error.message}` };
    }
    if (payload.products.length > 0) {
      const ins = await supabaseAdmin
        .from("hammerex_canteen_products")
        .insert(payload.products);
      if (ins.error) {
        return { ok: false, error: `Product restore failed: ${ins.error.message}` };
      }
    }
  }

  // Step 5 — replace designs.
  {
    const del = await supabaseAdmin
      .from("hammerex_canteen_designs")
      .delete()
      .eq("canteen_id", canteenId);
    if (del.error) {
      return { ok: false, error: `Design delete failed: ${del.error.message}` };
    }
    if (payload.designs.length > 0) {
      const ins = await supabaseAdmin
        .from("hammerex_canteen_designs")
        .insert(payload.designs);
      if (ins.error) {
        return { ok: false, error: `Design restore failed: ${ins.error.message}` };
      }
    }
  }

  // Step 6 — audit log.
  await supabaseAdmin
    .from("hammerex_canteen_restore_log")
    .insert({
      canteen_id: canteenId,
      restored_from_snapshot_id: snapshotId,
      pre_restore_snapshot_id: preRestore.id,
      actor,
      reason
    });

  return { ok: true, preRestoreSnapshotId: preRestore.id };
}
