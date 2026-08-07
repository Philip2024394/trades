// NEX Email · adapter interface
//
// Every send goes through this interface. Providers (Resend today · SES /
// SendGrid / Postmark / SMTP tomorrow) implement the same contract. No
// application code imports a provider SDK directly — that would leak the
// adapter (see constitution_nex_backend_provider_agnostic_2026_08_07).

export type EmailKind = "marketing" | "transactional";

export type EmailAddress = { address: string; name?: string };

export type EmailMessage = {
  from: EmailAddress;
  to: EmailAddress[];                 // one adapter.send() call = one recipient by design
  reply_to?: string;
  subject: string;
  html?: string;
  text?: string;
  kind: EmailKind;                    // decides compliance rules AND provider routing
  campaign_id?: string;               // free-form correlation id · surfaces in send-audit
  headers?: Record<string, string>;   // e.g. List-Unsubscribe · X-Entity-Ref-ID
};

export type SendResult = {
  ok: true;
  provider_message_id: string;
  provider: string;
  sent_at: string;
} | {
  ok: false;
  provider: string;
  reason: string;
  retryable: boolean;
};

export type EmailCapabilities = Readonly<{
  supportsHtml: boolean;
  supportsText: boolean;
  supportsAttachments: boolean;
  supportsTemplating: boolean;        // provider-side templates (not our own template system)
  supportsOpenTracking: boolean;
  supportsClickTracking: boolean;
}>;

export interface EmailAdapter {
  readonly name: string;              // "resend" · "ses" · "sendgrid" · logs + audit only, never for routing
  readonly capabilities: EmailCapabilities;
  send(msg: EmailMessage): Promise<SendResult>;
}
