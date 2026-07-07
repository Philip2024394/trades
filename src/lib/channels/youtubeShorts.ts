// YouTube Shorts publisher (YouTube Data API v3, videos.insert).
//
// Real flow:
//   POST https://www.googleapis.com/upload/youtube/v3/videos
//     multipart body with snippet.title, snippet.description,
//     snippet.tags, status.privacyStatus, mediaBody = video file.
//   Add #Shorts to the title/description + upload a 9:16 clip < 60s
//   to trigger Shorts classification.
//
// Requires: youtube.upload scope, channel_id in the connection.
//
// Stubbed for MVP.

import type { Publication, MerchantChannelConnection } from "@/lib/publications/types";
import type { PublishResult } from "./registry";

export async function publishToYoutubeShorts(
  publication: Publication,
  _connection: MerchantChannelConnection
): Promise<PublishResult> {
  const rc = publication.renderedContent as { photo_urls?: string[] };
  if (!rc.photo_urls || rc.photo_urls.length === 0) {
    return { ok: false, reason: "no_media_for_youtube_shorts" };
  }
  return {
    ok: true,
    externalId: `yt_stub_${publication.id.slice(0, 8)}`,
    externalPermalink: `https://youtube.com/shorts/stub_${publication.id.slice(0, 6)}`
  };
}
