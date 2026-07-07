// Threads publisher (Threads Graph API).
//
// Real flow: mirrors Instagram Graph — media container + publish call.
//   POST /{ig_user}/threads { media_type: "IMAGE", image_url, text }
//   → creation_id
//   POST /{ig_user}/threads_publish { creation_id }
//
// Shares Meta auth with Instagram — same access token, different edge.
// For UK trades this is a repost channel: whatever hit Instagram, we
// forward here. Composer treats it as a repost of the IG rendering.
//
// Stubbed for MVP.

import type { Publication, MerchantChannelConnection } from "@/lib/publications/types";
import type { PublishResult } from "./registry";

export async function publishToThreads(
  publication: Publication,
  _connection: MerchantChannelConnection
): Promise<PublishResult> {
  const rc = publication.renderedContent as { caption?: string };
  if (!rc.caption) return { ok: false, reason: "no_caption" };
  return {
    ok: true,
    externalId: `th_stub_${publication.id.slice(0, 8)}`,
    externalPermalink: `https://threads.net/@stub/post/stub_${publication.id.slice(0, 6)}`
  };
}
