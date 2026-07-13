// The Notebook — private merchant activity journal.
//
// Every business-relevant event about a merchant lands here: WhatsApp
// handoffs, review submissions, canteen mentions, product enquiries,
// boost campaigns, profile-view milestones, Yard mentions. Only the
// merchant (and admins) see this. Kills the "did anything happen
// today?" anxiety by giving one canonical feed of business activity.
//
// Rebrand path from `project_thenetwork_domain_option.md`: the earlier
// "Trade Notebook / Construction Notebook" master-brand concept is
// retired; "Notebook" now refers to this feature — a dashboard room
// inside every merchant's business app, not a competing product.
//
// Data flow (design layer only until DB lands):
//   - hammerex_trade_off_yard_posts    → yard-mention
//   - hammerex_network_reviews          → review-* events
//   - canteen_posts (planned)          → canteen-mention
//   - product_interactions (planned)   → product-enquiry
//   - profile_view_events (planned)    → profile-view-milestone
//   - product.boost activity           → boost-*
//   - WhatsApp click-tracking (planned) → lead-whatsapp
//
// Every notebook event is derived. Nothing is duplicated to a
// notebook_events table; the notebook page runs a fanning query
// across the existing event tables. This keeps the schema honest and
// prevents drift between the notebook and the underlying records.

export type NotebookEventKind =
  | "lead-whatsapp"
  | "lead-call"
  | "review-landed"
  | "review-published"
  | "review-needs-response"
  | "canteen-mention"
  | "canteen-recommended"
  | "product-enquiry"
  | "boost-started"
  | "boost-active"
  | "boost-ended"
  | "profile-view-milestone"
  | "yard-mention";

/** UI treatment for each kind — icon + accent color are declared here
 *  so the card component stays presentational-only. */
export type NotebookEventTone = "lead" | "review" | "canteen" | "product" | "boost" | "milestone" | "action-required";

export type NotebookEvent = {
  id: string;
  merchantSlug: string;
  kind: NotebookEventKind;
  tone: NotebookEventTone;
  /** ISO timestamp when the event occurred. */
  when: string;
  /** One-line summary of what happened. */
  title: string;
  /** Optional 1-2 sentence context. */
  body?: string;
  /** Small meta line — reviewer name, canteen name, product name, etc. */
  meta?: string;
  /** Optional CTA the merchant can act on. */
  action?: {
    label: string;
    href: string;
  };
  /** When true, this event lives in the "actions needed" strip at the
   *  top of the notebook instead of the chronological feed. Used for
   *  time-sensitive items (reviews in the 72h window, boost expiring
   *  soon, unresponded canteen questions, etc.). */
  actionRequired?: boolean;
  /** For time-sensitive events — when the window closes. */
  deadlineAt?: string;
};

/** Filter buckets shown as chips on the notebook page header. */
export type NotebookFilter =
  | "all"
  | "actions-needed"
  | "leads"
  | "reviews"
  | "canteen"
  | "products"
  | "boost";

export function filterNotebook(events: NotebookEvent[], filter: NotebookFilter): NotebookEvent[] {
  switch (filter) {
    case "actions-needed":
      return events.filter((e) => e.actionRequired);
    case "leads":
      return events.filter((e) => e.tone === "lead");
    case "reviews":
      return events.filter((e) => e.tone === "review" || e.tone === "action-required" && (e.kind === "review-needs-response"));
    case "canteen":
      return events.filter((e) => e.tone === "canteen");
    case "products":
      return events.filter((e) => e.tone === "product");
    case "boost":
      return events.filter((e) => e.tone === "boost");
    case "all":
    default:
      return events;
  }
}

/** Chronological — most recent first. */
export function sortNotebook(events: NotebookEvent[]): NotebookEvent[] {
  return [...events].sort((a, b) => Date.parse(b.when) - Date.parse(a.when));
}

// ─── Week-summary stats ─────────────────────────────────

export type NotebookWeekStats = {
  leads: number;
  reviews: number;
  canteenMentions: number;
  productEnquiries: number;
  activeBoosts: number;
  actionsNeeded: number;
};

