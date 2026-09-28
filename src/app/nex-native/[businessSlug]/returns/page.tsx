// src/app/nex-native/[businessSlug]/returns/page.tsx
//
// Bridge 21 · Public seller Return Policy page.
// ---------------------------------------------
// Rendered at /nex-native/[businessSlug]/returns. Reads
// nex_business.return_policy (JSONB · Bridge 21 · migration 076)
// and shows a clear, plain-language policy. Every product page
// carries a small "Return policy" pill link here so buyers can
// check before releasing an escrow / accepting a delivery.

import type * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as businessService from "@/lib/nex-native/business-service";
import {
  NEX_RETURN_LEGAL_MIN_WINDOW_DAYS,
  NEX_RETURN_LEGAL_MIN_REFUND_DAYS,
  NEX_RETURN_POLICY_DEFAULT,
} from "@/lib/nex-native/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const REASON_LABEL: Record<string, { emoji: string; label: string }> = {
  defective: { emoji: "🔧", label: "Defective / broken" },
  wrong_item: { emoji: "❌", label: "Wrong item sent" },
  not_as_described: { emoji: "📸", label: "Not as described" },
  damaged_in_transit: { emoji: "📦", label: "Damaged in transit" },
  changed_mind: { emoji: "🤔", label: "Changed your mind" },
  sized_wrong: { emoji: "📏", label: "Wrong size" },
  arrived_late: { emoji: "⏰", label: "Arrived too late" },
};

const SHIPPING_LABEL: Record<string, string> = {
  buyer: "You pay the return shipping.",
  seller: "Seller pays the return shipping.",
  split: "Return shipping is split 50/50.",
  buyer_unless_defective:
    "You pay the return shipping · but the seller pays if the item was defective.",
};

