// Explainer vocabulary — machine value → merchant-facing phrase.
//
// Small, readable, growable. If a value isn't in the map, the
// explainer skips that facet rather than emitting jargon.

import type { ExplanationBucket } from "./types";

export type PhraseRule = {
  domain: string;
  field: string;
  /** Optional: only fire when the resolved facet value matches. */
  whenValueEquals?: unknown;
  /** Optional key inside the facet object to compare — e.g. "intent"
   *  inside `cta.primary`. Defaults to comparing the object equality. */
  compareKey?: string;
  /** The bucket + sentence to emit. */
  bucket: ExplanationBucket;
  /** Function so we can interpolate values from the facet. */
  sentence: (facet: Record<string, unknown>) => string;
};

const CTA_INTENT_LABEL: Record<string, string> = {
  "book-consultation": "Book Consultation",
  "book-appointment": "Book Appointment",
  "book-survey": "Book Survey",
  "free-survey": "Book Free Survey",
  "request-quote": "Request Quote",
  "call-now": "Call Now",
  "whatsapp": "Message on WhatsApp",
  "open-trade-account": "Open Trade Account"
};

const PRICING_DISPLAY_LABEL: Record<string, string> = {
  hidden: "hide pricing on public pages",
  guide: "show guide pricing only",
  package: "show packages instead of hourly rates",
  exact: "publish exact prices"
};

const HERO_STYLE_LABEL: Record<string, string> = {
  "trust-anchor": "put insurance, guarantees, and reviews in the hero band",
  "editorial-photo": "use a large editorial photo as the hero",
  "emergency-247": "use a 24/7 emergency hero with response-time promise"
};

const BOOKING_KIND_LABEL: Record<string, string> = {
  simple: "a simple pick-service-then-date booking flow",
  emergency: "an emergency triage flow (Call Now / Book Emergency Visit)",
  consultation: "a design consultation flow with showroom + budget + style",
  "quote-only": "a single-page quote request (no calendar)"
};

const DEPOSIT_LABEL: Record<string, string> = {
  required: "collect a deposit before booking is confirmed",
  optional: "offer an optional deposit to secure design time",
  none: "not collect any deposit online"
};

