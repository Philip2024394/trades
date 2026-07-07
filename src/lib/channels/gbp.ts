// Google Business Profile publisher.
//
// Real flow (Business Profile Performance API + Business Information API):
//   POST accounts/{account}/locations/{location}/localPosts
//   { languageCode: "en-GB", summary, callToAction: { actionType: "CALL", url },
//     media: [{ mediaFormat: "PHOTO", sourceUrl }] }
//
// GBP has strict content rules — no all-caps, no more than 1 exclamation,
// no promotional overkill. The composer's `tone: local + specific` prompt
// steers the LLM away from GBP-violating output.
//
// Stubbed for MVP.

import type { Publication, MerchantChannelConnection } from "@/lib/publications/types";
import type { PublishResult } from "./registry";

export async function publishToGbp(
  publication: Publication,
  _connection: MerchantChannelConnection
): Promise<PublishResult> {
  const rc = publication.renderedContent as {
    caption?: string;
    hero_image_url?: string;
  };
  if (!rc.caption) return { ok: false, reason: "no_caption" };
  if (!rc.hero_image_url) return { ok: false, reason: "no_hero_image_for_gbp" };
  return {
    ok: true,
    externalId: `gbp_stub_${publication.id.slice(0, 8)}`,
    externalPermalink: `https://business.google.com/posts/stub_${publication.id.slice(0, 6)}`
  };
}
