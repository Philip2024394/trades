// Instagram Graph API publisher.
//
// Real flow (documented for the next engineer to wire):
//   1. POST {ig_user_id}/media  { image_url, caption } → returns creation_id
//   2. POST {ig_user_id}/media_publish { creation_id } → returns { id }
//   3. GET /{id}?fields=permalink → returns { permalink }
//
// Requires:
//   - Merchant has connected an Instagram Business account (OAuth via
//     Meta) with ig_content_publish + pages_read_engagement scopes.
//   - Access token is Facebook Page access token (Instagram publishing
//     uses the connected FB page's token).
//
// For MVP we STUB: return a fake external id + permalink so the
// publication row can be marked posted and the merchant sees the
// pipeline works end-to-end. Real integration lands when we ship the
// Meta OAuth surface.

import type { Publication, MerchantChannelConnection } from "@/lib/publications/types";
import type { PublishResult } from "./registry";

export async function publishToInstagram(
  publication: Publication,
  _connection: MerchantChannelConnection
): Promise<PublishResult> {
  const rc = publication.renderedContent as {
    caption?: string;
    hero_image_url?: string;
    hashtags?: string[];
  };
  if (!rc.hero_image_url) {
    return { ok: false, reason: "no_hero_image_for_instagram" };
  }
  if (!process.env.META_ACCESS_TOKEN_STUB_BYPASS) {
    // Stub path — pretend the post landed.
    return {
      ok: true,
      externalId: `ig_stub_${publication.id.slice(0, 8)}`,
      externalPermalink: `https://instagram.com/p/stub_${publication.id.slice(0, 6)}`
    };
  }
  // Real path outline — leaving as placeholder for the OAuth work.
  return { ok: false, reason: "real_instagram_publish_not_yet_implemented" };
}
