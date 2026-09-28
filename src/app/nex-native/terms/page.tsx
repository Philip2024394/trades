// src/app/nex-native/terms/page.tsx
//
// Bridge 16b · NEX Terms of Service · public.
// -------------------------------------------
// The canonical legal terms. Written in plain English (with Bahasa
// Indonesia translation queued for a follow-up bridge). The safe-
// trade doctrine is the load-bearing centrepiece: NEX never handles
// payments, therefore NEX does not mediate off-doctrine payment
// disputes.
//
// Consumed by:
//   · The JIT SafeTradeConsentModal (peer chat first entry into a
//     commerce chat) · a link plus a required-tick box
//   · Footer link on shop landings and packages page
//   · Support flows

import type * as React from "react";
import Link from "next/link";
import { CURRENT_SAFE_TRADE_TERMS_VERSION } from "@/lib/nex-native/safe-trade-consent-service";

export const runtime = "nodejs";
export const dynamic = "force-static";

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  orangeSoft: "rgba(255,114,0,0.6)",
  green: "#16D66B",
  red: "#FF3355",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const metadata = {
  title: "NEX · Terms of Service",
  description:
    "The rules of using NEX. Plain English. NEX never handles payments · buyers stay safe by using COD or third-party escrow · off-doctrine payments are not mediated by NEX support.",
};

