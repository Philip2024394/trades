// src/lib/nex-native/email-send-adapter.ts
//
// Wave C Slice 11d · Send-adapter interface + default ConsoleAdapter.
// --------------------------------------------------------------------
// Real providers (Resend, Postmark, Mailgun, SMTP via nodemailer) plug in
// by implementing SendAdapter and replacing DEFAULT_ADAPTER at boot.
// The doctrine: NEVER lie about delivery. ConsoleAdapter is DRY-RUN — it
// marks the send-log as "sent" honestly labelled as dry-run, so the
// merchant sees "would have delivered N" not "delivered N" until a real
// provider is wired.

export interface SendResult {
  ok: boolean;
  error?: string;
  /** Non-empty iff this send did NOT actually leave the system (dry-run). */
  dry_run_reason?: string;
}

export interface SendPayload {
  to: string;
  subject: string;
  body_text: string;
  body_html: string | null;
  /** Merchant/business context · adapters can prepend a from-name etc. */
  from_business_name?: string;
  /** Personalised unsubscribe URL to include in the footer of body. */
  unsubscribe_url: string;
}

export interface SendAdapter {
  readonly name: string;
  readonly is_dry_run: boolean;
  send(payload: SendPayload): Promise<SendResult>;
}

/** Default adapter. Logs the payload to stdout and marks OK+dry-run. */
export class ConsoleAdapter implements SendAdapter {
  readonly name = "console";
  readonly is_dry_run = true;
  async send(payload: SendPayload): Promise<SendResult> {
    console.log(
      `[nex-email · dry-run · console] to=${payload.to} subject=${JSON.stringify(payload.subject.slice(0, 60))} body_len=${payload.body_text.length} unsub=${payload.unsubscribe_url}`,
    );
    return {
      ok: true,
      dry_run_reason:
        "ConsoleAdapter · no external service configured · replace DEFAULT_ADAPTER with Resend/Postmark/SMTP",
    };
  }
}

/** Global adapter reference · export a mutable let so tests + wave 11f can swap. */
export let DEFAULT_ADAPTER: SendAdapter = new ConsoleAdapter();

/** Test / infra hook · replace the adapter at runtime (used by future Resend wire). */
export function setDefaultAdapter(adapter: SendAdapter): void {
  DEFAULT_ADAPTER = adapter;
}
