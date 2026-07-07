// Publication types — one row per (event, channel).

import type { ChannelId } from "@/lib/llm/composeForChannel";

export type PublicationStatus =
  | "scheduled"
  | "posted"
  | "held"
  | "failed"
  | "archived";

export type Publication = {
  id: string;
  merchantId: string;
  eventId: string;
  channel: ChannelId;
  connectionId: string | null;
  renderedContent: Record<string, unknown>;
  status: PublicationStatus;
  holdReason: string | null;
  scheduledFor: string;
  postedAt: string | null;
  externalId: string | null;
  externalPermalink: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MerchantChannelConnection = {
  id: string;
  merchantId: string;
  channel: ChannelId;
  externalAccountId: string;
  displayName: string | null;
  status: "active" | "expired" | "revoked";
  connectedAt: string;
  lastUsedAt: string | null;
};