export default function TermsPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        paddingBottom: 80,
      }}
    >
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0) + 14px) 20px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${NEX.border}`,
        }}
      >
        <Link
          href="/nex-native"
          style={{
            fontSize: 11,
            color: NEX.textDim,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          ← NEX
        </Link>
        <div style={{ display: "flex", gap: 16 }}>
          <Link
            href="/nex-native/support"
            style={{
              fontSize: 11,
              color: NEX.textDim,
              textDecoration: "none",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Support ↗
          </Link>
          <Link
            href="/nex-native/safe-trade"
            style={{
              fontSize: 11,
              color: NEX.cyan,
              textDecoration: "none",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Safe trade ↗
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
        {/* --- Hero -------------------------------------------------- */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: NEX.orange,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            NEX terms of service
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: 44,
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
              fontWeight: 500,
              marginBottom: 12,
            }}
          >
            Plain rules for a fair place.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.65,
              color: NEX.textDim,
            }}
          >
            Version{" "}
            <b style={{ color: NEX.text }}>
              {CURRENT_SAFE_TRADE_TERMS_VERSION}
            </b>
            · Sealed 2026-09-28 · By using NEX you agree to what&apos;s below.
          </p>
        </div>

        {/* --- 1 · The Safe-Trade Doctrine (the important part) -------- */}
        <TermSection
          num="1"
          title="How money works on NEX"
          tone="critical"
        >
          <p>
            <b>NEX is not a payment platform.</b> NEX has no wallet, no
            escrow, no processing fee, no stored card details, and no
            way to collect, hold, or move money on behalf of any user.
          </p>
          <p>
            You pay the seller <b>directly</b>, or you pay a{" "}
            <b>third-party escrow provider</b> the seller and you both
            agree on. NEX only holds the conversation record.
          </p>
          <p>
            NEX charges <b>0% commission</b> on sales, on both Gratis and
            Bisnis tiers, forever. This is possible <em>because</em> NEX
            never touches your money · the two facts are the same fact.
          </p>
        </TermSection>

        {/* --- 2 · The five safe payment paths ---------------------- */}
        <TermSection
          num="2"
          title="The five NEX-supported payment paths"
        >
          <p>
            When you use NEX, we recommend and support these five paths,
            and only these five. All of them satisfy one rule:{" "}
            <b>you never pay before you receive, unless a third party
            you trust is holding the money.</b>
          </p>
          <ul style={ulStyle}>
            <li>
              <b>💵 Cash on Delivery (COD)</b> · driver collects rupiah
              cash when they hand you the package.
            </li>
            <li>
              <b>📱 QRIS on Delivery</b> · you scan the seller&apos;s or
              driver&apos;s QR code when the package arrives.
            </li>
            <li>
              <b>📦 Courier COD</b> · JNE / J&amp;T / SiCepat / AnterAja
              collects on delivery and remits to the seller · the courier
              acts as informal escrow.
            </li>
            <li>
              <b>🤝 Meet in Person</b> · you visit the seller, inspect
              the item, and pay cash on the spot.
            </li>
            <li>
              <b>🔒 Escrow (Rekber / Xendit / Midtrans / DOKU / PayPal
              G&amp;S)</b> · you transfer to the escrow provider, they
              hold, seller ships, you confirm, they release.
            </li>
          </ul>
          <p>
            Full breakdown at{" "}
            <Link
              href="/nex-native/safe-trade"
              style={{ color: NEX.cyan, textDecoration: "none" }}
            >
              /nex-native/safe-trade
            </Link>
            .
          </p>
        </TermSection>

        {/* --- 3 · Off-doctrine · what NEX won't mediate ------------- */}
        <TermSection
          num="3"
          title="What NEX will NOT mediate"
          tone="critical"
        >
          <p>
            If you choose to pay a seller using any method{" "}
            <b>not on the list in section 2</b> — for example, transferring
            directly to a seller&apos;s private bank account or e-wallet
            before receiving the goods — <b>NEX support will not intervene
            in disputes about that payment</b>.
          </p>
          <p>Specifically, NEX will NOT:</p>
          <ul style={ulStyle}>
            <li>Refund you</li>
            <li>Chase the seller for repayment</li>
            <li>Contact the seller&apos;s bank</li>
            <li>File a police report on your behalf</li>
            <li>Mediate a dispute over an off-doctrine payment</li>
          </ul>
          <p>
            NEX will still preserve the conversation as evidence. You may
            use the chat log yourself to file a bank dispute, police
            report, or civil claim under Indonesian consumer protection
            law · but the choice to pay off-doctrine, and any loss that
            follows, is yours alone.
          </p>
          <p>
            When the app detects a seller asking for direct payment before
            delivery, we show you a red warning in the chat. Read it. If
            you proceed anyway, you have agreed to this section.
          </p>
        </TermSection>

        {/* --- 4 · What NEX will help with -------------------------- */}
        <TermSection
          num="4"
          title="What NEX will help with"
          tone="ok"
        >
          <ul style={ulStyle}>
            <li>
              Reporting a seller who scams or ships gross fakes · we
              suspend their listings after enough verified reports.
            </li>
            <li>
              Snapshotting a conversation as evidence when you file a
              report or dispute · one-tap export of the full chat.
            </li>
            <li>
              Bugs in NEX itself · anything that breaks the promise in
              section 1, section 2, or section 8 (privacy).
            </li>
            <li>
              Billing questions about your own NEX subscription (Bisnis).
            </li>
          </ul>
        </TermSection>

        {/* --- 5 · What NEX charges --------------------------------- */}
        <TermSection num="5" title="What NEX charges">
          <p>
            <b>NEX Gratis · Rp 0/mo forever.</b> No commission, no listing
            fee, no chat fee.
          </p>
          <p>
            <b>NEX Bisnis · Rp 99,000/mo</b> (or Rp 990,000/year). Unlocks
            international export, verified badge, featured chip, unlimited
            caps, and up to five businesses under one account. Still 0%
            commission on sales. The Bisnis subscription itself is paid
            via bank transfer or e-wallet directly to the NEX operating
            account · we do not process the payment through a NEX-hosted
            rail.
          </p>
          <p>
            Full details at{" "}
            <Link
              href="/nex-native/packages"
              style={{ color: NEX.cyan, textDecoration: "none" }}
            >
              /nex-native/packages
            </Link>
            .
          </p>
        </TermSection>

        {/* --- 6 · Content + conduct rules -------------------------- */}
        <TermSection num="6" title="Content and conduct">
          <p>You agree not to:</p>
          <ul style={ulStyle}>
            <li>Sell illegal goods · drugs, weapons, endangered wildlife, counterfeit currency, stolen goods.</li>
            <li>Impersonate someone else · sellers must trade under their real identity or a clearly-declared business name.</li>
            <li>Harass, threaten, or scam other users.</li>
            <li>Post spam, viruses, phishing links, or malware.</li>
            <li>Ask a buyer to move payment off NEX to a hostile channel (e.g. &quot;transfer to my WhatsApp then delete this chat&quot;).</li>
            <li>Circumvent the safe-trade doctrine by pressuring a buyer to pay off-doctrine · we treat this as a scam signal.</li>
          </ul>
          <p>
            Violations result in a suspended listing, then a suspended
            account. Repeat offenders are permanently banned. NEX
            cooperates with Indonesian law enforcement when required.
          </p>
        </TermSection>

        {/* --- 7 · Reviews + reputation ----------------------------- */}
        <TermSection num="7" title="Reviews and reputation">
          <p>
            Buyers may leave a review after each order. Reviews are
            permanent · they cannot be deleted by the seller. False
            reviews (paid reviews, retaliatory reviews, bot reviews) can
            be reported and are removed. The seller may respond publicly
            to a review but cannot suppress it.
          </p>
        </TermSection>

        {/* --- 8 · Privacy ------------------------------------------ */}
        <TermSection num="8" title="Your data">
          <p>
            NEX stores your account details, your chats (peer-to-peer,
            encrypted at rest by Supabase), your listings, and your
            activity signals (last seen, response time). We do not sell
            your data. We do not share your chats with third parties
            except when compelled by an Indonesian court order.
          </p>
          <p>
            You can request a full data export at any time via support.
            You can delete your account · after 30 days your account is
            wiped, your listings archived, your chats retained (both
            sides need them as receipts).
          </p>
        </TermSection>

        {/* --- 9 · Changes to these terms --------------------------- */}
        <TermSection num="9" title="When we update these terms">
          <p>
            When the safe-trade doctrine or any material term changes,
            we bump the version number at the top of this page and
            re-prompt every user with a fresh consent modal on their
            next commerce action. You will always know what you
            agreed to and when.
          </p>
          <p>
            Historical versions are preserved in the git history of the
            NEX repository · both parties can go back and check what
            was in force when their trade happened.
          </p>
        </TermSection>

        {/* --- 10 · Governing law + contact ------------------------- */}
        <TermSection num="10" title="Governing law and contact">
          <p>
            These terms are governed by the laws of the Republic of
            Indonesia. Disputes not resolved by NEX support may be filed
            with the appropriate Indonesian courts.
          </p>
          <p>
            Questions about these terms: reach out via the NEX support
            channel or email hello at nex.id (placeholder · production
            address TBD).
          </p>
        </TermSection>

        {/* --- The one-line promise (again, at the bottom) --------- */}
        <div
          style={{
            marginTop: 48,
            padding: "26px 24px",
            borderRadius: 18,
            background:
              "linear-gradient(180deg, rgba(22,214,107,0.10) 0%, rgba(22,214,107,0.04) 100%)",
            border: `1px solid rgba(22,214,107,0.35)`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: NEX.green,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            🛡 The one-line promise
          </div>
          <p
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: 22,
              lineHeight: 1.35,
              fontWeight: 500,
              letterSpacing: "-0.005em",
              color: NEX.text,
            }}
          >
            You never pay before you receive
            <br />
            <span style={{ color: NEX.green }}>—</span> unless a third
            party you trust is holding the money.
          </p>
        </div>
      </main>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Sub-components                                                        *
 * --------------------------------------------------------------------- */

function TermSection({
  num,
  title,
  tone = "default",
  children,
}: {
  num: string;
  title: string;
  tone?: "default" | "critical" | "ok";
  children: React.ReactNode;
}) {
  const border =
    tone === "critical"
      ? "rgba(255,51,85,0.30)"
      : tone === "ok"
        ? "rgba(22,214,107,0.30)"
        : NEX.border;
  const eyebrow =
    tone === "critical" ? NEX.red : tone === "ok" ? NEX.green : NEX.cyan;
  return (
    <section
      style={{
        marginBottom: 22,
        padding: "22px 22px",
        borderRadius: 16,
        background: NEX.panelSoft,
        border: `1px solid ${border}`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: eyebrow,
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        Section {num}
      </div>
      <h2
        style={{
          margin: "2px 0 12px",
          fontFamily: SERIF,
          fontSize: 24,
          lineHeight: 1.2,
          fontWeight: 500,
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          color: "rgba(244,247,252,0.88)",
        }}
      >
        {children}
      </div>
    </section>
  );
}

const ulStyle: React.CSSProperties = {
  margin: "8px 0 12px",
  padding: "0 0 0 20px",
  fontSize: 14,
  lineHeight: 1.7,
  color: "rgba(244,247,252,0.88)",
};
