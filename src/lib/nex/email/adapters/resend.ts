// NEX Email · Resend adapter
//
// ONLY file in the codebase permitted to `import { Resend } from "resend"`.
// Every other caller uses the NEX Email Runtime (see ./registry.ts).
//
// Config:
//   RESEND_API_KEY                 · required · secret · not surfaced to browser
//   NEX_EMAIL_DEFAULT_FROM         · optional · fallback when the message omits `from`
//
// Doctrine: constitution_nex_email_runtime_8_phase_roadmap_2026_08_07.md

import type { EmailAdapter, EmailMessage, SendResult } from "../types";

let clientPromise: Promise<{ emails: { send: (opts: Record<string, unknown>) => Promise<{ data: { id?: string } | null; error: { message?: string; name?: string } | null }> } }> | null = null;

async function getClient() {
  if (clientPromise) return clientPromise;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("[nex-email-resend] RESEND_API_KEY not set");
  clientPromise = (async () => {
    const mod = await import("resend" as string);
    const Resend = (mod as { Resend: new (k: string) => ReturnType<typeof getClient> extends Promise<infer T> ? T : never }).Resend;
    return new Resend(key) as unknown as ReturnType<typeof getClient> extends Promise<infer T> ? T : never;
  })();
  return clientPromise;
}

function formatAddress(a: { address: string; name?: string }): string {
  return a.name ? `${a.name} <${a.address}>` : a.address;
}

export const resendAdapter: EmailAdapter = {
  name: "resend",
  capabilities: {
    supportsHtml: true,
    supportsText: true,
    supportsAttachments: true,
    supportsTemplating: false,        // we don't use Resend templates · NEX-side templates come in Phase 5
    supportsOpenTracking: false,       // Phase 7
    supportsClickTracking: false,      // Phase 7
  },
  async send(msg: EmailMessage): Promise<SendResult> {
    const started = Date.now();
    try {
      const client = await getClient();
      const from = formatAddress(msg.from);
      const to = msg.to.map(formatAddress);
      const payload: Record<string, unknown> = {
        from,
        to,
        subject: msg.subject,
      };
      if (msg.html) payload.html = msg.html;
      if (msg.text) payload.text = msg.text;
      if (msg.reply_to) payload.reply_to = msg.reply_to;
      if (msg.headers) payload.headers = msg.headers;

      const result = await client.emails.send(payload);
      if (result.error) {
        return {
          ok: false,
          provider: "resend",
          reason: `${result.error.name ?? "resend_error"}: ${result.error.message ?? "unknown"}`,
          retryable: /timeout|rate|5\d\d/i.test(result.error.message ?? ""),
        };
      }
      return {
        ok: true,
        provider: "resend",
        provider_message_id: result.data?.id ?? `resend-${started}`,
        sent_at: new Date().toISOString(),
      };
    } catch (err) {
      const _elapsed = Date.now() - started;
      return {
        ok: false,
        provider: "resend",
        reason: err instanceof Error ? err.message : "unknown",
        retryable: true,
      };
    }
  },
};

export async function isResendHealthy(): Promise<{ healthy: boolean; detail?: string }> {
  if (!process.env.RESEND_API_KEY) return { healthy: false, detail: "RESEND_API_KEY not set" };
  try {
    await getClient();
    // Resend has no /health endpoint · presence of a valid client is the best local probe.
    // Real deliverability is proved by the audit trail (success rates).
    return { healthy: true, detail: "client initialised · deliverability proven by audit success rate" };
  } catch (err) {
    return { healthy: false, detail: err instanceof Error ? err.message : "unknown" };
  }
}
