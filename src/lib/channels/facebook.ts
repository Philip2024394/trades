// Facebook Page publisher (via Meta Graph API).
//
// Real flow:
//   POST /{page_id}/photos { url: hero_image_url, caption } → returns { id, post_id }
//   OR
//   POST /{page_id}/feed { message, link } → returns { id }
//
// Requires: pages_manage_posts scope, page access token.
//
// Stubbed for MVP.

import type { Publication, MerchantChannelConnection } from "@/lib/publications/types";
import type { PublishResult } from "./registry";

export async function publishToFacebook(
  publication: Publication,
  _connection: MerchantChannelConnection
): Promise<PublishResult> {
  const rc = publication.renderedContent as { caption?: string };
  if (!rc.caption) {
    return { ok: false, reason: "no_caption" };
  }
  return {
    ok: true,
    externalId: `fb_stub_${publication.id.slice(0, 8)}`,
    externalPermalink: `https://facebook.com/posts/stub_${publication.id.slice(0, 6)}`
  };
}
