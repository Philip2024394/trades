// X (Twitter) publisher (v2 API — POST /2/tweets).
//
// Real flow:
//   1. Upload media via v1.1 (v2 media upload still in transition):
//      POST https://upload.twitter.com/1.1/media/upload.json
//      → media_id
//   2. POST https://api.twitter.com/2/tweets { text, media: { media_ids } }
//
// Requires: tweet.write + tweet.read + users.read scopes.
//
// Note: X is heavily de-prioritised in the design doc — low ROI for
// most UK trades. We ship the handler for completeness but expect
// most merchants to leave the channel unconnected.

import type { Publication, MerchantChannelConnection } from "@/lib/publications/types";
import type { PublishResult } from "./registry";

export async function publishToX(
  publication: Publication,
  _connection: MerchantChannelConnection
): Promise<PublishResult> {
  const rc = publication.renderedContent as { caption?: string };
  if (!rc.caption) return { ok: false, reason: "no_caption" };
  return {
    ok: true,
    externalId: `x_stub_${publication.id.slice(0, 8)}`,
    externalPermalink: `https://x.com/stub/status/stub_${publication.id.slice(0, 6)}`
  };
}