export function weekStats(events: NotebookEvent[], now = Date.now()): NotebookWeekStats {
  const cutoff = now - 7 * 24 * 60 * 60 * 1000;
  const recent = events.filter((e) => Date.parse(e.when) >= cutoff);
  return {
    leads: recent.filter((e) => e.tone === "lead").length,
    reviews: recent.filter((e) => e.kind === "review-landed" || e.kind === "review-published").length,
    canteenMentions: recent.filter((e) => e.tone === "canteen").length,
    productEnquiries: recent.filter((e) => e.tone === "product").length,
    activeBoosts: events.filter((e) => e.kind === "boost-active").length,
    actionsNeeded: events.filter((e) => e.actionRequired).length
  };
}

// ─── Mock seed data ─────────────────────────────────────

const MERCHANT = "demo-mike-watson-drywall-manchester";
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
const hoursAgo = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000).toISOString();
const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

export const MOCK_NOTEBOOK_EVENTS: NotebookEvent[] = [
  // Actions needed — surface at the top with the yellow strip.
  {
    id: "nb_1",
    merchantSlug: MERCHANT,
    kind: "review-needs-response",
    tone: "action-required",
    when: hoursAgo(6),
    deadlineAt: daysFromNow(2),
    title: "Sarah Whitmore left a 3.4★ review",
    body: "72-hour response window is running. Reply privately, respond publicly, or dispute with evidence before it publishes.",
    meta: "Kitchen Fitter · Chester",
    action: { label: "Respond in 72h window", href: `/trade/${MERCHANT}/reviews/pending` },
    actionRequired: true
  },
  {
    id: "nb_2",
    merchantSlug: MERCHANT,
    kind: "boost-active",
    tone: "boost",
    when: daysAgo(3),
    deadlineAt: daysFromNow(4),
    title: "30-day boost active on Solid oak worktop",
    body: "Sponsored across every canteen. 4 days remaining. 47 impressions so far, 6 taps to product view.",
    meta: "£45 · Kitchen Fitters trade-targeted",
    action: { label: "See boost performance", href: `/trade-off/yard/canteens/uk-kitchen-fitters/manage` },
    actionRequired: false
  },

  // Recent activity — descending chronological.
  {
    id: "nb_3",
    merchantSlug: MERCHANT,
    kind: "lead-whatsapp",
    tone: "lead",
    when: hoursAgo(2),
    title: "Rachel Simms tapped WhatsApp on your profile",
    meta: "Kitchen Fitter · Manchester · via canteen post",
    action: { label: "Open WhatsApp thread", href: `https://wa.me/447700900000` }
  },
  {
    id: "nb_4",
    merchantSlug: MERCHANT,
    kind: "canteen-mention",
    tone: "canteen",
    when: hoursAgo(4),
    title: "Craig McDermott recommended you in UK Kitchen Fitters",
    body: '"Anyone got a solid oak worktop supplier near Manchester? — Mike Watson, spot on prices and delivery"',
    meta: "3 replies · 12 reactions",
    action: { label: "See the post", href: `/trade-off/yard/canteens/uk-kitchen-fitters` }
  },
  {
    id: "nb_5",
    merchantSlug: MERCHANT,
    kind: "review-landed",
    tone: "review",
    when: hoursAgo(8),
    title: "New 5★ review from Rachel Simms",
    body: '"Turned up on time, worktops arrived perfect, invoice matched the quote. That\'s the whole game."',
    meta: "Verified job · 6 days ago",
    action: { label: "See review", href: `/trade/${MERCHANT}/reviews` }
  },
  {
    id: "nb_6",
    merchantSlug: MERCHANT,
    kind: "product-enquiry",
    tone: "product",
    when: hoursAgo(14),
    title: "3 new product views on Shaker door pack of 6",
    meta: "Via Trade Center browse · Manchester + Sale postcode areas"
  },
  {
    id: "nb_7",
    merchantSlug: MERCHANT,
    kind: "lead-whatsapp",
    tone: "lead",
    when: hoursAgo(20),
    title: "Tom Fisher tapped WhatsApp on Handleless slab door",
    meta: "Joiner · Sheffield · product-focus view",
    action: { label: "Open WhatsApp thread", href: `https://wa.me/447700900000` }
  },
  {
    id: "nb_8",
    merchantSlug: MERCHANT,
    kind: "profile-view-milestone",
    tone: "milestone",
    when: daysAgo(1),
    title: "You hit 500 profile views this month",
    body: "Up 34% on last month. Kitchen Fitters is your top-referring canteen."
  },
  {
    id: "nb_9",
    merchantSlug: MERCHANT,
    kind: "canteen-mention",
    tone: "canteen",
    when: daysAgo(1),
    title: "Jamie Blake tagged you in a Property Developer post",
    body: '"@Mike Watson, do you do staged deliveries for 20-unit refurbs?"',
    meta: "Property Developer · Bristol",
    action: { label: "Reply in canteen", href: `/trade-off/yard/canteens/uk-kitchen-fitters` }
  },
  {
    id: "nb_10",
    merchantSlug: MERCHANT,
    kind: "lead-whatsapp",
    tone: "lead",
    when: daysAgo(1),
    title: "Dean Whitaker tapped WhatsApp on your profile",
    meta: "Bathroom Fitter · Leeds",
    action: { label: "Open WhatsApp thread", href: `https://wa.me/447700900000` }
  },
  {
    id: "nb_11",
    merchantSlug: MERCHANT,
    kind: "yard-mention",
    tone: "canteen",
    when: daysAgo(2),
    title: "Your Trade Center listing was quoted in a Yard post",
    body: '"Just got the 3m oak worktop from Mike Watson. Cracking value at £128."',
    meta: "Trade Chat · 8 reactions"
  },
  {
    id: "nb_12",
    merchantSlug: MERCHANT,
    kind: "review-landed",
    tone: "review",
    when: daysAgo(3),
    title: "New 5★ review from Tom Fisher",
    body: '"Mike sorted a bulk-buy on shaker doors for 4 flats. Saved £600 across the run, quality was spot on."',
    meta: "Verified job · 2 weeks ago",
    action: { label: "See review", href: `/trade/${MERCHANT}/reviews` }
  },
  {
    id: "nb_13",
    merchantSlug: MERCHANT,
    kind: "boost-started",
    tone: "boost",
    when: daysAgo(3),
    title: "30-day boost activated on Solid oak worktop",
    meta: "£45 · Kitchen Fitters trade-targeted"
  },
  {
    id: "nb_14",
    merchantSlug: MERCHANT,
    kind: "product-enquiry",
    tone: "product",
    when: daysAgo(4),
    title: "12 product views this week on Handleless slab door",
    meta: "Top-viewed product · £96"
  },
  {
    id: "nb_15",
    merchantSlug: MERCHANT,
    kind: "canteen-mention",
    tone: "canteen",
    when: daysAgo(5),
    title: "Priya Menon replied to your bulk-buy post",
    body: '"I\'m in for 6 packs — timing works for the Islington job."',
    meta: "Site Manager · London",
    action: { label: "Reply in canteen", href: `/trade-off/yard/canteens/uk-kitchen-fitters` }
  },
  {
    id: "nb_16",
    merchantSlug: MERCHANT,
    kind: "lead-call",
    tone: "lead",
    when: daysAgo(6),
    title: "Alex Hughes tapped Call on your profile",
    meta: "Kitchen Fitter · Salford"
  },
  {
    id: "nb_17",
    merchantSlug: MERCHANT,
    kind: "review-published",
    tone: "review",
    when: daysAgo(7),
    title: "Craig McDermott's review published",
    body: "Overall 4.6★. Communication scored 4/5 — worth a look at your reply times.",
    meta: "Electrician · Leeds"
  }
];

export function eventsForMerchant(merchantSlug: string): NotebookEvent[] {
  return MOCK_NOTEBOOK_EVENTS.filter((e) => e.merchantSlug === merchantSlug);
}
