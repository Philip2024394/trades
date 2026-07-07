// Feed projection — writes to feed_posts for events with photos +
// enough structured context to be worth publishing.
//
// Held (not published) reasons include:
//   - consent_missing  — customer permission wasn't recorded
//   - low_quality      — AI understanding scored below threshold
//   - no_photos        — nothing to show
//   - insufficient_data — trade/service missing
//
// Held rows exist so the merchant can see WHY nothing appeared, then
// grant consent / add trade tag → releaseFeedPost flips to published.

import { composeFeedPost } from "@/lib/feed/composer";
import { insertFeedPost } from "@/lib/feed/loader";
import type { BusinessEvent, ProjectionResult } from "../types";

/** Consent-state extraction — event payload may carry consent_state
 *  directly, or an AI understanding may indicate `not_required`
 *  (public site photo, no customer property). */
function consentOk(event: BusinessEvent): boolean {
  const p = event.eventPayload as Record<string, unknown>;
  const state = (p.consent_state as string) ?? "";
  return state === "granted" || state === "not_required";
}

export async function feedProjection(
  event: BusinessEvent
): Promise<ProjectionResult> {
  // Feed only fires for content-worthy event types.
  const contentTypes = [
    "work_captured",
    "job_completed",
    "review_received",
    "testimonial_recorded",
    "certification_earned",
    "milestone_reached"
  ];
  if (!contentTypes.includes(event.eventType)) {
    return { status: "skipped", reason: `no feed projection for ${event.eventType}` };
  }

  // Consent gate — never publish without it.
  if (!consentOk(event)) {
    return {
      status: "held",
      reason:
        "consent_missing — customer permission not recorded. Grant permission in Activity → Held."
    };
  }

  const composed = composeFeedPost(event);
  if (!composed) {
    return {
      status: "held",
      reason: "insufficient_data — need at least one photo and a trade or service"
    };
  }

  const post = await insertFeedPost({
    merchantId: event.merchantId,
    slug: composed.slug,
    headline: composed.headline,
    bodyMarkdown: composed.bodyMarkdown,
    heroImageUrl: composed.heroImageUrl ?? undefined,
    photoUrls: composed.photoUrls,
    facets: composed.facets,
    ctaKind: composed.ctaKind,
    ctaTarget: composed.ctaTarget ?? undefined,
    linkedEventId: event.id,
    scheduledMinutesFromNow: 60
  });
  if (!post) {
    return { status: "failed", reason: "feed_post insert failed" };
  }
  return {
    status: "done",
    targetRef: {
      feedPostId: post.id,
      slug: post.slug,
      scheduledFor: post.scheduledFor
    }
  };
}
