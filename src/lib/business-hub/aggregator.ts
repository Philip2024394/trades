// Business Hub snapshot — one query bundle that answers:
//   • What's on fire? (overdue, expired, needs response)
//   • What earns me money today? (active jobs, sent quotes, hot leads)
//   • What should I do next? (follow-ups due, ready-to-quote renders)
//
// Read-only. Runs on every Hub page load. Structured so a future
// cache layer can key it by merchant_id + 60s TTL without changes here.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type RunwayCounters = {
  unquotedLeads: number;         // Renders with a spec but no draft yet
  draftQuotes: number;
  sentQuotesAwaitingResponse: number;
  quotesViewedNotAccepted: number;
  quotesExpiringSoon: number;    // in the next 3 days
  activeJobs: number;
  jobsSignedOffThisWeek: number;
  followUpsDueToday: number;
  followUpsOverdue: number;
  silentContacts: number;
  reviewsNoResponse: number;
  newVerifiedReviewsThisMonth: number;
  // Products (App #006)
  activeOffers: number;
  offersOutOfStock: number;
  offersLowStock: number;
  offersMissingImages: number;
  canonicalsPublished: number;    // for manufacturers
};

export type MoneyLine = {
  bookedThisMonthPence: number;
  bookedLastMonthPence: number;
  pipelineOpenPence: number;
  pipelineAcceptedPence: number;
  quotesSentThisWeek: number;
  quotesAcceptedThisWeek: number;
};

export type ActivePipelineItem = {
  kind: "render" | "quote" | "job" | "task";
  id: string;
  headline: string;
  meta: string | null;
  urgency: "hot" | "warm" | "cool";
  href: string;
};

