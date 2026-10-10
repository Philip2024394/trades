// src/lib/nex-native/emergency/_sms-adapter-stub.ts
//
// NEX Emergency Help · SMS adapter STUB (v1 PILOT).
//
// Doctrine (HONEST-BLOCKED · sealed 2026-10-10):
//   · No SMS provider (Twilio / Vonage / local SMS gateway) is wired
//     in v1. This stub ALWAYS returns ok=false with a sealed reason.
//   · We NEVER fabricate SMS delivery. Fabricated delivery would be
//     a safety-of-user regression: an operator reading the audit log
//     cannot distinguish real from fake delivery.
//   · The adapter STILL writes to the fan-out audit log (via the
//     caller · emergency-notification-service). That is how the
//     operator sees "we tried, we didn't fabricate".
//
// Live-mode activation (future · requires founder sign-off):
//   · Twilio or equivalent provider agreement
//   · ENV: NEX_EMERGENCY_SMS_PROVIDER=twilio
//   · ENV: NEX_EMERGENCY_SMS_AUTH_TOKEN=...
//   · ENV: NEX_EMERGENCY_SMS_FROM=+1555...
//   · Replace this stub with a real adapter following the same
//     return-value contract. The return union already carries a
//     'provider_unavailable' reason for soft failures.
//
// NOTE on 'provider_unavailable' vs 'adapter_not_implemented':
//   · adapter_not_implemented · v1 default · "we did not even try"
//   · provider_unavailable    · live mode · "we tried; the provider
//     returned an error, timeout, or rate-limit"
//   · Both are honest-blocked outcomes for the audit log.

import "server-only";

export interface EmergencySmsArgs {
  readonly to: string;
  readonly textBody: string;
  readonly idempotencyKey: string;
  readonly simulated: boolean;
}

export type EmergencySmsResult = {
  readonly ok: false;
  readonly reason: "sms_adapter_not_implemented" | "sms_provider_unavailable";
  readonly channel: "sms";
  readonly simulated: boolean;
};

/**
 * Always returns an honest-blocked response. v1 PILOT has no SMS
 * provider wired. The caller is responsible for writing this
 * outcome to the fan-out audit log.
 */
export async function sendEmergencySMS(
  args: EmergencySmsArgs,
): Promise<EmergencySmsResult> {
  // Keep input validation honest-visible: an empty args would still
  // return not_implemented, but we touch the args so the TS reader
  // sees we received them. (The 'simulated' flag flows through for
  // the audit log parity.)
  void args.to;
  void args.textBody;
  void args.idempotencyKey;
  return {
    ok: false,
    reason: "sms_adapter_not_implemented",
    channel: "sms",
    simulated: args.simulated,
  };
}

/** Separate stub for WhatsApp, same doctrine · HONEST-BLOCKED. */
export async function sendEmergencyWhatsApp(
  args: EmergencySmsArgs,
): Promise<EmergencySmsResult> {
  void args.to;
  void args.textBody;
  void args.idempotencyKey;
  return {
    ok: false,
    reason: "sms_adapter_not_implemented",
    channel: "sms",
    simulated: args.simulated,
  };
}
