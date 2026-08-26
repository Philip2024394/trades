// src/lib/nex-comms/providers/mock-provider.ts
//
// MOCK PROVIDER · test-only · records intended sends without doing anything real.
//
// Also serves as the default in dev/test when no real provider is configured.
// Real outbound requires:
//   NEX_COMMS_OUTBOUND_ENABLED === 'true'
// AND (for WhatsApp specifically)
//   NEX_COMMS_WHATSAPP_ENABLED === 'true'
// AND a registered non-mock provider.

import type {
  CommsProvider,
  ProviderHealth,
  ProviderSendRequest,
  ProviderSendResult,
} from "./types";
import type { CommsChannel } from "../types";

export class MockCommsProvider implements CommsProvider {
  readonly name = "mock";
  readonly supportedChannels: readonly CommsChannel[] = [
    "nex_in_app",
    "nex_web",
    "nex_inbox",
    "email",
    "push_notification",
    "whatsapp",
    "sms",
    "voice_call",
  ];

  private recorded: ProviderSendRequest[] = [];

  async send(req: ProviderSendRequest): Promise<ProviderSendResult> {
    this.recorded.push(req);
    return {
      status: "OK",
      providerMessageId: `mock-${req.messageId}`,
      submittedAt: new Date(),
      reportedStatus: "submitted",
      costIdr: 0,
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      provider: "mock",
      available: true,
      authenticated: true,
      lastError: null,
      queueDepth: 0,
      latencyMsP50: 1,
    };
  }

  recordedRequests(): readonly ProviderSendRequest[] {
    return this.recorded;
  }

  clearRecorded(): void {
    this.recorded = [];
  }
}

/**
 * Kill-switch check that must pass before a REAL (non-mock) provider is used.
 * Mock provider is always allowed because it does nothing external.
 */
export function realOutboundPermitted(channel: CommsChannel): { ok: boolean; reason?: string } {
  if (process.env.NEX_COMMS_OUTBOUND_ENABLED !== "true") {
    return { ok: false, reason: "NEX_COMMS_OUTBOUND_ENABLED is not 'true' · real outbound refused" };
  }
  if (channel === "whatsapp" && process.env.NEX_COMMS_WHATSAPP_ENABLED !== "true") {
    return { ok: false, reason: "NEX_COMMS_WHATSAPP_ENABLED is not 'true' · WhatsApp refused even though outbound is enabled" };
  }
  return { ok: true };
}
