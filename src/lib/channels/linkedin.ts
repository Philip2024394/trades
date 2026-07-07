// LinkedIn publisher (Marketing Developer Platform / UGC posts).
//
// Real flow:
//   POST https://api.linkedin.com/v2/ugcPosts
//     { author: urn:li:organization:{id}, lifecycleState: PUBLISHED,
//       specificContent: { com.linkedin.ugc.ShareContent: {
//         shareCommentary: { text: caption },
//         shareMediaCategory: "IMAGE",
//         media: [{ status: "READY", media: urn:li:digitalmediaAsset:{id} }]
//       }}, visibility: { com.linkedin.ugc.MemberNetworkVisibility: "PUBLIC" } }
//
// Requires: w_organization_social + r_organization_social scopes,
// company page id, media upload dance for the image asset.
//
// Stubbed for MVP.

import type { Publication, MerchantChannelConnection } from "@/lib/publications/types";
import type { PublishResult } from "./registry";

export async function publishToLinkedin(
  publication: Publication,
  _connection: MerchantChannelConnection
): Promise<PublishResult> {
  const rc = publication.renderedContent as { caption?: string };
  if (!rc.caption) return { ok: false, reason: "no_caption" };
  return {
    ok: true,
    externalId: `li_stub_${publication.id.slice(0, 8)}`,
    externalPermalink: `https://linkedin.com/feed/update/stub_${publication.id.slice(0, 6)}`
  };
}