export type BusinessHubSnapshot = {
  counters: RunwayCounters;
  money: MoneyLine;
  activePipeline: ActivePipelineItem[];
  overallResponseHours: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function loadBusinessHubSnapshot(
  merchantId: string
): Promise<BusinessHubSnapshot> {
  const now = new Date();
  const nowIso = now.toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfLastMonth = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1
  ).toISOString();
  const endOfLastMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).toISOString();
  const startOfWeek = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59
  ).toISOString();
  const in3DaysIso = new Date(now.getTime() + 3 * DAY_MS).toISOString();
  const silenceThresholdIso = new Date(
    now.getTime() - 30 * DAY_MS
  ).toISOString();

  const [
    unquoted,
    drafts,
    sent,
    viewed,
    expiringSoon,
    accepted,
    activeJobs,
    signedThisWeek,
    dueTodayTasks,
    overdueTasks,
    silentContacts,
    unrespondedReviews,
    newVerifiedThisMonth,
    bookedThisMonth,
    bookedLastMonth,
    openPipelineQuotes,
    acceptedPipelineQuotes,
    quotesSentThisWeek,
    quotesAcceptedThisWeek,
    responseSample,
    activeOffers,
    offersOutOfStock,
    offersLowStock,
    offersMissingImages,
    canonicalsPublished
  ] = await Promise.all([
    // Renders with a specification that don't yet have a quote for this merchant
    supabaseAdmin
      .from("app_ai_visualiser_renders")
      .select("id, specification_id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("status", "complete")
      .not("specification_id", "is", null),
    countByStatus(merchantId, "draft"),
    countByStatus(merchantId, "sent"),
    countByStatus(merchantId, "viewed"),
    supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .in("status", ["sent", "viewed"])
      .lt("expires_at", in3DaysIso)
      .gt("expires_at", nowIso),
    countByStatus(merchantId, "accepted"),
    supabaseAdmin
      .from("app_job_diary_jobs")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .in("status", ["open", "in_progress", "snagging"]),
    supabaseAdmin
      .from("app_job_diary_jobs")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("status", "signed_off")
      .gte("actual_end_date", startOfWeek.slice(0, 10)),
    supabaseAdmin
      .from("app_crm_tasks")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("status", "open")
      .gte("due_at", nowIso)
      .lte("due_at", endOfDay),
    supabaseAdmin
      .from("app_crm_tasks")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("status", "open")
      .lt("due_at", nowIso),
    supabaseAdmin
      .from("app_crm_contacts")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .in("lifecycle_stage", ["engaged", "quoted"])
      .lt("last_activity_at", silenceThresholdIso),
    supabaseAdmin
      .from("app_reviews_reviews")
      .select(
        "id, app_reviews_responses!left(review_id)",
        { count: "exact", head: true }
      )
      .eq("merchant_id", merchantId)
      .eq("visibility", "public")
      .is("app_reviews_responses.review_id", null),
    supabaseAdmin
      .from("app_reviews_reviews")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("visibility", "public")
      .eq("verified", true)
      .gte("created_at", startOfMonth),
    supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("total_pence")
      .eq("merchant_id", merchantId)
      .eq("status", "accepted")
      .gte("accepted_at", startOfMonth),
    supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("total_pence")
      .eq("merchant_id", merchantId)
      .eq("status", "accepted")
      .gte("accepted_at", startOfLastMonth)
      .lt("accepted_at", endOfLastMonth),
    supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("total_pence")
      .eq("merchant_id", merchantId)
      .in("status", ["sent", "viewed"]),
    supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("total_pence")
      .eq("merchant_id", merchantId)
      .eq("status", "accepted"),
    supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .gte("sent_at", startOfWeek),
    supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("status", "accepted")
      .gte("accepted_at", startOfWeek),
    // Rough response-velocity estimator — quotes sent whose first render
    // request happened X hours before. Simplification for v1.
    supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("created_at, sent_at")
      .eq("merchant_id", merchantId)
      .not("sent_at", "is", null)
      .gte("sent_at", new Date(now.getTime() - 30 * DAY_MS).toISOString())
      .limit(50),
    // ── Products (App #006) ───────────────────────────────────
    supabaseAdmin
      .from("app_products_merchant_offers")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("is_active", true),
    supabaseAdmin
      .from("app_products_merchant_offers")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("is_active", true)
      .eq("stock_status", "out"),
    supabaseAdmin
      .from("app_products_merchant_offers")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("is_active", true)
      .eq("stock_status", "low"),
    supabaseAdmin
      .from("app_products_merchant_offers")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("is_active", true)
      .eq("local_image_urls", "{}"),
    // Manufacturers — count of active canonicals they've published
    supabaseAdmin
      .from("os_products_canonical")
      .select("id", { count: "exact", head: true })
      .eq("publisher_business_id", merchantId)
      .eq("lifecycle_status", "active")
  ]);

  const money: MoneyLine = {
    bookedThisMonthPence: sum(
      bookedThisMonth.data as { total_pence: number }[] | null
    ),
    bookedLastMonthPence: sum(
      bookedLastMonth.data as { total_pence: number }[] | null
    ),
    pipelineOpenPence: sum(
      openPipelineQuotes.data as { total_pence: number }[] | null
    ),
    pipelineAcceptedPence: sum(
      acceptedPipelineQuotes.data as { total_pence: number }[] | null
    ),
    quotesSentThisWeek: quotesSentThisWeek.count ?? 0,
    quotesAcceptedThisWeek: quotesAcceptedThisWeek.count ?? 0
  };

  const overallResponseHours = estimateResponseHours(
    responseSample.data as Array<{ created_at: string; sent_at: string }> | null
  );

  const activePipeline = await loadPipelineSlice(merchantId);

  return {
    counters: {
      unquotedLeads: unquoted.count ?? 0,
      draftQuotes: drafts,
      sentQuotesAwaitingResponse: sent,
      quotesViewedNotAccepted: viewed,
      quotesExpiringSoon: expiringSoon.count ?? 0,
      activeJobs: activeJobs.count ?? 0,
      jobsSignedOffThisWeek: signedThisWeek.count ?? 0,
      followUpsDueToday: dueTodayTasks.count ?? 0,
      followUpsOverdue: overdueTasks.count ?? 0,
      silentContacts: silentContacts.count ?? 0,
      reviewsNoResponse: unrespondedReviews.count ?? 0,
      newVerifiedReviewsThisMonth: newVerifiedThisMonth.count ?? 0,
      activeOffers: activeOffers.count ?? 0,
      offersOutOfStock: offersOutOfStock.count ?? 0,
      offersLowStock: offersLowStock.count ?? 0,
      offersMissingImages: offersMissingImages.count ?? 0,
      canonicalsPublished: canonicalsPublished.count ?? 0
    },
    money,
    activePipeline,
    overallResponseHours
  };
}

async function countByStatus(merchantId: string, status: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("status", status);
  return count ?? 0;
}

function sum(rows: Array<{ total_pence: number }> | null): number {
  return (rows || []).reduce((acc, r) => acc + (r.total_pence || 0), 0);
}

function estimateResponseHours(
  rows: Array<{ created_at: string; sent_at: string }> | null
): number | null {
  if (!rows || rows.length === 0) return null;
  const totalMs = rows.reduce((acc, r) => {
    const diff = new Date(r.sent_at).getTime() - new Date(r.created_at).getTime();
    return acc + Math.max(0, diff);
  }, 0);
  const avgMs = totalMs / rows.length;
  return Math.round((avgMs / (60 * 60 * 1000)) * 10) / 10;
}

