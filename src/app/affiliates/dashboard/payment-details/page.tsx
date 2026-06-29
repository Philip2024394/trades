// Affiliate dashboard — Payment details.
//
// The single most important page for Phase 1. Captures trading status,
// legal name, country, payment method, payment-specific destination
// (bank / paypal / wise), and the three required agreement
// acknowledgements. The three agreement texts MUST appear verbatim —
// they are real commercial commitments.
import { readAffiliateSessionServer } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { WORLD_COUNTRIES } from "@/lib/worldCountries";
import { PaymentDetailsForm } from "./PaymentDetailsForm";
import { PageExplainer } from "@/components/xrated/affiliate/PageExplainer";

export const dynamic = "force-dynamic";

export default async function AffiliatePaymentDetailsPage() {
  const session = await readAffiliateSessionServer();
  if (!session) return null;
  const id = session.affiliate_id;

  const [{ data: pm }, { data: aff }] = await Promise.all([
    supabaseAdmin
      .from("hammerex_affiliate_payment_methods")
      .select("*")
      .eq("affiliate_id", id)
      .maybeSingle(),
    supabaseAdmin
      .from("hammerex_affiliates")
      .select(
        "payment_details_completed_at, tax_agreement_accepted_at, content_agreement_accepted_at, payment_timing_agreement_accepted_at"
      )
      .eq("affiliate_id", id)
      .maybeSingle()
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold sm:text-3xl">
          Payment details
        </h1>
        <p className="mt-1 text-[13px] text-brand-muted">
          Required before we can pay out. The three agreements at the
          bottom are commercial commitments — please read them in full.
        </p>
      </header>

      <PageExplainer
        title="Where we send your earnings"
        description="Once your earnings cross £50, we pay out monthly. You only need to fill this in once. We never charge a fee. Standard bank transfer fees apply (your bank, our bank, intermediaries)."
        steps={[
          "Pick how you want paid — bank / PayPal / Wise",
          "Add the account details",
          "Accept the 3 agreements",
          "Wait for your next monthly payout"
        ]}
      />

      <p className="text-[12px] text-neutral-500">
        Your account details are encrypted at rest and only used to send
        you payouts. We never share them with anyone.
      </p>

      <PaymentDetailsForm
        countries={WORLD_COUNTRIES.map((c) => c.name)}
        initial={pm ?? null}
        agreements={{
          tax: Boolean(aff?.tax_agreement_accepted_at),
          content: Boolean(aff?.content_agreement_accepted_at),
          timing: Boolean(aff?.payment_timing_agreement_accepted_at)
        }}
        completedAt={aff?.payment_details_completed_at ?? null}
      />
    </div>
  );
}
