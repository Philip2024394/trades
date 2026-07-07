// Feed post composer — turns a business event into a
// ready-to-publish feed post. Deterministic (no AI here) for MVP;
// later phases can swap in an LLM composer without changing the
// projection layer's interface.
//
// The compose logic is intentionally boring: it just uses the event's
// structured payload + AI understanding facets to fill a template.
// Boring = predictable = trustable. Merchants can edit the drafted
// text before it publishes if they want.

import type { BusinessEvent } from "@/lib/events/types";
import type { FeedCtaKind } from "./types";

export type ComposedFeedPost = {
  slug: string;
  headline: string;
  bodyMarkdown: string;
  heroImageUrl: string | null;
  photoUrls: string[];
  facets: Record<string, unknown>;
  ctaKind: FeedCtaKind;
  ctaTarget: string | null;
};

/** Turn an event into a feed post draft. Returns null if the event
 *  isn't suitable for the feed (e.g. work_captured with no photos). */
export function composeFeedPost(
  event: BusinessEvent
): ComposedFeedPost | null {
  const p = event.eventPayload as Record<string, unknown>;
  const ai = (event.aiUnderstanding ?? {}) as Record<string, unknown>;
  const trade = (p.trade as string) ?? (ai.trade as string) ?? "";
  const service = (p.service as string) ?? (ai.service as string) ?? "";
  const materials =
    (p.materials as string[]) ?? (ai.materials as string[]) ?? [];
  const photoUrls = (p.photo_urls as string[]) ?? [];
  const postcode = (p.postcode as string) ?? "";
  const city = cityFromPostcode(postcode);

  if (photoUrls.length === 0) return null;
  if (!trade && !service) return null;

  const slug = buildSlug(event, trade, service, city);
  const headline = buildHeadline(event.eventType, trade, service, city);
  const bodyMarkdown = buildBody(event.eventType, trade, service, materials, city);
  const { ctaKind, ctaTarget } = pickCta(event, service);

  return {
    slug,
    headline,
    bodyMarkdown,
    heroImageUrl: photoUrls[0] ?? null,
    photoUrls,
    facets: {
      trade,
      service,
      materials,
      city,
      postcode: postcode.toUpperCase(),
      event_type: event.eventType
    },
    ctaKind,
    ctaTarget
  };
}

function buildSlug(
  event: BusinessEvent,
  trade: string,
  service: string,
  city: string
): string {
  const date = event.occurredAt.slice(0, 10).replace(/-/g, "");
  const parts = [date, trade, service, city].filter(Boolean).map(kebab);
  const suffix = event.id.slice(0, 6);
  return [...parts, suffix].join("-");
}

function buildHeadline(
  eventType: string,
  trade: string,
  service: string,
  city: string
): string {
  const svc = service ? titleCase(service.replace(/_/g, " ")) : titleCase(trade);
  const where = city ? ` in ${city}` : "";
  switch (eventType) {
    case "job_completed":
      return `${svc} completed${where}`;
    case "work_captured":
      return `${svc} in progress${where}`;
    case "review_received":
      return `New review — ${svc}${where}`;
    default:
      return `${svc}${where}`;
  }
}

function buildBody(
  eventType: string,
  trade: string,
  service: string,
  materials: string[],
  city: string
): string {
  const svc = service ? titleCase(service.replace(/_/g, " ")).toLowerCase() : "";
  const mat =
    materials.length > 0
      ? ` using ${materials.map((m) => titleCase(m.replace(/_/g, " "))).join(", ")}`
      : "";
  const where = city ? ` in ${city}` : "";
  switch (eventType) {
    case "job_completed":
      return `Another ${svc} job wrapped${where}${mat}. Full details + photos below.`;
    case "work_captured":
      return `Latest progress on our current ${svc} job${where}${mat}.`;
    case "review_received":
      return `A recent customer took the time to share their thoughts about our ${svc}${where}.`;
    default:
      return `Latest from the ${trade} team${where}.`;
  }
}

function pickCta(
  event: BusinessEvent,
  service: string
): { ctaKind: FeedCtaKind; ctaTarget: string | null } {
  if (event.eventType === "review_received") {
    return { ctaKind: null, ctaTarget: null };
  }
  if (service) {
    const slug = kebab(service);
    return {
      ctaKind: "get_quote",
      ctaTarget: `/quote?service=${encodeURIComponent(slug)}`
    };
  }
  return { ctaKind: "message", ctaTarget: "#contact" };
}

function kebab(s: string): string {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(s: string): string {
  return s.replace(/(^|\s)\S/g, (t) => t.toUpperCase());
}

/** Rough UK postcode → city hint. Placeholder — real implementation
 *  looks up an ONS dataset or a paid postcode API. */
function cityFromPostcode(pc: string): string {
  if (!pc) return "";
  const area = pc.replace(/\s+/g, "").toUpperCase().slice(0, 2);
  const KNOWN: Record<string, string> = {
    SW: "London",
    W1: "London",
    NW: "London",
    SE: "London",
    E1: "London",
    LS: "Leeds",
    M1: "Manchester",
    B1: "Birmingham",
    NE: "Newcastle",
    L1: "Liverpool",
    G1: "Glasgow",
    EH: "Edinburgh",
    CF: "Cardiff",
    BS: "Bristol",
    S1: "Sheffield"
  };
  return KNOWN[area] ?? pc.toUpperCase();
}
