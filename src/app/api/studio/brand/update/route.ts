// PATCH /api/studio/brand/update
// Patch a merchant's Brand DNA. Emits Identity.*Changed.v1 events so
// downstream subscribers (asset-stale flagger, cascade regenerator)
// can react. This is what makes the event bus a real feature, not a
// theoretical one.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStudioSession } from "@/lib/studio/session";
import { eventBus, envelope } from "@/lib/design/trade-os/event-bus";
import { ensureSubscribersLoaded } from "@/lib/design/trade-os/subscribers";
import { safeParseBrandRecord } from "@/lib/design/brand/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BrandPatch = {
  colour?: {
    primary?:   string;
    secondary?: string;
    accent?:    string;
  };
  typography?: {
    primary?:   string;
    secondary?: string;
  };
  logo?: { masterSvg?: string };
  tagline?:     string;
  positioning?: string;
};

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await loadStudioSession();
  if (!session) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const patch = await req.json().catch(() => null) as BrandPatch | null;
  if (!patch) return NextResponse.json({ ok: false, error: "missing_patch" }, { status: 400 });

  const slug = session.merchant.slug;

  const { data: identity, error: readErr } = await supabaseAdmin
    .from("hammerex_brand_identity")
    .select("id, brand_json")
    .eq("merchant_slug", slug)
    .maybeSingle();

  if (readErr) return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
  if (!identity) return NextResponse.json({ ok: false, error: "no_brand_dna_yet" }, { status: 409 });

  const before = identity.brand_json as Record<string, unknown>;
  const merged = mergeBrandPatch(before, patch);

  const parsed = safeParseBrandRecord(merged);
  if (!parsed) return NextResponse.json({ ok: false, error: "invalid_brand_after_patch" }, { status: 400 });

  const { error: writeErr } = await supabaseAdmin
    .from("hammerex_brand_identity")
    .update({ brand_json: parsed })
    .eq("id", identity.id);
  if (writeErr) return NextResponse.json({ ok: false, error: writeErr.message }, { status: 500 });

  // Emit the specific events for what actually changed. Subscribers
  // pick the right cascade per event, not per patch.
  ensureSubscribersLoaded();

  const beforeColour = (before as { colour?: { primary?: string } }).colour;
  if (patch.colour && beforeColour?.primary !== patch.colour.primary) {
    await eventBus.publish(envelope({
      type: "Identity.ColourChanged.v1",
      payload: {
        merchant_slug: slug,
        old_primary:   beforeColour?.primary,
        new_primary:   patch.colour.primary
      },
      merchantId: slug,
      producer:   "brand-editor"
    }));
  }

  const beforeType = (before as { typography?: { primary?: string } }).typography;
  if (patch.typography && beforeType?.primary !== patch.typography.primary) {
    await eventBus.publish(envelope({
      type: "Identity.TypographyChanged.v1",
      payload: {
        merchant_slug: slug,
        old_family:    beforeType?.primary,
        new_family:    patch.typography.primary
      },
      merchantId: slug,
      producer:   "brand-editor"
    }));
  }

  await eventBus.publish(envelope({
    type: "Brand.Updated.v1",
    payload: { merchant_slug: slug, patched_fields: Object.keys(patch) },
    merchantId: slug,
    producer:   "brand-editor"
  }));

  return NextResponse.json({ ok: true, brand: parsed });
}

function mergeBrandPatch(before: Record<string, unknown>, patch: BrandPatch): Record<string, unknown> {
  const next = { ...before };
  if (patch.colour) {
    next.colour = { ...(before.colour as object ?? {}), ...patch.colour };
  }
  if (patch.typography) {
    next.typography = { ...(before.typography as object ?? {}), ...patch.typography };
  }
  if (patch.logo) {
    next.logo = { ...(before.logo as object ?? {}), ...patch.logo };
  }
  if (patch.tagline !== undefined)     next.tagline     = patch.tagline;
  if (patch.positioning !== undefined) next.positioning = patch.positioning;
  return next;
}