export const PHRASE_RULES: readonly PhraseRule[] = [
  // ─── CTA / Booking ───────────────────────────────────────────
  {
    domain: "cta",
    field: "primary",
    bucket: "Website",
    sentence: (f) => {
      const intent = f.intent as string | undefined;
      const label =
        intent && CTA_INTENT_LABEL[intent]
          ? CTA_INTENT_LABEL[intent]
          : (intent ?? "Get in touch");
      return `use "${label}" as your main call-to-action across every page`;
    }
  },
  {
    domain: "booking",
    field: "flowKind",
    bucket: "Booking",
    sentence: (f) => {
      const value = f.value as string | undefined;
      const desc = value && BOOKING_KIND_LABEL[value] ? BOOKING_KIND_LABEL[value] : value;
      return `use ${desc} for customer bookings`;
    }
  },
  {
    domain: "booking",
    field: "depositPolicy",
    bucket: "Booking",
    sentence: (f) => {
      const value = f.value as string | undefined;
      return value && DEPOSIT_LABEL[value] ? DEPOSIT_LABEL[value] : `set deposit policy to ${value}`;
    }
  },
  {
    domain: "booking",
    field: "gate",
    whenValueEquals: "emergency",
    compareKey: "value",
    bucket: "Booking",
    sentence: () =>
      "gate the booking flow with an emergency question so urgent customers reach you in one tap"
  },

  // ─── Pricing ────────────────────────────────────────────────
  {
    domain: "pricing",
    field: "display",
    bucket: "Website",
    sentence: (f) => {
      const value = f.value as string | undefined;
      return value && PRICING_DISPLAY_LABEL[value]
        ? PRICING_DISPLAY_LABEL[value]
        : `set pricing display to ${value}`;
    }
  },

  // ─── Hero ───────────────────────────────────────────────────
  {
    domain: "hero",
    field: "style",
    bucket: "Website",
    sentence: (f) => {
      const value = f.value as string | undefined;
      return value && HERO_STYLE_LABEL[value]
        ? HERO_STYLE_LABEL[value]
        : `use a ${value} hero style`;
    }
  },

  // ─── Gallery ────────────────────────────────────────────────
  {
    domain: "gallery",
    field: "style",
    bucket: "Content",
    sentence: (f) => {
      const value = f.value as string | undefined;
      if (value === "before-after") return "show before/after project photos first";
      if (value === "before-after-slider") return "use a before/after image slider on the portfolio page";
      return `use ${value} gallery style`;
    }
  },
  {
    domain: "gallery",
    field: "requiresBeforeAfter",
    whenValueEquals: true,
    compareKey: "value",
    bucket: "Content",
    sentence: () => "require before/after photos on every case study — no stock imagery"
  },

  // ─── Trust ──────────────────────────────────────────────────
  {
    domain: "trust",
    field: "elements",
    bucket: "Trust",
    sentence: (f) => {
      const list = (f.list as readonly string[]) ?? [];
      return `foreground ${list.slice(0, 3).join(", ")} as your primary trust signals`;
    }
  },

  // ─── SEO ────────────────────────────────────────────────────
  {
    domain: "seo",
    field: "pageKinds",
    bucket: "SEO",
    sentence: (f) => {
      const kinds = (f.kinds as readonly string[]) ?? [];
      return `build ${kinds.join(", ")} pages for local search coverage`;
    }
  },
  {
    domain: "seo",
    field: "locationStrategy",
    bucket: "SEO",
    sentence: (f) => {
      const strategy = f.strategy as string | undefined;
      return strategy
        ? `follow a ${strategy.replace(/-/g, " ")} location strategy for SEO`
        : "target local search with location-specific pages";
    }
  },

  // ─── Sections ───────────────────────────────────────────────
  {
    domain: "sections",
    field: "emphasise",
    bucket: "Website",
    sentence: (f) => {
      const roles = (f.roles as readonly string[]) ?? [];
      return `emphasise ${roles
        .slice(0, 4)
        .map((r) => r.replace(/-/g, " "))
        .join(", ")}`;
    }
  },

  // ─── Dashboard ──────────────────────────────────────────────
  {
    domain: "dashboard",
    field: "primaryMetrics",
    bucket: "Dashboard",
    sentence: (f) => {
      const list = (f.list as readonly string[]) ?? [];
      return `show ${list
        .slice(0, 4)
        .map((m) => m.replace(/_/g, " "))
        .join(", ")} on your dashboard`;
    }
  },
  {
    domain: "dashboard",
    field: "suggestedActions",
    bucket: "Dashboard",
    sentence: (f) => {
      const list = (f.list as readonly string[]) ?? [];
      return `suggest actions like "${list[0]?.replace(/-/g, " ") ?? "grow your business"}" in your daily brief`;
    }
  },

  // ─── Marketing ──────────────────────────────────────────────
  {
    domain: "marketing",
    field: "upsellMoments",
    bucket: "Marketing",
    sentence: (f) => {
      const list = (f.list as readonly string[]) ?? [];
      return `nudge upsells ${list.map((m) => m.replace(/-/g, " ")).join(" / ")}`;
    }
  }
];

const TRADE_LABEL: Record<string, string> = {
  carpenter: "Carpentry",
  "kitchen-fitter": "Kitchen Fitting",
  plumber: "Plumbing",
  electrician: "Electrical Work",
  roofer: "Roofing",
  painter: "Painting & Decorating",
  builder: "Building",
  landscaper: "Landscaping",
  tiler: "Tiling",
  "bathroom-fitter": "Bathroom Fitting"
};

const GOAL_LABEL: Record<string, string> = {
  "lead-generation": "Generate more leads",
  "increase-conversion-rate": "Convert more of the leads you already get",
  "increase-average-job-value": "Increase your average job value",
  bookings: "Fill your calendar",
  quotes: "Get more quote requests",
  "trust-building": "Build online trust",
  "increase-reviews": "Collect more customer reviews"
};

export function labelForTrade(slug: string): string {
  if (TRADE_LABEL[slug]) return TRADE_LABEL[slug];
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function labelForGoal(slug: string): string {
  return GOAL_LABEL[slug] ?? slug.replace(/-/g, " ");
}
