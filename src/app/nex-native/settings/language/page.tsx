// src/app/nex-native/settings/language/page.tsx
//
// Bridge 16d · Language preference page.
// -------------------------------------
// Signed-in users pick Bahasa Indonesia or English · saved to
// nex_account.locale (migration 071) and honoured by every
// locale-aware surface via resolveLocale() precedence.
//
// Kept simple: two radio buttons, one submit. No language toggle
// widget in the app chrome yet (that would need thoughtful placement
// across every surface) · users find this page via /settings.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { updateAccountLocaleAction } from "../../_actions";
// Phase B.7 · dogfood proof · this page now reads from the universal
// NEX i18n registry rather than its own hard-coded COPY map. The
// sealed `safe-trade-strings.resolveLocale` is replaced by the
// universal `resolveServerLocale` which uses the single
// authoritative DEFAULT_LANG (`"id"`). Translation strings come
// from the same packs the client `useT` hook consumes.
import { resolveServerLocale, tFor } from "@/lib/nex/i18n/server";

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
  orange: "#FF7200",
  green: "#16D66B",
};

// Phase B.7 · the hard-coded COPY map that used to live here has
// been removed · strings now come from `t("settings.language.*",
// locale)` through the shared NEX i18n registry (keys registered in
// `src/lib/nex/i18n/keys.ts` · translations in `packs/en.ts` +
// `packs/id.ts`). Adding another supported locale is now one
// registry edit + one pack file · zero changes required to this
// page.

export default async function LanguageSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; locale_error?: string }>;
}) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const acceptLanguage = (await headers()).get("accept-language");
  const locale = resolveServerLocale({
    urlParam: sp.lang ?? null,
    accountLocale: session.account.locale ?? null,
    acceptLanguage,
  });
  const t = tFor(locale);
  const current = session.account.locale ?? null;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
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
          href="/nex-native/home"
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
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px" }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          {t("settings.language.eyebrow")}
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily:
              "'Cormorant Garamond', 'EB Garamond', Georgia, serif",
            fontSize: 36,
            lineHeight: 1.1,
            fontWeight: 500,
            letterSpacing: "-0.012em",
            marginBottom: 12,
          }}
        >
          {t("settings.language.title")}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.65,
            color: NEX.textDim,
            marginBottom: 26,
          }}
        >
          {t("settings.language.lede")}
        </p>

        {sp.locale_error && (
          <div
            role="status"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(255,51,85,0.10)",
              border: "1px solid rgba(255,51,85,0.35)",
              color: "#FFB4C0",
              fontSize: 12,
              marginBottom: 20,
            }}
          >
            {sp.locale_error}
          </div>
        )}

        <form
          action={updateAccountLocaleAction}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <input
            type="hidden"
            name="next"
            value="/nex-native/settings/language"
          />
          <LocaleOption
            value="id"
            label={t("settings.language.id_label")}
            blurb={t("settings.language.id_blurb")}
            emoji="🇮🇩"
            checked={current === "id"}
          />
          <LocaleOption
            value="en"
            label={t("settings.language.en_label")}
            blurb={t("settings.language.en_blurb")}
            emoji="🌏"
            checked={current === "en"}
          />
          <button
            type="submit"
            style={{
              marginTop: 12,
              padding: "13px 16px",
              borderRadius: 12,
              background:
                "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
              border: "1px solid rgba(255,114,0,0.55)",
              color: "#0B0F1A",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow:
                "0 10px 24px rgba(255,114,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28)",
            }}
          >
            {t("settings.language.save")}
          </button>
        </form>
      </main>
    </div>
  );
}

function LocaleOption({
  value,
  label,
  blurb,
  emoji,
  checked,
}: {
  value: "id" | "en";
  label: string;
  blurb: string;
  emoji: string;
  checked: boolean;
}) {
  return (
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "22px 32px 1fr",
        gap: 12,
        alignItems: "center",
        padding: "14px 16px",
        borderRadius: 12,
        background: checked
          ? "rgba(255,114,0,0.08)"
          : "rgba(139,169,209,0.05)",
        border: checked
          ? `1px solid rgba(255,114,0,0.45)`
          : `1px solid ${NEX.border}`,
        cursor: "pointer",
      }}
    >
      <input
        type="radio"
        name="locale"
        value={value}
        defaultChecked={checked}
        style={{
          width: 18,
          height: 18,
          accentColor: NEX.orange,
        }}
      />
      <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>
        {emoji}
      </span>
      <span>
        <div
          style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}
        >
          {label}
        </div>
        <div
          style={{ fontSize: 12, color: NEX.textDim, lineHeight: 1.5 }}
        >
          {blurb}
        </div>
      </span>
    </label>
  );
}
