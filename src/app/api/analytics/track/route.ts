// POST /api/analytics/track
//
// Public client-side analytics ingress. Thin wrapper over the internal
// `track()` helper — accepts a limited whitelist of event slugs so
// clients can't spoof lifecycle stages or claim arbitrary product
// namespaces. All events log the caller's session identity (merchant
// slug or homeowner cookie) automatically; body-supplied actorKind /
// actorId are ignored.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { track } from "@/lib/analytics/track";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Whitelisted client-emittable events. Anything else 400s.
const ALLOWED_SLUGS = new Set<string>([
  "canteen.member_post_clickthrough",
  "canteen.nav_intent",
  "canteen.tile_tap"
]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as {
    slug?: string; product?: string; targetKind?: string; targetId?: string;
    metadata?: Record<string, unknown>;
  } | null;
  if (!body?.slug || !ALLOWED_SLUGS.has(body.slug)) {
    return NextResponse.json({ ok: false, error: "invalid-slug" }, { status: 400 });
  }

  const viewerMerchantSlug = await getMerchantSlug();
  const jar = await cookies();
  const homeownerId = jar.get("tn_homeowner_sid")?.value ?? null;
  const actorKind: "merchant" | "homeowner" | "guest" =
    viewerMerchantSlug ? "merchant" : homeownerId ? "homeowner" : "guest";
  const actorId = viewerMerchantSlug ?? homeownerId ?? "guest";

  void track({
    slug:       body.slug,
    product:    (body.product ?? "canteen") as never,
    actorKind,
    actorId,
    targetKind: body.targetKind ?? null,
    targetId:   body.targetId   ?? null,
    metadata:   body.metadata   ?? null
  });

  return NextResponse.json({ ok: true });
}
