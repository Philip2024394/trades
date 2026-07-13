// POST /api/canteens/[slug]/posts/create
//
// Post to a canteen. Role gate depends on kind:
//   - chat / question / showcase / make-offer → any member
//   - announcement                             → host only
//   - counter                                  → host only (promotes
//       a canteen product to the platform-wide Counter stream)
//
// counter posts are the flowing marketplace stream. When a host adds
// one, it appears on EVERY canteen's right-column Counter feed —
// this is how a Manchester kitchen fitter's oak worktop reaches a
// Leeds bathroom fitter.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdentity } from "@/lib/merchantSession";
import { logActivityEvent } from "@/lib/activity";

type PostPayload = {
  kind: "chat" | "question" | "showcase" | "make-offer" | "announcement" | "counter";
  body?: string;
  photoUrls?: string[];
  moodSlug?: string;
  priceGbp?: number;
  currency?: string;
  targetTradeSlugs?: string[];
  expiresAt?: string;
};

const HOST_ONLY_KINDS = new Set<PostPayload["kind"]>(["announcement", "counter"]);
const VALID_KINDS = new Set<PostPayload["kind"]>([
  "chat", "question", "showcase", "make-offer", "announcement", "counter"
]);

const MAX_BODY = 4000;
const MAX_PHOTOS = 8;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }
  const { slug } = await params;

  let payload: PostPayload;
  try {
    payload = (await req.json()) as PostPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  if (!VALID_KINDS.has(payload.kind)) {
    return NextResponse.json({ ok: false, error: "invalid-kind" }, { status: 400 });
  }
  const body = String(payload.body ?? "").trim();
  if (payload.kind !== "counter" && body.length === 0 && (payload.photoUrls?.length ?? 0) === 0) {
    return NextResponse.json({ ok: false, error: "empty-post" }, { status: 400 });
  }
  if (body.length > MAX_BODY) {
    return NextResponse.json({ ok: false, error: "body-too-long" }, { status: 400 });
  }
  if ((payload.photoUrls?.length ?? 0) > MAX_PHOTOS) {
    return NextResponse.json({ ok: false, error: "too-many-photos" }, { status: 400 });
  }

  // Look up canteen + verify membership. Host bypasses the member
  // check (host is always allowed even if the membership row is
  // missing during a fresh-canteen bootstrap).
  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug, name, trade_slug, city")
    .eq("slug", slug)
    .maybeSingle();
  if (canteen.error || !canteen.data) {
    return NextResponse.json({ ok: false, error: "canteen-not-found" }, { status: 404 });
  }
  const isHost = canteen.data.host_slug === identity.slug;

  if (HOST_ONLY_KINDS.has(payload.kind) && !isHost) {
    return NextResponse.json({ ok: false, error: "host-only-kind" }, { status: 403 });
  }

  if (!isHost) {
    const member = await supabaseAdmin
      .from("hammerex_canteen_members")
      .select("id")
      .eq("canteen_id", canteen.data.id)
      .eq("member_slug", identity.slug)
      .maybeSingle();
    if (!member.data) {
      return NextResponse.json({ ok: false, error: "not-a-member" }, { status: 403 });
    }
  }

  // Look up author display name once — reused across every post.
  const author = await supabaseAdmin
    .from("hammerex_canteen_members")
    .select("display_name, avatar_url")
    .eq("canteen_id", canteen.data.id)
    .eq("member_slug", identity.slug)
    .maybeSingle();

  const insert = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .insert({
      canteen_id: canteen.data.id,
      author_slug: identity.slug,
      author_display_name: author.data?.display_name ?? identity.slug,
      author_avatar_url: author.data?.avatar_url ?? null,
      kind: payload.kind,
      body: body || null,
      photo_urls: payload.photoUrls ?? [],
      mood_slug: payload.moodSlug?.trim() ?? null,
      price_gbp: typeof payload.priceGbp === "number" ? Math.round(payload.priceGbp) : null,
      currency: payload.currency?.trim() ?? (payload.priceGbp !== undefined ? "GBP" : null),
      target_trade_slugs: payload.targetTradeSlugs ?? null,
      status: "live",
      expires_at: payload.expiresAt?.trim() ?? null
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    // eslint-disable-next-line no-console
    console.error("[canteens.posts.create] insert failed", insert.error);
    return NextResponse.json(
      { ok: false, error: "db-insert-failed", detail: insert.error?.message },
      { status: 500 }
    );
  }

  // Bump the 30-day activity counter on the canteen so Founding-100
  // status recalculates correctly.
  const canteenId = canteen.data.id;
  try {
    const rpc = await supabaseAdmin.rpc("hammerex_canteens_bump_posts", { canteen_id: canteenId });
    if (rpc.error) throw rpc.error;
  } catch {
    // RPC doesn't exist yet — falls back to a simple non-atomic bump.
    const cur = await supabaseAdmin
      .from("hammerex_canteens")
      .select("posts_last_30d")
      .eq("id", canteenId)
      .maybeSingle();
    const prev = cur.data?.posts_last_30d ?? 0;
    await supabaseAdmin
      .from("hammerex_canteens")
      .update({ posts_last_30d: prev + 1 })
      .eq("id", canteenId);
  }

  // Emit a public activity event so the canteen post surfaces on the
  // landing page's live feed (/api/activity/public → os_activity_events).
  // Fire-and-forget — activity emission failing must not fail the post.
  try {
    const canteenRow = canteen.data as { name: string; trade_slug: string | null; city: string | null; host_display_name?: string | null };
    const kindTag = payload.kind === "question" ? "asked a question"
      : payload.kind === "showcase" ? "posted a job update"
      : payload.kind === "announcement" ? "posted an announcement"
      : payload.kind === "make-offer" ? "listed a make-me-an-offer"
      : payload.kind === "counter" ? "put a product on the counter"
      : "posted an update";
    await logActivityEvent({
      kind: "thread_hot",
      is_public: true,
      subject_type: "canteen_post",
      subject_id: insert.data.id,
      summary_text: `A ${(canteenRow.trade_slug ?? "trade").replace(/-/g, " ")} in ${canteenRow.city ?? "the UK"} ${kindTag} on ${canteenRow.name}.`,
      action_url: `/trade-off/yard/canteens/${slug}`,
      source_display_name: null,
      source_trade: canteenRow.trade_slug ?? null,
      source_city: canteenRow.city ?? null
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[canteens.posts.create] activity emit failed (non-fatal)", err);
  }

  return NextResponse.json({ ok: true, id: insert.data.id });
}
