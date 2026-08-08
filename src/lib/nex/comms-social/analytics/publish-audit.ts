// NEX Comms Centre · Social · publish audit hooks.
//
// Charter §S-XI: every Social publish emits an event to the canonical
// nex.analytics_events stream · Attribution reads that stream. No
// parallel attribution system.
//
// We record TWO event types per publish:
//   * event_type='queued'    provider='social:<platform>'   at intent insert
//   * event_type='delivered' provider='social:<platform>'   at verified publish
// Both use recipient_id=NULL (aggregate) · metadata carries the
// social-specific IDs so downstream queries can filter/join.

import type { PgClientLike } from "@/lib/nex/db";

export interface RecordPublishEventInput {
  client:            PgClientLike;
  tenant_id:         string;
  platform:          string;
  scheduled_id:      string;
  intent_id:         string;
  draft_id:          string;
  event_type:        "queued" | "delivered";
  provider_post_id?: string;
}

export async function recordSocialPublishEvent(input: RecordPublishEventInput): Promise<void> {
  const provider = `social:${input.platform}`;
  const metadata = {
    subsystem:        "comms_social",
    scheduled_id:     input.scheduled_id,
    intent_id:        input.intent_id,
    draft_id:         input.draft_id,
    provider_post_id: input.provider_post_id ?? null,
  };
  await input.client.query(
    `INSERT INTO nex.analytics_events
       (event_type, event_timestamp, provider, metadata, provider_message_id)
     VALUES ($1::text, NOW(), $2::text, $3::jsonb, $4::text)`,
    [input.event_type, provider, JSON.stringify(metadata), input.provider_post_id ?? null],
  );
}

// Merchant-facing click event · called by the tracking-redirect endpoint.
export interface RecordSocialClickInput {
  client:      PgClientLike;
  platform:    string;
  post_id:     string;              // utm_campaign · our draft_id typically
  variant?:    string;
  link_url:    string;
  user_agent?: string;
  ip?:         string;              // NB · Attribution will hash at read
}

export async function recordSocialClick(input: RecordSocialClickInput): Promise<void> {
  await input.client.query(
    `INSERT INTO nex.analytics_events
       (event_type, event_timestamp, provider, metadata, user_agent, ip, link_url)
     VALUES ('clicked', NOW(), $1::text, $2::jsonb, $3::text, $4::text, $5::text)`,
    [
      `social:${input.platform}`,
      JSON.stringify({ subsystem: "comms_social_click", post_id: input.post_id, variant: input.variant ?? null }),
      input.user_agent ?? null,
      input.ip ?? null,
      input.link_url,
    ],
  );
}
