// NEX Delivery Engine · audit helper
//
// Every meaningful transition writes a row to nex.events with a
// stable event_type. Never fails the caller if events isn't writeable —
// telemetry is a best-effort concern.

import { withClient } from "./db";

export type DeliveryEventType =
  | "delivery.campaign_scheduled"
  | "delivery.queue_built"
  | "delivery.worker_started"
  | "delivery.worker_heartbeat"
  | "delivery.batch_started"
  | "delivery.batch_completed"
  | "delivery.recipient_sent"
  | "delivery.recipient_failed"
  | "delivery.recipient_suppressed"
  | "delivery.campaign_completed"
  | "delivery.campaign_cancelled"
  | "delivery.job_dead_letter";

export async function emitDeliveryEvent(event_type: DeliveryEventType, payload: Record<string, unknown> = {}, campaign_id?: string): Promise<void> {
  try {
    await withClient(async (c) => {
      // Try the "canonical" nex.events shape (event_type + payload). If the
      // table doesn't exist or the shape differs, swallow — audit is
      // best-effort and never blocks delivery.
      await c.query(
        `INSERT INTO nex.events (event_type, payload) VALUES ($1, $2::jsonb)`,
        [event_type, JSON.stringify({ ...payload, campaign_id: campaign_id ?? payload.campaign_id ?? null, ts: new Date().toISOString() })],
      );
      return null;
    });
  } catch {
    // swallow · telemetry never blocks the pipeline
  }
}
