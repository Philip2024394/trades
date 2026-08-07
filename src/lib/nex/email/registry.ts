// NEX Email · registry
//
// Single entry point every service uses to reach an email provider. Never
// import an adapter (or a provider SDK) directly · always `getEmail()`.
//
// Selection driven by NEX_EMAIL_PROVIDER env var (default: resend).
// Adding a new adapter = one entry in `build()` below + one file in
// ./adapters/. No changes to callers.

import type { EmailAdapter } from "./types";
import { resendAdapter, isResendHealthy } from "./adapters/resend";

let cached: EmailAdapter | null = null;

export function getEmail(): EmailAdapter {
  if (cached) return cached;
  const kind = (process.env.NEX_EMAIL_PROVIDER ?? "resend").toLowerCase();
  cached = build(kind);
  return cached;
}

function build(kind: string): EmailAdapter {
  switch (kind) {
    case "resend":
      return resendAdapter;
    // Future: "ses" · "sendgrid" · "smtp" · "mailgun" · "postmark"
    default:
      throw new Error(`[nex-email] unknown provider: ${kind} · set NEX_EMAIL_PROVIDER to one of: resend`);
  }
}

/** Test-only: reset the cached adapter so a different one can be selected. */
export function _resetEmailForTests(): void {
  cached = null;
}

/**
 * Every registered adapter with its declared state.
 * Order matches the registry — `active: true` on the currently-selected one.
 */
export function knownAdapters(): Array<{ id: string; label: string; status: "supported" | "planned"; active: boolean; note?: string }> {
  const activeId = (process.env.NEX_EMAIL_PROVIDER ?? "resend").toLowerCase();
  return [
    { id: "resend",   label: "Resend",                status: "supported", active: activeId === "resend" },
    { id: "smtp",     label: "SMTP (generic)",        status: "planned",   active: false },
    { id: "sendgrid", label: "SendGrid",              status: "planned",   active: false },
    { id: "ses",      label: "Amazon SES",            status: "planned",   active: false },
    { id: "mailgun",  label: "Mailgun",               status: "planned",   active: false },
    { id: "postmark", label: "Postmark",              status: "planned",   active: false },
  ];
}

/** Probe · returns true if the active provider is reachable. */
export async function isEmailHealthy(): Promise<{ healthy: boolean; detail?: string; provider: string }> {
  const adapter = getEmail();
  if (adapter.name === "resend") {
    const r = await isResendHealthy();
    return { ...r, provider: "resend" };
  }
  return { healthy: false, detail: `no health probe for provider: ${adapter.name}`, provider: adapter.name };
}
