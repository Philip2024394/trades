// NEX Delivery Engine · shared types
//
// Layer position (Philip 2026-08-07):
//   Composer → Renderer → Scheduler → Queue → Worker → Runtime → Provider Adapter
//
// Provider-agnostic from day one: Provider Adapter is a plain
// interface, the simulator is one adapter, future SMTP/SES/SendGrid/
// Mailgun/Postmark are peers.

export type JobType = "campaign.expand" | "campaign.send_batch" | "campaign.finalise";

export type JobStatus =
  | "pending" | "running" | "completed" | "failed" | "cancelled" | "dead_letter";

export type AttemptOutcome =
  | "success" | "transient_failure" | "permanent_failure" | "abandoned";

export type DeliveryJob = {
  job_id: string;
  job_type: JobType;
  status: JobStatus;
  priority: number;
  scheduled_for: string;
  campaign_id: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  attempts: number;
  max_attempts: number;
  lease_owner: string | null;
  lease_expires_at: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;
};

export type DeliveryJobAttempt = {
  attempt_id: string;
  job_id: string;
  attempt_no: number;
  worker_id: string;
  started_at: string;
  completed_at: string | null;
  outcome: AttemptOutcome | null;
  latency_ms: number | null;
  error: string | null;
  detail: Record<string, unknown> | null;
};

export type DeliveryWorker = {
  worker_id: string;
  hostname: string | null;
  started_at: string;
  last_seen_at: string;
  jobs_processed: number;
  jobs_failed: number;
  mode: "simulation" | "runtime";
};

export type RecipientStatus =
  | "pending" | "sent" | "failed" | "suppressed" | "skipped_window";

export type CampaignRecipient = {
  campaign_id: string;
  contact_id: string;
  email: string;
  country: string | null;
  variables: Record<string, string>;
  send_status: RecipientStatus;
  suppressed_reason: string | null;
  attempts: number;
  scheduled_for: string | null;
  sent_at: string | null;
  failed_at: string | null;
  provider: string | null;
  provider_message_id: string | null;
  latency_ms: number | null;
  last_error: string | null;
  created_at: string;
};

// ── Provider adapter contract ─────────────────────────────────────
export type EmailMessage = {
  from: string;
  reply_to?: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
  campaign_id?: string;
  recipient_contact_id?: string;
};

export type ProviderSendResult =
  | { ok: true;  provider_message_id: string; latency_ms: number }
  | { ok: false; error: string; retriable: boolean; latency_ms: number };

export interface DeliveryProviderAdapter {
  id: string;                                         // 'simulator' | 'smtp' | 'ses' | 'sendgrid' | 'mailgun' | 'postmark'
  label: string;
  send(msg: EmailMessage): Promise<ProviderSendResult>;
}
