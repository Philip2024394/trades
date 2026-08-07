// NEX Notifications Runtime · shared types
//
// Multi-channel outbound communication (whatsapp · sms · push · in_app).
// Every send goes through this interface. Providers implement adapters
// per (channel, provider) pair. No application code touches a provider
// SDK directly — Runtime doctrine.

export type NotificationChannel = "whatsapp" | "sms" | "push" | "in_app";

export type NotificationKind = "marketing" | "transactional";

export type NotificationAddress = {
  address: string;                            // phone (E.164 preferred) for whatsapp/sms · contact_id for push/in_app
  name?: string;
};

export type NotificationMessage = {
  channel: NotificationChannel;
  from?: NotificationAddress;                 // sender · optional (some adapters use a shared sender number)
  to: NotificationAddress[];                  // one recipient per send · caller batches
  kind: NotificationKind;
  // Body variants · adapters use whatever their channel supports:
  subject?: string;                           // push title · in-app subject
  body?: string;                              // plain text · works for every channel
  html?: string;                              // rarely used · WhatsApp template media
  template?: string;                          // provider-side template name (WhatsApp templates · FCM data payloads)
  template_params?: Record<string, string>;
  data?: Record<string, unknown>;             // push data payload · in-app metadata
  campaign_id?: string;
  headers?: Record<string, string>;
};

export type NotificationSendResult = {
  ok: true;
  provider: string;
  provider_message_id: string;
  sent_at: string;
} | {
  ok: false;
  provider: string;
  reason: string;
  retryable: boolean;
};

export type NotificationCapabilities = Readonly<{
  supportsBody: boolean;
  supportsMedia: boolean;
  supportsTemplate: boolean;                  // provider-side templates
  supportsDataPayload: boolean;
  supportsDeliveryReceipts: boolean;
}>;

export interface NotificationAdapter {
  readonly name: string;
  readonly channel: NotificationChannel;
  readonly capabilities: NotificationCapabilities;
  send(msg: NotificationMessage): Promise<NotificationSendResult>;
}
