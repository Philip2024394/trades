// Shadow-profile email drip sequence — 6 touches over 21 days.
//
// Sending cadence (delayFromPrevMs is time since PREVIOUS step's send):
//   Step 0 — Day 0  · "Your profile is reserved"
//   Step 1 — Day 3  · "3 leads posted in {city} this week"
//   Step 2 — Day 7  · "Free forever. Every channel."
//   Step 3 — Day 14 · "Your competitor just claimed"
//   Step 4 — Day 21 · "Releasing your slug in 48h"
//   Step 5 — Day 23 · Final call
//
// Tone: plain-text, no HTML chrome, no logos, no marketing chrome.
// Reads like an email you'd write to a mate you're inviting to try
// something. Personal signature. Reply-to routes to the real inbox.
//
// Personalization is done via EmailContext — see personalizer.ts.

import type { EmailTemplate, EmailContext } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------
function signature(ctx: EmailContext): string {
  const phone = ctx.senderPhone ? `\n${ctx.senderPhone}` : "";
  return `— ${ctx.senderName}\nthenetworkers.app${phone}`;
}

function unsubLine(ctx: EmailContext): string {
  return `\n\n---\nDon't want any more emails? ${ctx.unsubscribeUrl}\nWe scrape UK trade businesses from Companies House and reach out once. Reply STOP anytime.`;
}

// -----------------------------------------------------------------
// Step 0 — Day 0 — "Your profile is reserved"
// -----------------------------------------------------------------
const day0Reserved: EmailTemplate = {
  stepIndex: 0,
  slug: "day0-reserved",
  delayFromPrevMs: 0,
  subject: (ctx) => `Reserved ${ctx.reservedUrl.replace(/^https?:\/\//, "")} for you`,
  body: (ctx) => {
    const cityCopy = ctx.merchant.city ? ` in ${ctx.merchant.city}` : "";
    return [
      `Hi ${ctx.greetingName},`,
      ``,
      `Reserved ${ctx.reservedUrl} for you.`,
      ``,
      `Thenetworkers is a free-forever trade profile — your own live URL, installable mobile app, community canteen, plus verified WhatsApp leads from £0.05 each. No card. No contract. No commission on your jobs — ever.`,
      ``,
      `Nobody else${cityCopy} has claimed their ${ctx.tradeLabel} slug yet. Takes about 30 seconds to claim it.`,
      ``,
      `Claim it here: ${ctx.claimUrl}`,
      ``,
      signature(ctx),
      unsubLine(ctx)
    ].join("\n");
  }
};

// -----------------------------------------------------------------
// Step 1 — Day 3 — Beacon leads in their city
// -----------------------------------------------------------------
const day3Leads: EmailTemplate = {
  stepIndex: 1,
  slug: "day3-leads",
  delayFromPrevMs: 3 * DAY_MS,
  subject: (ctx) => {
    if (ctx.recentBeaconCount && ctx.recentBeaconCount > 0) {
      return `${ctx.recentBeaconCount} homeowner${ctx.recentBeaconCount === 1 ? "" : "s"} in ${ctx.cityLabel} posted a job this week`;
    }
    return `Homeowners in ${ctx.cityLabel} are posting jobs`;
  },
  body: (ctx) => {
    const count = ctx.recentBeaconCount ?? 0;
    const opener = count > 0
      ? `${count} homeowner${count === 1 ? "" : "s"} in ${ctx.cityLabel} posted a ${ctx.tradeLabel} job on Thenetworkers this week.`
      : `Homeowners are posting ${ctx.tradeLabel} jobs on Thenetworkers every day.`;
    return [
      `Hi ${ctx.greetingName},`,
      ``,
      opener,
      ``,
      `The way it works: homeowner posts a job, we notify the 3 nearest trades, first to claim gets the WhatsApp connection with the customer's name, postcode, timeline and photos pre-filled.`,
      ``,
      `£0.05-£0.10 per verified lead. Nobody else in the UK does it for that price.`,
      ``,
      `Your reserved profile is still waiting: ${ctx.claimUrl}`,
      ``,
      signature(ctx),
      unsubLine(ctx)
    ].join("\n");
  }
};

