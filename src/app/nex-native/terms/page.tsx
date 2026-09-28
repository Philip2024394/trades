// src/app/nex-native/terms/page.tsx
//
// Bridge 16b · NEX Terms of Service · public.
// Bridge 16d · Fully bilingual (Bahasa Indonesia + English).
// ----------------------------------------------------------
// The canonical legal terms. Locale resolves via the same precedence
// chain used everywhere: ?lang override > account preference >
// Accept-Language header > Indonesian market default.
//
// Translation done 2026-09-28 · native-speaker legal review queued.

import type * as React from "react";
import Link from "next/link";
import { headers } from "next/headers";
import {
  CURRENT_SAFE_TRADE_TERMS_VERSION,
} from "@/lib/nex-native/safe-trade-consent-service";
import {
  resolveLocale,
  TERMS_STRINGS,
  SAFE_TRADE_STRINGS,
} from "@/lib/nex-native/i18n/safe-trade-strings";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

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
  red: "#FF3355",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const metadata = {
  title: "NEX · Terms of Service",
  description:
    "The rules of using NEX · plain English + Bahasa Indonesia · NEX never handles payments · off-doctrine payments are not mediated by NEX support.",
};

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const sp = await searchParams;
  const acceptLanguage = (await headers()).get("accept-language");
  const session = await resolveNexAppSessionFromContext().catch(() => null);
  const locale = resolveLocale({
    urlParam: sp.lang ?? null,
    accountLocale: session?.account.locale ?? null,
    acceptLanguage,
  });
  const t = TERMS_STRINGS[locale];
  const promise = SAFE_TRADE_STRINGS[locale];
  const otherLang = locale === "id" ? "en" : "id";
  const otherLabel = locale === "id" ? "English" : "Bahasa Indonesia";

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
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* Bridge 16d · quick language toggle in the header · does
              not persist for anonymous visitors · signed-in users can
              persist via /nex-native/settings/language. */}
          <Link
            href={`/nex-native/terms?lang=${otherLang}`}
            style={{
              fontSize: 11,
              color: NEX.textDim,
              textDecoration: "none",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 999,
              border: `1px solid ${NEX.border}`,
            }}
          >
            {otherLang === "id" ? "🇮🇩" : "🌏"} {otherLabel}
          </Link>
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
            {t.hero_eyebrow}
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
            {t.hero_title}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.65,
              color: NEX.textDim,
            }}
          >
            {t.hero_version_prefix}{" "}
            <b style={{ color: NEX.text }}>
              {CURRENT_SAFE_TRADE_TERMS_VERSION}
            </b>{" "}
            {t.hero_version_suffix}
          </p>
        </div>

        <TermSection meta={t.s1} />
        <TermSection meta={t.s2} />
        <TermSection meta={t.s3} tone="critical" />
        <TermSection meta={t.s4} tone="ok" />
        <TermSection meta={t.s5} />
        <TermSection meta={t.s6} />
        <TermSection meta={t.s7} />
        <TermSection meta={t.s8} />
        <TermSection meta={t.s9} />
        <TermSection meta={t.s10} />

        {/* --- The one-line promise -------------------------------- */}
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
            {promise.promise_eyebrow}
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
            {promise.promise_line1}
            <br />
            <span style={{ color: NEX.green }}>—</span> {promise.promise_line2}
          </p>
        </div>
      </main>
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * Term section renderer                                                 *
 * --------------------------------------------------------------------- */

function TermSection({
  meta,
  tone,
}: {
  meta: {
    badge: string;
    title: string;
    body_html: string;
    tone?: "critical" | "ok";
  };
  tone?: "critical" | "ok";
}) {
  const effective = tone ?? meta.tone ?? "default";
  const border =
    effective === "critical"
      ? "rgba(255,51,85,0.30)"
      : effective === "ok"
        ? "rgba(22,214,107,0.30)"
        : NEX.border;
  const eyebrow =
    effective === "critical"
      ? NEX.red
      : effective === "ok"
        ? NEX.green
        : NEX.cyan;
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
        {meta.badge}
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
        {meta.title}
      </h2>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          color: "rgba(244,247,252,0.88)",
        }}
        dangerouslySetInnerHTML={{ __html: meta.body_html }}
      />
    </section>
  );
}
