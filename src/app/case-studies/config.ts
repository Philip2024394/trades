// /case-studies — Real UK trade project write-ups.
//
// Phase 3 EEAT surface. Every published case study features a real
// project, real trade, real homeowner, real photos, and the real
// final invoice. No fabricated content — per the evidence-or-silence
// constitutional rule.
//
// The hub ships empty until we have our first published submission.
// The submission form (/case-studies/submit) captures trade + project
// details from any Networkers member; the editorial team reviews +
// publishes.
//
// Growth loop:
//   1. Trades submit — free PR + backlink to their /trades/[slug]
//      profile
//   2. Editorial reviews for evidence-first fit
//   3. Published case study cross-links to /trades/[trade]/[city],
//      /cost/[project], and any relevant /grants
//   4. New homeowner searches ("kitchen extension example uk") land
//      on the case study + convert to hiring the featured trade

export type CaseStudyStatus = "published" | "draft" | "under-review";

export type CaseStudyMedia = {
  imageUrl: string;
  caption:  string;
  /** "before" | "during" | "after" — used to group in gallery. */
  phase:    "before" | "during" | "after" | "detail";
};

export type CaseStudy = {
  slug:            string;
  title:           string;
  /** One-line summary for cards + meta description. */
  standfirst:      string;
  status:          CaseStudyStatus;
  /** Trade slug — cross-links to /trades/[trade]/[city]. */
  tradeSlug:       string;
  /** City slug from CITY_CONTENT — cross-links regionally. */
  citySlug:        string;
  /** Optional link to the trade's profile — every published case
   *  study must feature a verified Networkers member. */
  tradeProfileSlug: string;
  /** Homeowner attribution — first name only or "Anonymous". Every
   *  published case study needs written consent from the homeowner. */
  homeownerCredit: string;
  /** Project slug — matches /cost/[project] when applicable. */
  projectSlug?:    string;
  /** Timeline as week-by-week summary (2-8 weeks typical). */
  timeline:        Array<{ week: string; summary: string }>;
  /** Final invoice total (£) + brief cost split narrative. */
  finalCost:       {
    total:      number;
    breakdown:  Array<{ label: string; amount: number }>;
    variances:  string;
  };
  /** Hero + gallery. First entry is the cover; rest are grouped. */
  media:           CaseStudyMedia[];
  /** What went well — 3-5 bullets from the trade + homeowner. */
  wentWell:        string[];
  /** What went wrong or would be done differently — honest. */
  wentWrong:       string[];
  /** Related grants (from /grants config slugs). */
  relatedGrants:   string[];
  publishedAt:     string;
  lastReviewedAt:  string;
};

// Zero published case studies until real submissions land + are
// reviewed. Empty array intentional — the hub renders a strong
// empty-state + submission CTA rather than fake content.
export const CASE_STUDIES: CaseStudy[] = [];

// Editorial standards for accepting a submission.
export const SUBMISSION_CHECKLIST = [
  "Verified Networkers member — case study features your own trade work only",
  "Homeowner has given written consent to publish (name or first name only)",
  "Real invoice total shared for the cost breakdown section (we don't publish the invoice image)",
  "At least 3 project photos supplied (before + during + after preferred)",
  "Project completed within the last 24 months",
  "You're willing to be featured with your trade profile linked",
  "You'll respond to reader questions in the comments (moderated)"
];

export const HUB_FAQS = [
  {
    q: "Why doesn't The Networkers have any case studies yet?",
    a: "We're waiting for our first real published submission. We refuse to fabricate case studies — every project on this page will feature a real Networkers trade, a real homeowner, real photos, and a real invoice. Submissions are open."
  },
  {
    q: "How can my trade be featured in a case study?",
    a: "Submit at /case-studies/submit. If your project meets our editorial checklist (verified member, homeowner consent, real photos + costs), we'll work with you to publish a full write-up. Free PR + a permanent backlink to your Networkers trade profile."
  },
  {
    q: "How do you protect homeowners featured in case studies?",
    a: "Written consent is required. We publish first name only (or 'Anonymous'), never full address, never phone number. Homeowners can request removal at any time and we take the page down within 24 hours."
  },
  {
    q: "How much does it cost to be featured?",
    a: "Nothing. Case studies are free editorial content — no featured-listing fee, no sponsorship, no paid placement. Editorial standards apply equally to every trade regardless of subscription tier."
  }
];
