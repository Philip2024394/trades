// Server-side notebook reader — the notebook is a DERIVED view over
// events that already live in other tables:
//
//   hammerex_network_reviews          → review-landed, review-published,
//                                          review-needs-response events
//   hammerex_trade_off_yard_posts       → yard-mention events (when a
//                                          yard post @mentions the merchant)
//   hammerex_canteen_posts (planned)    → canteen-mention events
//   hammerex_canteen_products.boost     → boost-active / boost-ended events
//
// No new table. The notebook page runs a fanning query and merges
// the results into the existing NotebookEvent contract. When the DB
// has nothing (or errors), we fall back to mocks so the merchant
// notebook stays visitable during the migration window.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { NotebookEvent } from "@/lib/notebook";
import { eventsForMerchant as eventsForMerchantMock } from "@/lib/notebook";

const COOL_OFF_MS = 72 * 60 * 60 * 1000;

export async function eventsForMerchantFromDb(merchantSlug: string): Promise<NotebookEvent[]> {
  const events: NotebookEvent[] = [];

  // ─── Reviews-derived events ─────────────────────────────
  //
  // Every review row produces at least one notebook event:
  //   - status='published'  → 'review-landed' (with high-rating variant
  //                            for 5* + 'review-published' when the row
  //                            transitioned from pending to published)
  //   - status='pending'    → 'review-needs-response' (action-required
  //                            with deadlineAt = publish_at)
  //   - owner_response_at   → additionally emit a resolved marker
  const reviewsRes = await supabaseAdmin
    .from("hammerex_network_reviews")
    .select("id, reviewer_display_name, reviewer_trade_label, reviewer_city, quality_score, communication_score, punctuality_score, value_score, cleanliness_score, trade_specific_score, overall_score, body, status, publish_at, owner_response_at, admin_action, created_at")
    .eq("merchant_slug", merchantSlug)
    .in("status", ["pending", "published"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (!reviewsRes.error) {
    for (const r of reviewsRes.data ?? []) {
      const overall = Number(r.overall_score);
      const needsResponse = r.status === "pending" && !r.owner_response_at;
      events.push({
        id: `nb_review_${r.id}`,
        merchantSlug,
        kind: needsResponse ? "review-needs-response" : "review-landed",
        tone: needsResponse ? "action-required" : "review",
        when: r.created_at,
        deadlineAt: needsResponse ? (r.publish_at ?? undefined) : undefined,
        title: needsResponse
          ? `${r.reviewer_display_name} left a ${overall.toFixed(1)}★ review`
          : `New ${Math.round(overall)}★ review from ${r.reviewer_display_name}`,
        body: needsResponse
          ? "72-hour response window is running. Reply privately, respond publicly, or dispute with evidence before it publishes."
          : `"${(r.body ?? "").slice(0, 180)}${(r.body?.length ?? 0) > 180 ? "..." : ""}"`,
        meta: [r.reviewer_trade_label, r.reviewer_city].filter(Boolean).join(" · "),
        action: needsResponse
          ? { label: "Respond in 72h window", href: `/trade/${merchantSlug}/reviews/pending` }
          : { label: "See review", href: `/trade/${merchantSlug}/reviews` },
        actionRequired: needsResponse
      });
    }
  } else {
    // eslint-disable-next-line no-console
    console.error("[notebook.server] reviews fan", reviewsRes.error);
  }

  // ─── Boost-derived events ───────────────────────────────
  //
  // Any canteen product with a boost.expiresAt in the future is an
  // active boost. Boosts that expired within the last 30 days show up
  // as "boost-ended" summaries so the merchant sees the arc.
  const productsRes = await supabaseAdmin
    .from("hammerex_canteen_products")
    .select("id, name, boost, updated_at")
    .eq("host_slug", merchantSlug)
    .not("boost", "is", null)
    .limit(50);

  if (!productsRes.error) {
    const nowMs = Date.now();
    for (const p of productsRes.data ?? []) {
      const boost = p.boost as { expiresAt?: string; paidGbp?: number } | null;
      if (!boost?.expiresAt) continue;
      const expiresMs = Date.parse(boost.expiresAt);
      const isActive = expiresMs > nowMs;
      const ageMs = nowMs - Date.parse(p.updated_at ?? new Date().toISOString());
      if (!isActive && ageMs > 30 * 24 * 60 * 60 * 1000) continue;
      events.push({
        id: `nb_boost_${p.id}`,
        merchantSlug,
        kind: isActive ? "boost-active" : "boost-ended",
        tone: "boost",
        when: p.updated_at ?? new Date().toISOString(),
        deadlineAt: isActive ? boost.expiresAt : undefined,
        title: isActive
          ? `Boost active on ${p.name}`
          : `Boost ended on ${p.name}`,
        body: isActive
          ? `Sponsored across every canteen. Expires ${new Date(boost.expiresAt).toLocaleDateString("en-GB")}.`
          : undefined,
        meta: boost.paidGbp ? `£${boost.paidGbp}` : undefined,
        action: isActive
          ? { label: "See boost performance", href: `/trade-off/yard/canteens/manage` }
          : undefined
      });
    }
  }

  // ─── Yard-mention events ────────────────────────────────
  //
  // Best-effort: any yard post whose body contains the merchant slug
  // becomes a yard-mention. Full mention parsing lands with the yard
  // schema's mentions_slugs[] column.
  const yardRes = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("id, title, body, created_at")
    .ilike("body", `%${merchantSlug}%`)
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(20);

  if (!yardRes.error) {
    for (const p of yardRes.data ?? []) {
      events.push({
        id: `nb_yard_${p.id}`,
        merchantSlug,
        kind: "yard-mention",
        tone: "canteen",
        when: p.created_at,
        title: `Mentioned in a Yard post`,
        body: `"${(p.title ?? p.body ?? "").slice(0, 160)}"`,
        meta: "Trade Chat"
      });
    }
  }

  // Sort chronologically (newest first).
  events.sort((a, b) => Date.parse(b.when) - Date.parse(a.when));

  // Fallback — if we have nothing real, use the mock to keep the
  // notebook demo alive. Real events + mock never mix.
  if (events.length === 0) return eventsForMerchantMock(merchantSlug);

  return events;
}

// Re-export the cool-off constant so callers can reference it without
// pulling from the client-side notebook module.
export const NOTEBOOK_COOL_OFF_MS = COOL_OFF_MS;