export default async function ReturnsPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const business = await businessService.getBusinessBySlug(businessSlug);
  if (!business) notFound();

  const rp = business.return_policy ?? NEX_RETURN_POLICY_DEFAULT;
  const acceptsReasons = new Set(rp.accepts_reasons ?? []);
  const shopHref = `/nex-native/${business.slug}`;
  const meetsMin =
    rp.window_days >= NEX_RETURN_LEGAL_MIN_WINDOW_DAYS &&
    rp.refund_days >= NEX_RETURN_LEGAL_MIN_REFUND_DAYS;

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
          href={shopHref}
          style={{
            fontSize: 11,
            color: NEX.textDim,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          ← {business.display_name}
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
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
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
          🔄 Return policy
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontSize: 40,
            lineHeight: 1.08,
            letterSpacing: "-0.015em",
            fontWeight: 500,
            marginBottom: 10,
          }}
        >
          {business.display_name}
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 14,
            lineHeight: 1.6,
            color: NEX.textDim,
          }}
        >
          Read this before releasing your escrow or accepting a COD
          delivery. This policy is what {business.display_name} has
          committed to · NEX enforces Indonesian consumer protection
          minimums (UU No 8/1999) as the floor.
        </p>

        {!rp.accepts_returns && (
          <RedNoticeCard>
            <b>{business.display_name} does not accept returns for
            change-of-mind orders.</b> The Indonesian legal minimum
            still applies · you can return defective, wrong-item,
            not-as-described, and damaged-in-transit orders within{" "}
            {NEX_RETURN_LEGAL_MIN_WINDOW_DAYS} days regardless of
            what a seller writes.
          </RedNoticeCard>
        )}

        {/* --- Headline stats -------------------------------------- */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 22,
          }}
        >
          <HeadlineBox
            eyebrow="Return window"
            value={`${rp.window_days} days`}
            note={`from the day it arrives${
              rp.window_days === NEX_RETURN_LEGAL_MIN_WINDOW_DAYS
                ? " · legal minimum"
                : ""
            }`}
            tone="cyan"
          />
          <HeadlineBox
            eyebrow="Refund within"
            value={`${rp.refund_days} days`}
            note={`once return is accepted${
              rp.refund_days === NEX_RETURN_LEGAL_MIN_REFUND_DAYS
                ? " · legal minimum"
                : ""
            }`}
            tone="green"
          />
        </div>

        {/* --- Reasons accepted ------------------------------------ */}
        <Section
          eyebrow="What can be returned"
          title="Accepted reasons"
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.keys(REASON_LABEL).map((r) => {
              const meta = REASON_LABEL[r]!;
              const on = acceptsReasons.has(r);
              return (
                <span
                  key={r}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: on
                      ? "rgba(22,214,107,0.10)"
                      : "rgba(139,169,209,0.05)",
                    border: on
                      ? "1px solid rgba(22,214,107,0.40)"
                      : `1px solid ${NEX.border}`,
                    color: on ? "#B8F1CC" : NEX.textMute,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <span aria-hidden>{on ? "✓" : "×"}</span>
                  <span aria-hidden>{meta.emoji}</span>
                  {meta.label}
                </span>
              );
            })}
          </div>
        </Section>

        {/* --- Shipping + fees ------------------------------------- */}
        <Section eyebrow="Return shipping" title="Who pays">
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: NEX.text }}>
            {SHIPPING_LABEL[rp.shipping_paid_by] ?? SHIPPING_LABEL.buyer}
          </p>
          {rp.restocking_fee_percent > 0 && (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 13,
                lineHeight: 1.6,
                color: NEX.amber,
              }}
            >
              ⚠ A <b>{rp.restocking_fee_percent}%</b> restocking fee
              applies to accepted returns (deducted from your refund).
            </p>
          )}
        </Section>

        {/* --- Non-returnable ------------------------------------- */}
        {rp.non_returnable && rp.non_returnable.length > 0 && (
          <Section
            eyebrow="Non-returnable"
            title="These items can't be returned"
            tone="critical"
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {rp.non_returnable.map((c) => (
                <span
                  key={c}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(255,51,85,0.10)",
                    border: "1px solid rgba(255,51,85,0.35)",
                    color: "#FFB4C0",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 12,
                color: NEX.textMute,
                lineHeight: 1.55,
              }}
            >
              Even for these, the seller is still legally obliged to
              accept returns for defective / wrong-item / not-as-
              described orders under UU No 8/1999.
            </p>
          </Section>
        )}

        {/* --- Seller's notes ------------------------------------- */}
        {rp.notes && (
          <Section
            eyebrow={`Notes from ${business.display_name}`}
            title="Extra terms"
          >
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.6,
                color: NEX.text,
                whiteSpace: "pre-wrap",
              }}
            >
              {rp.notes}
            </p>
          </Section>
        )}

        {/* --- How to start a return ------------------------------ */}
        <Section eyebrow="How to start a return" title="Three steps">
          <ol
            style={{
              margin: 0,
              padding: "0 0 0 20px",
              fontSize: 14,
              lineHeight: 1.7,
              color: NEX.text,
            }}
          >
            <li>
              Open your chat with {business.display_name}. Photograph
              the problem before opening more than needed.
            </li>
            <li>
              Send them a message with photos + the reason. If your
              order was via <b>Escrow</b>, ALSO open a dispute in the
              escrow provider (Rekber / Xendit / PayPal) · they hold
              the funds until this resolves.
            </li>
            <li>
              Ship the item back once the seller accepts · refund lands
              within {rp.refund_days} working days.
            </li>
          </ol>
        </Section>

        {/* --- Legal minimum callout ------------------------------ */}
        <div
          style={{
            marginTop: 30,
            padding: "18px 20px",
            borderRadius: 14,
            background: meetsMin
              ? "rgba(22,214,107,0.08)"
              : "rgba(245,158,11,0.12)",
            border: meetsMin
              ? "1px solid rgba(22,214,107,0.35)"
              : "1px solid rgba(245,158,11,0.35)",
            color: NEX.text,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: meetsMin ? NEX.green : NEX.amber,
              fontWeight: 800,
              marginBottom: 6,
            }}
          >
            🇮🇩 UU No 8/1999 · consumer protection
          </div>
          Indonesian law requires <b>every seller</b> to accept
          returns of defective / wrong-item / not-as-described orders
          within {NEX_RETURN_LEGAL_MIN_WINDOW_DAYS} days and refund
          within {NEX_RETURN_LEGAL_MIN_REFUND_DAYS} working days ·{" "}
          <b>this is the floor</b>. Nothing a seller writes overrides
          those rights. If a seller refuses a legitimate return, file
          a report on{" "}
          <Link
            href="/nex-native/support?topic=payment&used_safe_path=no"
            style={{ color: NEX.cyan, textDecoration: "none" }}
          >
            NEX Support
          </Link>{" "}
          and escalate to OJK (konsumen.ojk.go.id) if unresolved.
        </div>
      </main>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Sub-components                                                        *
 * --------------------------------------------------------------------- */

function Section({
  eyebrow,
  title,
  tone = "default",
  children,
}: {
  eyebrow: string;
  title: string;
  tone?: "default" | "critical";
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        padding: "18px 20px",
        borderRadius: 16,
        background: NEX.panelSoft,
        border:
          tone === "critical"
            ? "1px solid rgba(255,51,85,0.30)"
            : `1px solid ${NEX.border}`,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: tone === "critical" ? NEX.red : NEX.cyan,
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          margin: "2px 0 12px",
          fontFamily: SERIF,
          fontSize: 22,
          lineHeight: 1.2,
          fontWeight: 500,
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function HeadlineBox({
  eyebrow,
  value,
  note,
  tone,
}: {
  eyebrow: string;
  value: string;
  note: string;
  tone: "cyan" | "green";
}) {
  const color = tone === "cyan" ? NEX.cyan : NEX.green;
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        background: NEX.panelSoft,
        border: `1px solid ${color}55`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color,
          fontWeight: 800,
          marginBottom: 6,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: "-0.005em",
          color: NEX.text,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: NEX.textDim, lineHeight: 1.45 }}>
        {note}
      </div>
    </div>
  );
}

function RedNoticeCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        background: "rgba(255,51,85,0.10)",
        border: "1px solid rgba(255,51,85,0.35)",
        color: "#FFB4C0",
        fontSize: 13,
        lineHeight: 1.6,
        marginBottom: 20,
      }}
    >
      {children}
    </div>
  );
}
