// POST /api/studio/brand/rollback
// Body: { snapshot_id: string }
//
// Restores the merchant's Brand DNA from a prior immutable snapshot.
// The current row is snapshotted first (so rollback is itself reversible),
// then overwritten with the target snapshot's brand_json + fingerprint.
// Publishes Brand.RolledBack.v1 so cascade subscribers refresh assets.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStudioSession } from "@/lib/studio/session";
import { eventBus, envelope } from "@/lib/design/trade-os/event-bus";
import { ensureSubscribersLoaded } from "@/lib/design/trade-os/subscribers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await loadStudioSession();
  if (!session) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null) as { snapshot_id?: string } | null;
  if (!body?.snapshot_id) return NextResponse.json({ ok: false, error: "missing_snapshot_id" }, { status: 400 });

  const slug = session.merchant.slug;

  const { data: identity } = await supabaseAdmin
    .from("hammerex_brand_identity")
    .select("id, brand_json, version")
    .eq("merchant_slug", slug)
    .maybeSingle();
  if (!identity) return NextResponse.json({ ok: false, error: "no_brand" }, { status: 404 });

  // Fetch target snapshot — confirm it belongs to this identity.
  const { data: snap } = await supabaseAdmin
    .from("hammerex_brand_snapshots")
    .select("id, brand_identity_id, brand_json, fingerprint, brand_version")
    .eq("id", body.snapshot_id)
    .maybeSingle();
  if (!snap || snap.brand_identity_id !== identity.id) {
    return NextResponse.json({ ok: false, error: "snapshot_not_found" }, { status: 404 });
  }

  // Snapshot the current state so the rollback is itself reversible.
  await supabaseAdmin
    .from("hammerex_brand_snapshots")
    .insert({
      brand_identity_id: identity.id,
      brand_json:        identity.brand_json,
      fingerprint:       "pre-rollback",
      brand_version:     identity.version
    });

  // Restore the snapshot's brand_json into the identity row.
  const { error } = await supabaseAdmin
    .from("hammerex_brand_identity")
    .update({ brand_json: snap.brand_json })
    .eq("id", identity.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  ensureSubscribersLoaded();
  await eventBus.publish(envelope({
    type:    "Brand.RolledBack.v1",
    payload: {
      merchant_slug:  slug,
      to_snapshot_id: snap.id,
      from_version:   identity.version
    },
    merchantId: slug,
    producer:   "brand-rollback"
  }));

  return NextResponse.json({
    ok:               true,
    restored_from:    snap.id,
    restored_version: snap.brand_version
  });
}
