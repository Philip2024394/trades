// GET /api/studio/brand/versions
// Returns the merchant's Brand DNA version history from
// hammerex_brand_snapshots. Newest first.
//
// This is what powers the version-history UI in the Brand Vault: every
// snapshot is an immutable point-in-time copy of the brand.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStudioSession } from "@/lib/studio/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await loadStudioSession();
  if (!session) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const { data: identity } = await supabaseAdmin
    .from("hammerex_brand_identity")
    .select("id, version, updated_at")
    .eq("merchant_slug", session.merchant.slug)
    .maybeSingle();

  if (!identity) {
    return NextResponse.json({ ok: true, current_version: 0, snapshots: [] });
  }

  const { data: snaps, error } = await supabaseAdmin
    .from("hammerex_brand_snapshots")
    .select("id, brand_version, fingerprint, created_at")
    .eq("brand_identity_id", identity.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok:              true,
    current_version: identity.version,
    updated_at:      identity.updated_at,
    snapshots:       (snaps ?? []).map((s) => ({
      id:          s.id,
      version:     s.brand_version,
      fingerprint: s.fingerprint,
      created_at:  s.created_at
    }))
  });
}
