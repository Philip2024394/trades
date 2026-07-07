// TikTok publisher (Content Posting API).
//
// Real flow:
//   POST https://open.tiktokapis.com/v2/post/publish/inbox/video/init/
//     { source_info: { source: "PULL_FROM_URL", video_url } }
//   → returns { publish_id }
//   Poll status until "PUBLISH_COMPLETE".
//
// Requires: video.publish scope. Photos-only require the photo flow
// (post/publish/content/init) — different endpoint.
//
// TikTok does NOT accept auto-publish for many accounts — most posts
// land in the app's inbox for merchant review. That's actually helpful
// for our approval-buffer story.
//
// Stubbed for MVP.

import type { Publication, MerchantChannelConnection } from "@/lib/publications/types";
import type { PublishResult } from "./registry";

export async function publishToTiktok(
  publication: Publication,
  _connection: MerchantChannelConnection
): Promise<PublishResult> {
  const rc = publication.renderedContent as { caption?: string; photo_urls?: string[] };
  if (!rc.photo_urls || rc.photo_urls.length === 0) {
    return { ok: false, reason: "no_media_for_tiktok" };
  }
  return {
    ok: true,
    externalId: `tt_stub_${publication.id.slice(0, 8)}`,
    externalPermalink: `https://tiktok.com/@stub/video/stub_${publication.id.slice(0, 6)}`
  };
}
