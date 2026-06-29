// Sends a "complete your payment details" email to every affiliate
// whose approved-commission balance is >= £50 AND
// payment_details_completed_at IS NULL. Run manually each month
// after the 28th — or wire to a Vercel cron job later.
//
// Reads RESEND_API_KEY from .env.local. Gracefully no-ops (warning
// only) if the key is missing.
import { readFileSync } from "node:fs";

function readEnvVal(path, key) {
  const txt = readFileSync(path, "utf-8");
  const m = txt.match(new RegExp(`^${key}=(.+)$`, "m"));
  return m ? m[1].trim().replace(/^"|"$/g, "") : null;
}

const envLocal = "C:\\Users\\Victus\\trades\\.env.local";
const supabaseUrl = readEnvVal(envLocal, "NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = readEnvVal(envLocal, "SUPABASE_SERVICE_ROLE_KEY");
const resendKey = readEnvVal(envLocal, "RESEND_API_KEY");
const fromEmail =
  readEnvVal(envLocal, "HAMMEREX_TRADE_FROM_EMAIL") ||
  "Xrated Trades <noreply@xratedtrade.com>";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}
if (!resendKey) {
  console.warn(
    "RESEND_API_KEY not set in .env.local — would email but skipping."
  );
}

const headers = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`,
  "Content-Type": "application/json"
};

// Pull every active affiliate.
const affRes = await fetch(
  `${supabaseUrl}/rest/v1/hammerex_affiliates?status=eq.active&select=affiliate_id,email,first_name,payment_details_completed_at,payment_alert_flag`,
  { headers }
);
const affs = await affRes.json();
let sent = 0;
for (const a of affs) {
  if (a.payment_details_completed_at) continue;
  // Approved-commission sum.
  const cRes = await fetch(
    `${supabaseUrl}/rest/v1/hammerex_affiliate_commissions?affiliate_id=eq.${a.affiliate_id}&status=eq.approved&select=amount_pence`,
    { headers }
  );
  const cs = await cRes.json();
  const total = cs.reduce((sum, c) => sum + c.amount_pence, 0);
  if (total < 5000) continue;
  if (!a.email) continue;

  if (!resendKey) {
    console.log(`Would email #${a.affiliate_id} ${a.email}: £${(total / 100).toFixed(2)}`);
    continue;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [a.email],
      subject: `You have £${(total / 100).toFixed(2)} waiting — complete your payment details`,
      html: `<p style="font-family:system-ui,sans-serif;font-size:13px;">Hi${a.first_name ? " " + a.first_name : ""}, you have £${(total / 100).toFixed(2)} of approved commission with us. Complete your payment details so we can pay it out: <a href="https://xratedtrade.com/affiliates/dashboard/payment-details">xratedtrade.com/affiliates/dashboard/payment-details</a></p>`
    })
  });
  if (r.ok) {
    sent += 1;
    console.log(
      `Emailed #${a.affiliate_id} ${a.email}: £${(total / 100).toFixed(2)}`
    );
  } else {
    console.error(
      `Failed for #${a.affiliate_id}:`,
      r.status,
      await r.text()
    );
  }
}
console.log(`Done. ${sent} alerts sent.`);
