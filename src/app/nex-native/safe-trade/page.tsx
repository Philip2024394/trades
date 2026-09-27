// src/app/nex-native/safe-trade/page.tsx
//
// Bridge 16a · Safe-trade explainer · public page.
// ------------------------------------------------
// Canonical explanation of how NEX keeps buyers safe without ever
// handling money. Linked from every shop landing chip strip, from
// /manage/shop, from /packages, and from chat warning bubbles when
// a seller pastes bank/QR before delivery.
//
// Doctrine reference: doctrine_nex_never_handles_payments_2026_09_28
//
// Deliberately editorial · dark navy + serif display + orange +
// cyan · matches the visitor-facing NEX identity established on
// the shop landing pages.

import type * as React from "react";
import Link from "next/link";
import {
  NEX_PAYMENT_METHODS,
  NEX_PAYMENT_METHOD_META,
} from "@/lib/nex-native/business-service";

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
  amber: "#F59E0B",
  red: "#FF3355",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const metadata = {
  title: "Safe trade on NEX · you never pay before you receive",
  description:
    "On NEX, buyers never pay before they receive — unless a third party they already trust is holding the money. Five payment paths, all buyer-safe. NEX never touches funds.",
};

export default function SafeTradePage() {
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
      {/* Top nav */}
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
        <Link
          href="/nex-native/packages"
          style={{
            fontSize: 11,
            color: NEX.cyan,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          Packages ↗
        </Link>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
        {/* --- Hero --------------------------------------------------- */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: NEX.green,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            🛡 Safe trade on NEX
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: 44,
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
              fontWeight: 500,
              marginBottom: 20,
            }}
          >
            You never pay before you receive.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              lineHeight: 1.6,
              color: "rgba(244,247,252,0.85)",
              marginBottom: 12,
            }}
          >
            On NEX, buyers never send money to a seller before receiving
            the goods · <b>unless a third party the buyer already trusts
            is holding the money</b>.
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: NEX.textDim,
            }}
          >
            NEX itself never touches funds. No wallet, no escrow, no
            processing fee, no stored card details. We just connect
            buyers and sellers and preserve the conversation as the
            receipt.
          </p>
        </div>

        {/* --- The five options ------------------------------------- */}
        <section style={{ marginBottom: 40 }}>
          <SectionEyebrow color={NEX.cyan}>Your five options</SectionEyebrow>
          <h2 style={sectionH2}>Every option keeps you safe</h2>
          <p style={sectionLede}>
            Two tiers. Four ways to pay when you receive. Two ways to
            pay in advance with a third party holding the money for you.
          </p>

          <div style={{ marginTop: 24 }}>
            <TierHead color={NEX.green}>
              Tier 1 · Pay when you receive
            </TierHead>
            <p
              style={{
                margin: "6px 0 20px",
                fontSize: 13,
                color: NEX.textDim,
                lineHeight: 1.55,
              }}
            >
              You do not release any money until the goods are in your
              hands.
            </p>
            <div style={{ display: "grid", gap: 12 }}>
              {NEX_PAYMENT_METHODS.slice(0, 4).map((m) => (
                <ChipRow key={m} slug={m} tone="safe" />
              ))}
            </div>
          </div>

          <div style={{ marginTop: 36 }}>
            <TierHead color={NEX.cyan}>
              Tier 2 · Pay in advance safely
            </TierHead>
            <p
              style={{
                margin: "6px 0 20px",
                fontSize: 13,
                color: NEX.textDim,
                lineHeight: 1.55,
              }}
            >
              A third party you already trust holds the money · they
              only release it to the seller after you confirm you
              received what you ordered.
            </p>
            <div style={{ display: "grid", gap: 12 }}>
              {NEX_PAYMENT_METHODS.slice(4).map((m) => (
                <ChipRow key={m} slug={m} tone="escrow" />
              ))}
            </div>
          </div>
        </section>

        {/* --- Warning · direct transfer --------------------------- */}
        <section
          style={{
            marginBottom: 40,
            padding: "24px 22px",
            borderRadius: 18,
            background: "rgba(255,51,85,0.06)",
            border: `1px solid rgba(255,51,85,0.35)`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: NEX.red,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            ⚠ Never do this
          </div>
          <h2 style={{ ...sectionH2, marginTop: 0 }}>
            Direct bank transfer before delivery
          </h2>
          <p
            style={{
              margin: "0 0 14px",
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(244,247,252,0.9)",
            }}
          >
            If a seller asks you to transfer money to their private
            bank account or e-wallet <b>before</b> they ship the goods,
            NEX cannot protect you. You are outside every safe path.
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.6,
              color: NEX.textDim,
            }}
          >
            NEX will show you a red warning in the chat when this
            happens. Ask the seller for <b>COD</b> or <b>Escrow
            (Rekber)</b> instead. If they refuse both, walk away · a
            legitimate seller has nothing to lose by using a safe path.
          </p>
        </section>

        {/* --- How escrow works ------------------------------------ */}
        <section style={{ marginBottom: 40 }}>
          <SectionEyebrow color={NEX.orange}>How escrow works</SectionEyebrow>
          <h2 style={sectionH2}>The third party holds, then releases</h2>
          <ol
            style={{
              padding: "0 0 0 20px",
              margin: "12px 0 0",
              fontSize: 14,
              lineHeight: 1.7,
              color: "rgba(244,247,252,0.88)",
            }}
          >
            <li>You transfer the money to the <b>escrow provider</b>, not to the seller.</li>
            <li>The escrow notifies the seller: <em>"funds received · you may ship"</em>.</li>
            <li>Seller ships the goods and posts the tracking number into the chat.</li>
            <li>You receive the package. Inspect it.</li>
            <li>You tell the escrow provider: <em>"received, release the funds"</em>.</li>
            <li>The escrow releases to the seller. Typically same day or T+1.</li>
          </ol>
          <p
            style={{
              margin: "20px 0 0",
              fontSize: 13,
              color: NEX.textDim,
              lineHeight: 1.6,
            }}
          >
            If something goes wrong · package never arrives, or it is
            grossly not as described · the escrow provider holds a
            dispute process and can refund you.
          </p>
        </section>

        {/* --- Escrow providers ------------------------------------ */}
        <section style={{ marginBottom: 40 }}>
          <SectionEyebrow color={NEX.orange}>
            Escrow providers we recommend
          </SectionEyebrow>
          <h2 style={sectionH2}>Regulated, auditable, and cheap</h2>
          <p style={sectionLede}>
            NEX links to third-party escrow providers we do not run.
            Pick one you or the seller already trusts.
          </p>
          <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
            <ProviderRow
              name="Xendit"
              tag="Licensed Indonesian PSP"
              fee="~2-3% + fixed"
              blurb="Full escrow API with real dispute process. Requires seller KYC. Best for verified Bisnis sellers doing volume."
            />
            <ProviderRow
              name="Midtrans (GoTo)"
              tag="Licensed Indonesian PSP"
              fee="~2-3% + fixed"
              blurb="Part of the GoTo group. Widely used by Indonesian e-commerce · strong dispute infrastructure."
            />
            <ProviderRow
              name="DOKU"
              tag="Licensed Indonesian PSP"
              fee="~2%"
              blurb="Indonesian payment gateway with escrow-style hold. B2B focused."
            />
            <ProviderRow
              name="PayPal Goods & Services"
              tag="International"
              fee="4.4% + fixed"
              blurb="For international trade only. PayPal Buyer Protection is real and enforced globally. Higher fee, worth it for cross-border."
            />
            <ProviderRow
              name="Rekening Bersama (Rekber)"
              tag="Informal · culturally embedded"
              fee="~0.5-1% or flat fee"
              blurb="Long-established Indonesian escrow tradition (Rekber BlackPanda, Sanbank, etc.). Cheap. Unregulated · pick a provider with a long track record. NEX does not endorse specific Rekbers."
            />
          </div>
        </section>

        {/* --- What NEX never does --------------------------------- */}
        <section style={{ marginBottom: 40 }}>
          <SectionEyebrow color={NEX.textMute}>
            What NEX will never do
          </SectionEyebrow>
          <h2 style={sectionH2}>Because we do not touch your money</h2>
          <ul
            style={{
              padding: "0 0 0 20px",
              margin: "12px 0 0",
              fontSize: 14,
              lineHeight: 1.8,
              color: "rgba(244,247,252,0.88)",
            }}
          >
            <li>NEX has no wallet. Do not send money to any &quot;NEX Wallet&quot; · it does not exist.</li>
            <li>NEX has no processing fee on transactions. 0% commission, both tiers, forever.</li>
            <li>NEX does not store card details. If a page asks for your card number, it is not us.</li>
            <li>NEX does not offer loans, credit, or BNPL. If a &quot;NEX Kredit&quot; contacts you, it is a scam.</li>
            <li>NEX support will never ask you to transfer money to verify your account.</li>
          </ul>
        </section>

        {/* --- Bottom CTA · back to shopping ------------------------ */}
        <div
          style={{
            marginTop: 60,
            padding: "26px 24px",
            borderRadius: 18,
            background:
              "linear-gradient(180deg, rgba(255,114,0,0.12) 0%, rgba(255,114,0,0.04) 100%)",
            border: `1px solid ${NEX.orangeSoft}`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: NEX.orange,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            The one-line promise
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
            <span style={{ color: NEX.orange }}>—</span> unless a third
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

function ChipRow({
  slug,
  tone,
}: {
  slug: (typeof NEX_PAYMENT_METHODS)[number];
  tone: "safe" | "escrow";
}) {
  const meta = NEX_PAYMENT_METHOD_META[slug];
  const border =
    tone === "safe"
      ? "rgba(22,214,107,0.30)"
      : "rgba(0,175,255,0.30)";
  const dotColor = tone === "safe" ? NEX.green : NEX.cyan;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "44px 1fr",
        gap: 14,
        padding: "16px 18px",
        borderRadius: 14,
        background: NEX.panelSoft,
        border: `1px solid ${border}`,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `${dotColor}18`,
          border: `1px solid ${dotColor}55`,
          display: "grid",
          placeItems: "center",
          fontSize: 20,
        }}
      >
        {meta.emoji}
      </div>
      <div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            marginBottom: 4,
            letterSpacing: "-0.005em",
          }}
        >
          {meta.label}
        </div>
        <div
          style={{
            fontSize: 13,
            color: NEX.textDim,
            lineHeight: 1.55,
          }}
        >
          {meta.blurb}
        </div>
      </div>
    </div>
  );
}

function ProviderRow({
  name,
  tag,
  fee,
  blurb,
}: {
  name: string;
  tag: string;
  fee: string;
  blurb: string;
}) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>{name}</div>
        <div
          style={{
            fontSize: 11,
            color: NEX.orange,
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          {fee}
        </div>
      </div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: NEX.cyan,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {tag}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: NEX.textDim }}>
        {blurb}
      </div>
    </div>
  );
}

function SectionEyebrow({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        color,
        fontWeight: 700,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function TierHead({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <h3
      style={{
        margin: 0,
        fontSize: 18,
        fontWeight: 700,
        color,
        letterSpacing: "-0.005em",
      }}
    >
      {children}
    </h3>
  );
}

const sectionH2: React.CSSProperties = {
  margin: "6px 0 4px",
  fontFamily: SERIF,
  fontSize: 26,
  lineHeight: 1.2,
  fontWeight: 500,
  letterSpacing: "-0.005em",
};

const sectionLede: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 14,
  lineHeight: 1.6,
  color: "rgba(244,247,252,0.85)",
};
