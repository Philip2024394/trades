// POST /api/payments/gocardless/onboard — GoCardless Connect onboarding
// for B2B Direct Debit (recurring trade-buyer invoicing).
//
// PHASE 5 PLACEHOLDER. Returns 501 until GoCardless Partner App
// credentials are in place. When wired:
//   - Reads GOCARDLESS_OAUTH_CLIENT_ID + GOCARDLESS_OAUTH_CLIENT_SECRET
//   - Returns the OAuth authorize URL for the merchant
//   - On return, our /api/payments/gocardless/onboard/callback exchanges
//     the code for an access token and stores the GoCardless creditor ID
//
// NOTE: Klarna + Clearpay are NOT a separate integration — they are
// payment methods that surface automatically inside Stripe Connect once
// Phase 2 ships. No separate handler needed.
//
// To activate:
//   1. Apply for GoCardless Partner App: https://manage.gocardless.com/partner-apps
//   2. Set the OAuth env vars
//   3. Replace this stub with the OAuth URL builder

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error: "gocardless_onboarding_not_yet_live",
      detail:
        "GoCardless Direct Debit integration is scaffolded but inactive until Partner App credentials are in env. Use Payment Link mode in the meantime (works with GoCardless's hosted pay links)."
    },
    { status: 501 }
  );
}
