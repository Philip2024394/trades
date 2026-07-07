// OS Foundation — Notifications primitive.
//
// One Resend wrapper, one HTML template shell, one place for retry
// hooks. Every app that sends transactional email calls sendEmail()
// with a typed payload. The email body is composed from a template
// slot map — no HTML strings in app code.
//
// Not a queue on its own; delivery is synchronous within the caller's
// request. Retries + dead-letter belong on the Event Bus for events
// that trigger emails.
import "server-only";
import { Resend } from "resend";

function fromAddress(): string {
  return (
    process.env.AI_VISUALISER_FROM_EMAIL ||
    process.env.HAMMEREX_TRADE_FROM_EMAIL ||
    ""
  );
}

export type SendEmailInput = {
  to: string;
  subject: string;
  replyTo?: string;
  html: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true }
  | { ok: false; code: "not-configured" | "send-failed"; message: string };

export async function sendEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = fromAddress();
  if (!apiKey || !from) {
    console.error("[os.notifications] missing RESEND_API_KEY or from email");
    return {
      ok: false,
      code: "not-configured",
      message: "Email not configured."
    };
  }
  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text
    });
    if (result.error) {
      console.error("[os.notifications] resend error", result.error);
      return {
        ok: false,
        code: "send-failed",
        message: String(result.error.message ?? "send-failed")
      };
    }
    return { ok: true };
  } catch (err) {
    console.error("[os.notifications] resend exception", err);
    return { ok: false, code: "send-failed", message: String(err) };
  }
}

// -------------------------------------------------------------------
// HTML shell — every OS email uses this container. Individual apps
// pass a heading + optional eyebrow + body HTML fragment.
// -------------------------------------------------------------------

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailShellInput = {
  eyebrow: string;
  heading: string;
  bodyHtml: string;   // trusted — caller is responsible for escaping
  footerText?: string;
};

export function renderEmailShell(input: EmailShellInput): string {
  const footer =
    input.footerText ??
    "Sent by Xrated Trades. Every action lands on the property's Home Timeline.";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0a0a0a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0a0a0a;padding:20px 24px;">
          <div style="color:#FFB300;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">${escapeHtml(input.eyebrow)}</div>
          <div style="color:#ffffff;font-size:18px;font-weight:800;margin-top:4px;">${escapeHtml(input.heading)}</div>
        </td></tr>
        <tr><td style="padding:24px;">
          ${input.bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#888;">
          ${escapeHtml(footer)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Wrap a link as a black CTA button. Caller passes the URL raw; we escape. */
export function renderCtaButton(input: {
  href: string;
  label: string;
  variant?: "primary" | "success";
}): string {
  const bg = input.variant === "success" ? "#25D366" : "#0a0a0a";
  const color = input.variant === "success" ? "#ffffff" : "#ffffff";
  return `<a href="${escapeHtml(input.href)}" style="display:inline-block;background:${bg};color:${color};font-weight:800;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;">${escapeHtml(input.label)}</a>`;
}