async function loadPipelineSlice(
  merchantId: string
): Promise<ActivePipelineItem[]> {
  const now = Date.now();
  const [renders, quotes, jobs, tasks] = await Promise.all([
    supabaseAdmin
      .from("app_ai_visualiser_renders")
      .select(
        "id, leaf_slug, created_at, render_url, app_ai_visualiser_homeowners!inner(full_name, postcode)"
      )
      .eq("merchant_id", merchantId)
      .eq("status", "complete")
      .not("specification_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select(
        "id, title, status, total_pence, sent_at, expires_at, homeowner_id, app_ai_visualiser_homeowners(full_name, postcode)"
      )
      .eq("merchant_id", merchantId)
      .in("status", ["sent", "viewed"])
      .order("sent_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("app_job_diary_jobs")
      .select(
        "id, title, status, progress_percent, updated_at, homeowner_id, app_ai_visualiser_homeowners(full_name, postcode)"
      )
      .eq("merchant_id", merchantId)
      .in("status", ["in_progress", "snagging"])
      .order("updated_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("app_crm_tasks")
      .select(
        "id, title, due_at, contact_id, app_crm_contacts!inner(display_name)"
      )
      .eq("merchant_id", merchantId)
      .eq("status", "open")
      .lte("due_at", new Date(now + DAY_MS).toISOString())
      .order("due_at", { ascending: true })
      .limit(5)
  ]);

  const items: ActivePipelineItem[] = [];

  (renders.data || []).forEach((r) => {
    const homeJoin = (
      r as unknown as {
        app_ai_visualiser_homeowners?:
          | { full_name: string; postcode: string }
          | { full_name: string; postcode: string }[];
      }
    ).app_ai_visualiser_homeowners;
    const home = Array.isArray(homeJoin) ? homeJoin[0] : homeJoin;
    const hoursOld = (now - new Date(r.created_at).getTime()) / (60 * 60 * 1000);
    items.push({
      kind: "render",
      id: r.id as string,
      headline: `Draft quote for ${home?.full_name || "homeowner"}`,
      meta: `${r.leaf_slug.replace(/_/g, " ")} · ${home?.postcode || ""} · ${hoursOld < 1 ? "just now" : `${Math.round(hoursOld)}h ago`}`,
      urgency: hoursOld < 2 ? "hot" : hoursOld < 24 ? "warm" : "cool",
      href: `/site-office/apps/quote-workspace`
    });
  });

  (quotes.data || []).forEach((q) => {
    const homeJoin = (
      q as unknown as {
        app_ai_visualiser_homeowners?:
          | { full_name: string; postcode: string }
          | { full_name: string; postcode: string }[];
      }
    ).app_ai_visualiser_homeowners;
    const home = Array.isArray(homeJoin) ? homeJoin[0] : homeJoin;
    const expiresAt = q.expires_at ? new Date(q.expires_at).getTime() : null;
    const expiringSoon =
      expiresAt !== null && expiresAt - now < 3 * DAY_MS && expiresAt > now;
    items.push({
      kind: "quote",
      id: q.id as string,
      headline: `${q.status === "viewed" ? "Viewed" : "Sent"} · ${q.title}`,
      meta: `${home?.full_name || "customer"} · £${(q.total_pence / 100).toFixed(0)}${expiringSoon ? " · expires soon" : ""}`,
      urgency: expiringSoon
        ? "hot"
        : q.status === "viewed"
          ? "warm"
          : "cool",
      href: `/site-office/apps/quote-workspace/${q.id}`
    });
  });

  (jobs.data || []).forEach((j) => {
    const homeJoin = (
      j as unknown as {
        app_ai_visualiser_homeowners?:
          | { full_name: string; postcode: string }
          | { full_name: string; postcode: string }[];
      }
    ).app_ai_visualiser_homeowners;
    const home = Array.isArray(homeJoin) ? homeJoin[0] : homeJoin;
    items.push({
      kind: "job",
      id: j.id as string,
      headline: j.title as string,
      meta: `${home?.full_name || "customer"} · ${j.progress_percent}% · ${(j.status as string).replace(/_/g, " ")}`,
      urgency: (j.status as string) === "snagging" ? "warm" : "cool",
      href: `/site-office/apps/job-diary/${j.id}`
    });
  });

  (tasks.data || []).forEach((t) => {
    const contactJoin = (
      t as unknown as {
        app_crm_contacts?: { display_name: string } | { display_name: string }[];
      }
    ).app_crm_contacts;
    const contact = Array.isArray(contactJoin) ? contactJoin[0] : contactJoin;
    const dueAtMs = new Date(t.due_at).getTime();
    const overdue = dueAtMs < now;
    items.push({
      kind: "task",
      id: t.id as string,
      headline: t.title as string,
      meta: `${contact?.display_name || "contact"} · ${overdue ? "overdue" : "due today"}`,
      urgency: overdue ? "hot" : "warm",
      href: `/site-office/apps/crm/${t.contact_id}`
    });
  });

  // Sort: hot first, then warm, then cool
  const rank = { hot: 0, warm: 1, cool: 2 };
  items.sort((a, b) => rank[a.urgency] - rank[b.urgency]);
  return items.slice(0, 10);
}
