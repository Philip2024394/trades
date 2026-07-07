// Pinterest publisher (Pinterest API v5).
//
// Real flow:
//   POST https://api.pinterest.com/v5/pins
//     { board_id, media_source: { source_type: "image_url", url: hero },
//       title: headline, description: caption, link: cta_target }
//
// Requires: pins:write + boards:read scopes, a target board id.
//
// Stubbed for MVP.

import type { Publication, MerchantChannelConnection } from "@/lib/publications/types";
import type { PublishResult } from "./registry";

export async function publishToPinterest(
  publication: Publication,
  _connection: MerchantChannelConnection
): Promise<PublishResult> {
  const rc = publication.renderedContent as { caption?: string; hero_image_url?: string };
  if (!rc.hero_image_url) return { ok: false, reason: "no_hero_image_for_pinterest" };
  return {
    ok: true,
    externalId: `pin_stub_${publication.id.slice(0, 8)}`,
    externalPermalink: `https://pinterest.com/pin/stub_${publication.id.slice(0, 6)}`
  };
}
