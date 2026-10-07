"use client";

// src/app/nex-native/nex-socials/_chooser-client.tsx
//
// NEX Socials landing · chooser client · founder-sealed 2026-10-07.
//
// Four large tactile tiles over the sealed night-life hero. Each tile
// routes into its own floating-profile world. Tiles that match the
// user's declared signup intents (nex_account.social_intents, read
// server-side in page.tsx) carry a soft cyan glow + "Your intent" chip
// so the user sees the choice they already made - but every lens
// still requires an explicit tap. No auto-skip.

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  INTENT_CATALOG,
  type IntentCatalogEntry,
} from "./_intent-catalog";
import type { SocialIntent } from "./_actions";

const BG_URL = "/nex-socials/night-life-background.png";

const NEX = {
  navy: "#020914",
  textPrimary: "#F2F5F8",
  textDim: "rgba(242, 245, 248, 0.72)",
  textMuted: "rgba(242, 245, 248, 0.52)",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
};

export interface NexSocialsChooserProps {
  declaredIntents: readonly SocialIntent[];
}

export function NexSocialsChooser({ declaredIntents }: NexSocialsChooserProps) {
  const router = useRouter();
  const declaredSet = new Set<SocialIntent>(declaredIntents);

  return (
    <main
      data-nex-socials-landing
      data-nex-socials-declared={declaredIntents.join(",")}
      style={{
        position: "fixed",
        inset: 0,
        color: NEX.textPrimary,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        background: `linear-gradient(180deg, rgba(2,9,20,0.40) 0%, rgba(2,9,20,0.72) 60%, rgba(2,9,20,0.92) 100%), url("${BG_URL}") center/cover no-repeat ${NEX.navy}`,
        overflow: "auto",
        padding:
          "max(20px, env(safe-area-inset-top)) 20px max(28px, env(safe-area-inset-bottom))",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <span
          data-nex-socials-brand
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 6,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: NEX.orange }}>NEX</span>
          <span>SOCIALS</span>
        </span>
        <Link
          href="/nex-native/settings"
          data-nex-socials-exit
          aria-label="Back to Settings"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "8px 14px",
            fontSize: 12.5,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: NEX.textPrimary,
            textDecoration: "none",
            background: "rgba(2,9,20,0.55)",
            border: `1px solid ${NEX.cyanSoft}`,
            borderRadius: 999,
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          Back
        </Link>
      </header>

      <section
        style={{
          maxWidth: 720,
          margin: "0 auto",
          textAlign: "center",
          paddingTop: "4vh",
        }}
      >
        <h1
          data-nex-socials-headline
          style={{
            margin: 0,
            fontSize: "clamp(28px, 6.5vw, 44px)",
            lineHeight: 1.15,
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          Meet someone new.
        </h1>
        <p
          data-nex-socials-subhead
          style={{
            margin: "12px auto 0",
            maxWidth: 520,
            fontSize: 15,
            lineHeight: 1.55,
            color: NEX.textDim,
          }}
        >
          Choose what brings you here.
        </p>
      </section>

      <section
        data-nex-socials-tiles
        aria-label="NEX Socials worlds"
        style={{
          maxWidth: 720,
          margin: "28px auto 0",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        {INTENT_CATALOG.map((entry) => (
          <IntentTile
            key={entry.intent}
            entry={entry}
            declared={declaredSet.has(entry.intent)}
            onEnter={() =>
              router.push(`/nex-native/nex-socials/discover/${entry.intent}`)
            }
          />
        ))}
      </section>

      <p
        data-nex-socials-honesty
        style={{
          margin: "28px auto 0",
          maxWidth: 520,
          textAlign: "center",
          fontSize: 11.5,
          color: NEX.textMuted,
          lineHeight: 1.5,
        }}
      >
        You can be in more than one world. Change your mind anytime from
        Settings &rarr; NEX Socials.
      </p>
    </main>
  );
}

function IntentTile({
  entry,
  declared,
  onEnter,
}: {
  entry: IntentCatalogEntry;
  declared: boolean;
  onEnter: () => void;
}) {
  const border = declared
    ? `1px solid ${NEX.cyan}`
    : `1px solid rgba(242, 245, 248, 0.18)`;
  const glow = declared
    ? `0 0 0 2px ${NEX.cyanFaint}, 0 24px 56px -20px rgba(0, 175, 255, 0.45)`
    : `0 24px 56px -24px rgba(0, 0, 0, 0.55)`;

  return (
    <button
      type="button"
      data-nex-socials-tile={entry.intent}
      data-nex-socials-tile-declared={declared ? "true" : "false"}
      onClick={onEnter}
      aria-label={`${entry.ctaLabel} - ${entry.blurb}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 12,
        padding: "22px 20px",
        background:
          "linear-gradient(180deg, rgba(5, 22, 42, 0.68) 0%, rgba(3, 16, 29, 0.86) 100%)",
        border,
        borderRadius: 20,
        boxShadow: glow,
        color: NEX.textPrimary,
        fontFamily: "inherit",
        textAlign: "left",
        cursor: "pointer",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        transition:
          "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          gap: 10,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-grid",
            placeItems: "center",
            width: 54,
            height: 54,
            borderRadius: 14,
            background: declared ? NEX.cyanFaint : "rgba(255, 114, 0, 0.12)",
            border: `1px solid ${declared ? NEX.cyanSoft : "rgba(255, 114, 0, 0.3)"}`,
            fontSize: 26,
          }}
        >
          {entry.emoji}
        </span>
        {declared && (
          <span
            data-nex-socials-tile-chip
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 10px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.cyan,
              background: NEX.cyanFaint,
              border: `1px solid ${NEX.cyanSoft}`,
              borderRadius: 999,
            }}
          >
            Your intent
          </span>
        )}
      </header>
      <h2
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: NEX.textPrimary,
        }}
      >
        {entry.label}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          lineHeight: 1.5,
          color: NEX.textDim,
        }}
      >
        {entry.blurb}
      </p>
      <span
        aria-hidden
        style={{
          marginTop: 4,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: NEX.orange,
        }}
      >
        {entry.ctaLabel}
        <span>&rarr;</span>
      </span>
    </button>
  );
}
