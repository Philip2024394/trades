// src/lib/nex-comms/providers/types.ts
//
// PROVIDER ABSTRACTION · every external communications provider implements this.
//
// Doctrine: NEX owns the intelligence. Providers are replaceable transport.
// NO NEX subsystem outside src/lib/nex-comms/ may import a provider directly.

import type { CommsChannel, CommsMessageStatus } from "../types";

export interface ProviderSendRequest {
  provider: string;                     // provider name for audit
  messageId: string;                    // NEX-side message id
  channel: CommsChannel;
  recipient: {
    canonicalPhoneE164?: string | null;
    email?: string | null;
    deviceRef?: string | null;
  };
  content: {
    text?: string;
    mediaRef?: string;
    templateRef?: string;               // provider-registered template id
    parameters?: Record<string, string | number | boolean>;
  };
  correlationId?: string;
}

export interface ProviderSendOK {
  status: "OK";
  providerMessageId: string;
  submittedAt: Date;
  reportedStatus: CommsMessageStatus;   // provider's initial state (usually 'submitted' or 'sent')
  costIdr: number | null;               // null when provider does not report cost inline
}

export interface ProviderSendRefused {
  status: "REFUSED";
  reason:
    | "PROVIDER_DISABLED_BY_KILL_SWITCH"
    | "PROVIDER_CHANNEL_UNSUPPORTED"
    | "PROVIDER_AUTH_MISSING"
    | "PROVIDER_TEMPORARY_UNAVAILABLE"
    | "PROVIDER_RECIPIENT_INVALID"
    | "PROVIDER_TEMPLATE_UNAPPROVED";
  detail: string;
}

export type ProviderSendResult = ProviderSendOK | ProviderSendRefused;

export interface ProviderHealth {
  provider: string;
  available: boolean;
  authenticated: boolean;
  lastError: string | null;
  queueDepth: number | null;
  latencyMsP50: number | null;
}

export interface CommsProvider {
  name: string;
  supportedChannels: readonly CommsChannel[];
  send(req: ProviderSendRequest): Promise<ProviderSendResult>;
  healthCheck(): Promise<ProviderHealth>;
}
