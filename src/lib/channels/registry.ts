// Channel publisher registry. Each channel exports a publish handler
// that takes a rendered publication + a merchant channel connection
// and returns the external post id + permalink.
//
// G2 handlers: instagram / facebook / gbp
// G4 handlers: linkedin / pinterest / tiktok / youtube_shorts / x / threads

import type { Publication } from "@/lib/publications/types";
import type { MerchantChannelConnection } from "@/lib/publications/types";
import type { ChannelId } from "@/lib/llm/composeForChannel";
import { publishToInstagram } from "./instagram";
import { publishToFacebook } from "./facebook";
import { publishToGbp } from "./gbp";
import { publishToLinkedin } from "./linkedin";
import { publishToPinterest } from "./pinterest";
import { publishToTiktok } from "./tiktok";
import { publishToYoutubeShorts } from "./youtubeShorts";
import { publishToX } from "./x";
import { publishToThreads } from "./threads";

export type PublishResult = {
  ok: boolean;
  externalId?: string;
  externalPermalink?: string;
  reason?: string;
};

export type PublishHandler = (
  publication: Publication,
  connection: MerchantChannelConnection
) => Promise<PublishResult>;

const handlers: Partial<Record<ChannelId, PublishHandler>> = {
  instagram: publishToInstagram,
  facebook: publishToFacebook,
  gbp: publishToGbp,
  linkedin: publishToLinkedin,
  pinterest: publishToPinterest,
  tiktok: publishToTiktok,
  youtube_shorts: publishToYoutubeShorts,
  x: publishToX,
  threads: publishToThreads
};

export function publishHandlerFor(
  channel: ChannelId
): PublishHandler | undefined {
  return handlers[channel];
}

export const SUPPORTED_CHANNELS: ChannelId[] = [
  "instagram",
  "facebook",
  "gbp",
  "linkedin",
  "pinterest",
  "tiktok",
  "youtube_shorts",
  "x",
  "threads"
];
