// Mate context builder — pulls the RIGHT data for each surface.
//
// Merchant → their listing, trust ladder, washer balance, growth,
//            recent yard posts
// Homeowner → their SiteBook projects, warranty vault, quote requests
// Visitor  → the canteen page they're on: merchant bio, reviews,
//            top products, recent posts
//
// Plus, for every surface: top-3 knowledge-base hits from the
// pgvector RAG. This is what turns Mate from a generic chatbot
// into a construction-native agent.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { searchKnowledge, type KnowledgeHit } from "@/lib/knowledge/search";

export type MateSurface = "merchant" | "homeowner" | "visitor";

export type MateContext = {
  surface:       MateSurface;
  userLabel:     string;          // "Signed in as Bob's Kitchens"
  systemFacts:   Record<string, unknown>;
  knowledge:     KnowledgeHit[];
};

type MerchantExtras   = { slug: string };
type HomeownerExtras  = { homeownerId: string };
type VisitorExtras    = { canteenSlug: string };

/** Build Mate's context for a given surface + user question.
 *  Runs multiple queries in parallel. Returns fast: even the
 *  RAG lookup + 4 DB reads land in <200ms in practice. */
export async function buildMateContext(
  surface: MateSurface,
  question: string,
  extras: MerchantExtras | HomeownerExtras | VisitorExtras
): Promise<MateContext> {

  if (surface === "merchant") {
    const { slug } = extras as MerchantExtras;
    const [listingRes, growthRes, ladderRes, washersRes, postsRes, knowledge] = await Promise.all([
      supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("slug, display_name, primary_trade, city, bio, tier, trust_tier, trust_score, rating_avg, rating_count, whatsapp, insurance_verified, trade_body_verified")
        .eq("slug", slug)
        .maybeSingle(),
      supabaseAdmin
        .from("hammerex_merchant_daily_metrics")
        .select("date, profile_views, whatsapp_clicks, posts_shipped, reactions")
        .eq("merchant_slug", slug)
        .gte("date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
        .order("date", { ascending: false }),
      supabaseAdmin
        .from("hammerex_merchant_trust_criteria")
        .select("criterion_slug, met, value_snapshot")
        .eq("merchant_slug", slug),
      supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("washer_balance, washers_monthly_credit")
        .eq("slug", slug)
        .maybeSingle(),
      supabaseAdmin
        .from("hammerex_trade_off_yard_posts")
        .select("id, title, created_at, view_count, reaction_count")
        .eq("listing_slug", slug)
        .order("created_at", { ascending: false })
        .limit(3),
      searchKnowledge(question, { topK: 3, minConfidence: 0.4 })
    ]);

    const listing = listingRes.data ?? null;
    const growth  = growthRes.data ?? [];
    const criteria = ladderRes.data ?? [];
    const washers = washersRes.data ?? null;
    const posts   = postsRes.data ?? [];

    return {
      surface,
      userLabel: listing ? `Signed in as ${listing.display_name}` : `Signed in as ${slug}`,
      systemFacts: {
        merchant: listing ? {
          slug:                listing.slug,
          display_name:        listing.display_name,
          primary_trade:       listing.primary_trade,
          city:                listing.city,
          bio_snippet:         (listing.bio ?? "").slice(0, 240),
          tier:                listing.tier,
          trust_tier:          listing.trust_tier,
          trust_score:         listing.trust_score,
          rating_avg:          listing.rating_avg,
          rating_count:        listing.rating_count,
          has_whatsapp:        !!listing.whatsapp,
          insurance_verified:  !!listing.insurance_verified,
          trade_body_verified: !!listing.trade_body_verified
        } : null,
        growth_last_7d: {
          days:          growth.length,
          total_views:   sum(growth.map((r) => r.profile_views   ?? 0)),
          total_wa_taps: sum(growth.map((r) => r.whatsapp_clicks ?? 0)),
          total_posts:   sum(growth.map((r) => r.posts_shipped   ?? 0)),
          total_reactions: sum(growth.map((r) => r.reactions     ?? 0))
        },
        trust_ladder: {
          criteria_met_count:   criteria.filter((c) => c.met).length,
          criteria_total_count: criteria.length,
          unmet_criteria:       criteria.filter((c) => !c.met).map((c) => c.criterion_slug)
        },
        washers: washers ? {
          balance:         washers.washer_balance,
          monthly_credit:  washers.washers_monthly_credit
        } : null,
        recent_posts: posts.map((p) => ({
          title:          p.title,
          age_days:       Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000),
          views:          p.view_count,
          reactions:      p.reaction_count
        }))
      },
      knowledge
    };
  }

  if (surface === "homeowner") {
    const { homeownerId } = extras as HomeownerExtras;
    const [projectsRes, warrantiesRes, quoteReqsRes, knowledge] = await Promise.all([
      supabaseAdmin
        .from("hammerex_sitebook_projects")
        .select("id, title, status, created_at")
        .eq("homeowner_id", homeownerId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("hammerex_sitebook_warranties")
        .select("id, item_name, expires_at")
        .eq("homeowner_id", homeownerId)
        .order("expires_at", { ascending: true })
        .limit(5),
      supabaseAdmin
        .from("hammerex_quote_requests")
        .select("id, subject, created_at, status")
        .eq("homeowner_id", homeownerId)
        .order("created_at", { ascending: false })
        .limit(3),
      searchKnowledge(question, { topK: 4, minConfidence: 0.4 })
    ]);

    return {
      surface,
      userLabel: "Signed in as homeowner",
      systemFacts: {
        projects:      (projectsRes.data ?? []).map((p) => ({
          title:     p.title, status: p.status,
          age_days:  Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000)
        })),
        warranties:    (warrantiesRes.data ?? []).map((w) => ({
          item: w.item_name,
          expires_in_days: w.expires_at ? Math.floor((new Date(w.expires_at).getTime() - Date.now()) / 86400000) : null
        })),
        quote_requests: (quoteReqsRes.data ?? []).map((q) => ({
          subject: q.subject, status: q.status,
          age_days: Math.floor((Date.now() - new Date(q.created_at).getTime()) / 86400000)
        }))
      },
      knowledge
    };
  }

  // Visitor surface — the canteen page the person is chatting from
  const { canteenSlug } = extras as VisitorExtras;
  const [merchantRes, reviewsRes, productsRes, postsRes, knowledge] = await Promise.all([
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("slug, display_name, primary_trade, city, bio, rating_avg, rating_count, whatsapp, trust_tier, insurance_verified")
      .eq("slug", canteenSlug)
      .maybeSingle(),
    supabaseAdmin
      .from("hammerex_reviews")
      .select("stars, title, body, created_at")
      .eq("listing_slug", canteenSlug)
      .order("created_at", { ascending: false })
      .limit(3),
    supabaseAdmin
      .from("hammerex_canteen_products")
      .select("name, price_gbp, blurb")
      .eq("host_slug", canteenSlug)
      .limit(4),
    supabaseAdmin
      .from("hammerex_trade_off_yard_posts")
      .select("title, created_at")
      .eq("listing_slug", canteenSlug)
      .order("created_at", { ascending: false })
      .limit(3),
    searchKnowledge(question, { topK: 3, minConfidence: 0.4 })
  ]);

  const merchant = merchantRes.data ?? null;

  return {
    surface,
    userLabel: merchant ? `Visiting ${merchant.display_name}'s canteen` : "Visiting a canteen",
    systemFacts: {
      merchant: merchant ? {
        slug:               merchant.slug,
        display_name:       merchant.display_name,
        primary_trade:      merchant.primary_trade,
        city:               merchant.city,
        bio_snippet:        (merchant.bio ?? "").slice(0, 400),
        rating_avg:         merchant.rating_avg,
        rating_count:       merchant.rating_count,
        trust_tier:         merchant.trust_tier,
        insurance_verified: !!merchant.insurance_verified,
        has_whatsapp:       !!merchant.whatsapp
      } : null,
      reviews: (reviewsRes.data ?? []).map((r) => ({
        stars: r.stars, title: r.title, body: (r.body ?? "").slice(0, 200)
      })),
      products: (productsRes.data ?? []).map((p) => ({
        name: p.name, price_gbp: p.price_gbp, blurb: (p.blurb ?? "").slice(0, 100)
      })),
      recent_posts: (postsRes.data ?? []).map((p) => ({
        title: p.title,
        age_days: Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000)
      }))
    },
    knowledge
  };
}

function sum(nums: number[]): number { return nums.reduce((a, b) => a + b, 0); }
