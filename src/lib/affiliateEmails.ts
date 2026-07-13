// Affiliate-side transactional email helpers. All functions are
// best-effort: if RESEND_API_KEY isn't set we log a warning and skip
// the send, so dev environments never fail signup just because email
// isn't wired. The actual triggering happens from the API routes.
import "server-only";

type AffiliateLite = {
  affiliate_id: number;
  email?: string | null;
  first_name?: string | null;
};

const FROM_DEFAULT = "Xrated Trades <noreply@thenetworkers.app>";

function fromAddress(): string {
  return (
    process.env.HAMMEREX_TRADE_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    FROM_DEFAULT
  );
}

async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(
      `[affiliateEmails] RESEND_API_KEY not set — skipping email "${opts.subject}" to ${opts.to}`
    );
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [opts.to],
        subject: opts.subject,
        html: opts.html
      })
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(
        `[affiliateEmails] Resend ${res.status} sending "${opts.subject}":`,
        txt
      );
    }
  } catch (err) {
    console.error(
      `[affiliateEmails] threw sending "${opts.subject}":`,
      err
    );
  }
}

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function shell(html: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#000;color:#fff;padding:24px;">${html}<p style="font-size:13px;color:#888;margin-top:24px;">— Xrated Trades · thenetworkers.app</p></body></html>`;
}

export async function sendWelcomeEmail(a: AffiliateLite): Promise<void> {
  if (!a.email) return; // No email yet — first signup may skip this.
  await sendViaResend({
    to: a.email,
    subject: "Welcome to the Xrated Trades Affiliate Programme",
    html: shell(
      `<h2 style="color:#FFB300;font-size:20px;">Welcome aboard.</h2>
       <p style="font-size:13px;">Your affiliate ID is <strong>${a.affiliate_id}</strong>. Your permanent link:</p>
       <p style="font-size:13px;"><a href="https://thenetworkers.app/?ref=${a.affiliate_id}" style="color:#FFB300;">https://thenetworkers.app/?ref=${a.affiliate_id}</a></p>
       <p style="font-size:13px;">Share that link. When someone signs up as a tradesperson via it and upgrades, you earn £10.</p>`
    )
  });
}

export async function sendNewReferralEmail(
  a: AffiliateLite,
  listing: { slug: string; display_name: string | null }
): Promise<void> {
  if (!a.email) return;
  await sendViaResend({
    to: a.email,
    subject: "New referral on your affiliate link",
    html: shell(
      `<h2 style="color:#FFB300;font-size:20px;">A new tradesperson signed up via your link.</h2>
       <p style="font-size:13px;"><strong>${listing.display_name ?? listing.slug}</strong> joined Xrated Trades.</p>
       <p style="font-size:13px;">If they upgrade to a paid plan, you'll earn £10. Track progress in your dashboard.</p>`
    )
  });
}

export async function sendCommissionApprovedEmail(
  a: AffiliateLite,
  commission: { amount_pence: number }
): Promise<void> {
  if (!a.email) return;
  await sendViaResend({
    to: a.email,
    subject: `Commission approved: ${pounds(commission.amount_pence)}`,
    html: shell(
      `<h2 style="color:#FFB300;font-size:20px;">Commission approved.</h2>
       <p style="font-size:13px;">${pounds(commission.amount_pence)} has been moved from Pending to Approved. It will be paid in the next monthly payout cycle, subject to the £50 minimum.</p>`
    )
  });
}

export async function sendCommissionPaidEmail(
  a: AffiliateLite,
  payout: { total_pence: number; reference: string | null }
): Promise<void> {
  if (!a.email) return;
  await sendViaResend({
    to: a.email,
    subject: `Payout sent: ${pounds(payout.total_pence)}`,
    html: shell(
      `<h2 style="color:#FFB300;font-size:20px;">Payout sent.</h2>
       <p style="font-size:13px;">${pounds(payout.total_pence)} has been paid to you.${payout.reference ? ` Reference: <code>${payout.reference}</code>.` : ""}</p>
       <p style="font-size:13px;">Standard banking fees may have been deducted in transit.</p>`
    )
  });
}

export async function sendPasswordResetEmail(
  a: AffiliateLite,
  recoveryUrl: string
): Promise<void> {
  if (!a.email) return;
  await sendViaResend({
    to: a.email,
    subject: "Reset your Xrated Trades affiliate password",
    html: shell(
      `<h2 style="color:#FFB300;font-size:20px;">Reset your password.</h2>
       <p style="font-size:13px;">Click the link below to set a new password. It expires in 30 minutes.</p>
       <p style="font-size:13px;"><a href="${recoveryUrl}" style="color:#FFB300;">${recoveryUrl}</a></p>`
    )
  });
}

export async function sendLevelPromotedEmail(
  a: AffiliateLite,
  newLevel: "bronze" | "silver" | "gold" | "platinum"
): Promise<void> {
  if (!a.email) return;
  const label = newLevel.charAt(0).toUpperCase() + newLevel.slice(1);
  await sendViaResend({
    to: a.email,
    subject: `You've reached ${label}!`,
    html: shell(
      `<h2 style="color:#FFB300;font-size:20px;">Welcome to ${label}.</h2>
       <p style="font-size:13px;">Congratulations — you've levelled up on the Xrated Trades Affiliate Programme. ${label}-tier perks are now unlocked on your dashboard, including exclusive marketing assets gated to your new level.</p>
       <p style="font-size:13px;"><a href="https://thenetworkers.app/affiliates/dashboard" style="color:#FFB300;">Open your dashboard →</a></p>`
    )
  });
}

export async function sendPaymentDetailsNeededEmail(
  a: AffiliateLite,
  amount_pence: number
): Promise<void> {
  if (!a.email) return;
  await sendViaResend({
    to: a.email,
    subject: `Action required: complete payment details to receive ${pounds(amount_pence)}`,
    html: shell(
      `<h2 style="color:#FFB300;font-size:20px;">You have ${pounds(amount_pence)} waiting.</h2>
       <p style="font-size:13px;">Your approved commission balance is ${pounds(amount_pence)}, but we can't pay you until your payment details are on file.</p>
       <p style="font-size:13px;"><a href="https://thenetworkers.app/affiliates/dashboard/payment-details" style="color:#FFB300;">Complete your payment details →</a></p>`
    )
  });
}