// -----------------------------------------------------------------
// Step 2 — Day 7 — Free forever framing
// -----------------------------------------------------------------
const day7FreeForever: EmailTemplate = {
  stepIndex: 2,
  slug: "day7-free-forever",
  delayFromPrevMs: 4 * DAY_MS,
  subject: () => `Free forever. Every channel. No card.`,
  body: (ctx) => [
    `Hi ${ctx.greetingName},`,
    ``,
    `Quick reminder that ${ctx.reservedUrl} is still reserved for you.`,
    ``,
    `The free tier gets you:`,
    `  · Your own live URL + installable mobile app (PWA)`,
    `  · Your business community page (canteen)`,
    `  · Full presence on our 10,800 city × trade Google-indexed pages`,
    `  · Access to the WhatsApp lead pipeline (pay only per verified contact)`,
    `  · Every channel we route work through — no gate`,
    ``,
    `Checkatrade charges £30-£399/month plus £5-£40 per lead. We charge £0 to be present and £0.05-£0.10 per verified WhatsApp lead. That's the whole model.`,
    ``,
    `See how we compare: https://thenetworkers.app/trade-off`,
    `Or just claim your profile: ${ctx.claimUrl}`,
    ``,
    signature(ctx),
    unsubLine(ctx)
  ].join("\n")
};

// -----------------------------------------------------------------
// Step 3 — Day 14 — Social pressure ("your competitor just joined")
// -----------------------------------------------------------------
const day14Competitor: EmailTemplate = {
  stepIndex: 3,
  slug: "day14-competitor",
  delayFromPrevMs: 7 * DAY_MS,
  subject: (ctx) => {
    if (ctx.nearbyClaimedName) {
      return `${ctx.nearbyClaimedName} just claimed their Thenetworkers profile`;
    }
    return `More ${ctx.tradeLabel} businesses in ${ctx.cityLabel} are joining`;
  },
  body: (ctx) => {
    const nearby = ctx.nearbyClaimedName
      ? `${ctx.nearbyClaimedName} just claimed their profile at thenetworkers.app/${ctx.nearbyClaimedSlug}. They're now in the beacon rotation for ${ctx.cityLabel}.`
      : `More ${ctx.tradeLabel} businesses in ${ctx.cityLabel} are claiming their profiles every week and entering the beacon rotation.`;
    return [
      `Hi ${ctx.greetingName},`,
      ``,
      nearby,
      ``,
      `Ranking in the beacon is earned — not bought. It's based on distance, response time, and recent reviews. Not who spent the most. But you have to be IN the pool to be ranked.`,
      ``,
      `Your reserved slug ${ctx.reservedUrl} is still yours. Claim it: ${ctx.claimUrl}`,
      ``,
      signature(ctx),
      unsubLine(ctx)
    ].join("\n");
  }
};

// -----------------------------------------------------------------
// Step 4 — Day 21 — Loss-aversion urgency
// -----------------------------------------------------------------
const day21Releasing: EmailTemplate = {
  stepIndex: 4,
  slug: "day21-releasing",
  delayFromPrevMs: 7 * DAY_MS,
  subject: (ctx) => `Releasing ${ctx.reservedUrl.replace(/^https?:\/\//, "")} in 48 hours`,
  body: (ctx) => [
    `Hi ${ctx.greetingName},`,
    ``,
    `Heads up — your reserved slug ${ctx.reservedUrl} goes back to the general pool in 48 hours.`,
    ``,
    `Once it's released, any other ${ctx.tradeLabel} business can claim it, and you'd have to pick a different one (usually with a suffix like -2 or -manchester).`,
    ``,
    `If you want to keep it, claim it now: ${ctx.claimUrl}`,
    ``,
    `Takes 30 seconds. Free forever. No card.`,
    ``,
    signature(ctx),
    unsubLine(ctx)
  ].join("\n")
};

// -----------------------------------------------------------------
// Step 5 — Day 23 — Final touch
// -----------------------------------------------------------------
const day23Final: EmailTemplate = {
  stepIndex: 5,
  slug: "day23-final",
  delayFromPrevMs: 2 * DAY_MS,
  subject: () => `Last one from me`,
  body: (ctx) => [
    `Hi ${ctx.greetingName},`,
    ``,
    `Won't email you again — promise. If you ever want to grab a Thenetworkers profile, our door's always open: https://thenetworkers.app/trade-off/signup`,
    ``,
    `And if you know a tradesperson who could use a free-forever profile with WhatsApp leads at £0.05 each, feel free to forward this.`,
    ``,
    `Best of luck with your business.`,
    ``,
    signature(ctx),
    unsubLine(ctx)
  ].join("\n")
};

export const TEMPLATES: EmailTemplate[] = [
  day0Reserved,
  day3Leads,
  day7FreeForever,
  day14Competitor,
  day21Releasing,
  day23Final
];

export function templateForStep(stepIndex: number): EmailTemplate | null {
  return TEMPLATES[stepIndex] || null;
}
