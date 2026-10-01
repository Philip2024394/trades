// src/app/nex-native/affiliate/join/page.tsx
//
// NEX Affiliate Network · join page · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Real production entry point for the first-user "Join Affiliate"
// path. Explains the programme, requires terms acceptance, and
// creates the authoritative nex_affiliate_account row via the
// joinAffiliateAction Server Action.
//
// Idempotent: if the viewer is already an affiliate, bounce them to
// the dashboard rather than show the join form again.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { isAffiliateAccount } from "@/lib/nex-native/affiliate-service";
import { joinAffiliateAction } from "../../_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  border: "rgba(139,169,209,0.18)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.35)",
  orange: "#FF7800",
  green: "#8FFF6E",
};

export default async function AffiliateJoinPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  // Already joined · straight to the dashboard.
  if (await isAffiliateAccount(session.account.id)) {
    redirect("/nex-native/affiliate");
  }
  const sp = (await searchParams) ?? {};
  const errorMsg =
    sp.error === "terms_required"
      ? "You need to accept the programme terms before joining."
      : null;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <main
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding:
            "calc(env(safe-area-inset-top, 0) + 32px) 20px 60px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          NEX Affiliate Network
        </div>
        <h1
          style={{
            margin: "0 0 16px",
            fontSize: "clamp(26px, 5vw, 40px)",
            fontWeight: 500,
            lineHeight: 1.1,
          }}
        >
          Earn from products you recommend.
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 15,
            lineHeight: 1.6,
            color: NEX.textDim,
          }}
        >
          Join NEX as an affiliate · pick sellers whose products you
          like · NEX gives you a shop that rotates their eligible
          products · when someone buys through your attribution you
          earn commission.
        </p>

        <section
          style={{
            background: NEX.panel,
            border: `1px solid ${NEX.border}`,
            borderRadius: 16,
            padding: "20px",
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}>
            How it works
          </h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              color: NEX.textDim,
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            <li>Sellers choose to join · they set their own catalogue.</li>
            <li>
              You pick sellers from the Affiliate Marketplace · their
              live products appear in your affiliate shop.
            </li>
            <li>
              Sellers pay a flat{" "}
              <strong style={{ color: NEX.green }}>10%</strong>{" "}
              commission on every qualifying sale driven through an
              affiliate shop. The seller pays commission directly from
              their own payment method.
            </li>
            <li>
              Of that 10%, <strong>7% always goes to the affiliate who
              drove the sale</strong>. The remaining{" "}
              <strong style={{ color: NEX.green }}>3%</strong> goes to{" "}
              <strong>whoever recruited that affiliate</strong> into
              NEX — one level up only.
            </li>
            <li>
              If you joined NEX on your own with no recruiter, the 3%
              goes to NEX as the default upline. If you recruit a
              friend, you earn that 3% on every one of their sales.
              Recruit two friends, you earn 3% on both of their sales
              streams · and so on, for every direct recruit you bring
              in.
            </li>
            <li>
              Commission is only earned on QUALIFYING sales · never on
              recruitment alone.
            </li>
            <li>
              Payouts happen once your confirmed balance with a seller
              reaches <strong>Rp 50,000</strong> — the seller pays you
              directly using their own payment method.
            </li>
          </ul>
        </section>

        <section
          style={{
            background: NEX.panel,
            border: `1px solid ${NEX.border}`,
            borderRadius: 16,
            padding: "20px",
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}>
            What NEX does — and doesn't do
          </h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              color: NEX.textDim,
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            <li>
              <strong style={{ color: NEX.text }}>NEX records</strong>{" "}
              attribution, calculates commission, maintains the ledger,
              and provides evidence for disputes.
            </li>
            <li>
              <strong style={{ color: NEX.text }}>NEX does NOT</strong>{" "}
              hold affiliate funds · does NOT transfer money from
              seller to affiliate · the seller pays you directly.
            </li>
            <li>
              NEX cannot guarantee a seller will pay · it can only
              provide the evidence trail if a payment is disputed.
            </li>
          </ul>
          <p
            style={{
              marginTop: 14,
              marginBottom: 0,
              fontSize: 11,
              color: NEX.textMute,
              lineHeight: 1.5,
              fontStyle: "italic",
            }}
          >
            For the full programme terms see the NEX Terms of Use.
            Applicable taxes remain the responsibility of the relevant
            parties according to applicable law.
          </p>
        </section>

        {errorMsg && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(255,120,0,0.14)",
              border: `1px solid ${NEX.orange}`,
              color: NEX.orange,
              fontSize: 13,
            }}
          >
            {errorMsg}
          </div>
        )}

        <form action={joinAffiliateAction}>
          <label
            htmlFor="terms_accepted"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "14px",
              borderRadius: 12,
              background: "rgba(0,175,255,0.08)",
              border: `1px solid ${NEX.cyanSoft}`,
              cursor: "pointer",
              marginBottom: 16,
            }}
          >
            <input
              id="terms_accepted"
              name="terms_accepted"
              type="checkbox"
              value="1"
              required
              style={{ marginTop: 3, width: 16, height: 16 }}
            />
            <span style={{ fontSize: 13, lineHeight: 1.5, color: NEX.text }}>
              I accept the NEX Affiliate Programme terms · I understand
              sellers pay a flat 10% commission split 7% to the
              direct affiliate + 3% to the recruiter (one level up only,
              or NEX if there's no recruiter), and that NEX does not
              hold or transfer affiliate funds — sellers pay commission
              directly.
            </span>
          </label>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="submit"
              style={{
                padding: "12px 24px",
                borderRadius: 999,
                background: `linear-gradient(180deg, ${NEX.cyan} 0%, #0073b8 100%)`,
                border: "none",
                color: "#FFF",
                fontSize: 13,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 10px 24px rgba(0,175,255,0.3)",
              }}
            >
              Join NEX Affiliate Network
            </button>
            <Link
              href="/nex-native/chat"
              style={{
                padding: "12px 24px",
                borderRadius: 999,
                background: "transparent",
                border: `1px solid ${NEX.border}`,
                color: NEX.textDim,
                fontSize: 13,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Not now
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
