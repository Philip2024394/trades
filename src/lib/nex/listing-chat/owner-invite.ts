// src/lib/nex/listing-chat/owner-invite.ts
//
// Founder Phase 31 · P31-3 · Owner-invite email composer.
//
// Composes the "you have a NEX Directory visitor asking about your
// services" email. Doctrine #7 rule: we quote ONLY the first message
// from the visitor — never later messages, never other visitors' threads.

import { enqueueEmail, isConfigured, type EnqueueResult } from "./smtp";
import { issueOwnerInvite } from "./index";

export interface OwnerInviteInput {
  thread_id: string;
  listing_ref: string;
  listing_business_name: string;
  owner_email: string;
  first_message_body: string;
  base_url: string;                     // e.g. "http://localhost:3008"
}

export async function sendOwnerInviteEmail(input: OwnerInviteInput): Promise<{
  invite_token: string;
  reply_url: string;
  email: EnqueueResult;
  smtp_configured: boolean;
}> {
  const invite = await issueOwnerInvite({
    thread_id: input.thread_id,
    listing_ref: input.listing_ref,
    owner_email: input.owner_email,
  });
  const reply_url = `${input.base_url.replace(/\/$/, "")}/nexapp/owner-inbox/${invite.invite_token}`;

  // Doctrine #7 · quote only the first message from the sender.
  const quoted = input.first_message_body.trim().slice(0, 500);

  const subject = `A NEX Directory visitor is asking about ${input.listing_business_name}`;
  const bodyText =
`Hello,

A visitor on NEX Directory has just sent a message about your business "${input.listing_business_name}".

They wrote:
"${quoted}"

To read the full message and reply — no signup required — open:
${reply_url}

Your reply goes straight back to the visitor inside NEX. NEX Chat replaces WhatsApp for this conversation: it keeps a record you can search, works from any device, and no phone number is shared.

If you'd like NEX Chat on your phone home screen, the reply page will offer a one-tap "Add to Home Screen" prompt after you log in.

This invitation expires in 30 days.

— NEX Directory
`;

  const bodyHtml =
`<p>Hello,</p>
<p>A visitor on <strong>NEX Directory</strong> has just sent a message about your business <strong>${escapeHtml(input.listing_business_name)}</strong>.</p>
<p>They wrote:</p>
<blockquote style="border-left:3px solid #d4d4d8;padding-left:12px;color:#3f3f46;margin:12px 0;">
${escapeHtml(quoted)}
</blockquote>
<p>To read the full message and reply — no signup required — open:</p>
<p><a href="${reply_url}" style="background:#166534;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">Reply on NEX Chat →</a></p>
<p style="color:#52525b;font-size:14px;">Your reply goes straight back to the visitor inside NEX. NEX Chat replaces WhatsApp for this conversation: it keeps a record you can search, works from any device, and no phone number is shared.</p>
<p style="color:#52525b;font-size:14px;">If you'd like NEX Chat on your phone home screen, the reply page will offer a one-tap "Add to Home Screen" prompt after you log in.</p>
<p style="color:#a1a1aa;font-size:12px;">This invitation expires in 30 days.</p>
<p style="color:#a1a1aa;font-size:12px;">— NEX Directory</p>`;

  const email = await enqueueEmail({
    purpose: "owner_invite",
    to_email: input.owner_email,
    subject,
    body_text: bodyText,
    body_html: bodyHtml,
    related_thread_id: input.thread_id,
  });

  return {
    invite_token: invite.invite_token,
    reply_url,
    email,
    smtp_configured: isConfigured(),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
