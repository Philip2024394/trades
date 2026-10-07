"use client";

// src/app/nex-native/nex-socials/_socials-invite-card.tsx
//
// NEX Socials · optional signup invite · founder-sealed 2026-10-07.
//
// Rendered inside the post-signup welcome page. Honest invite, not a
// wall: the user may pick 0-4 intents and press Save, OR press Skip
// without picking anything. The server action persists the (possibly
// empty) intent array to nex_account.social_intents (migration 145)
// and redirects to /nex-native/chat so signup continues cleanly.
//
// Multi-select was chosen over single-select because people's social
// intents overlap in real life (someone opening a cafe might ALSO be
// looking for new friends in a new city). Treating them as mutually
// exclusive would force a lie.

import { useId, useState } from "react";
import {
  setSocialIntentsAction,
  SOCIAL_INTENTS,
  type SocialIntent,
} from "./_actions";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  fieldBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.18)",
  orange: "#FF7200",
};

interface IntentOption {
  intent: SocialIntent;
  label: string;
  emoji: string;
  blurb: string;
}

const OPTIONS: readonly IntentOption[] = [
  {
    intent: "business",
    label: "Business",
    emoji: "💼",
    blurb: "Opening + growing · meet founders · suppliers · customers",
  },
  {
    intent: "new_friends",
    label: "New Friends",
    emoji: "🤝",
    blurb: "New city · new scene · just want good people around",
  },
  {
    intent: "dating",
    label: "Dating",
    emoji: "💞",
    blurb: "Open to meeting someone · relaxed, respectful introductions",
  },
  {
    intent: "nightlife",
    label: "Night Life partner",
    emoji: "🌃",
    blurb: "Bars · clubs · live music · never going out alone",
  },
] as const;

interface Props {
  /** The route the server action redirects to after Save. Defaults to
   *  the welcome-page's primary CTA target (/nex-native/chat). */
  nextHref?: string;
}

export function SocialsInviteCard({
  nextHref = "/nex-native/chat",
}: Props) {
  const headingId = useId();
  const [picked, setPicked] = useState<Set<SocialIntent>>(new Set());

  function toggle(intent: SocialIntent) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(intent)) next.delete(intent);
      else next.add(intent);
      return next;
    });
  }

  const anyPicked = picked.size > 0;

  return (
    <section
      aria-labelledby={headingId}
      data-nex-socials-invite-card
      style={{
        marginTop: 18,
        padding: 18,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div
          aria-hidden
          style={{
            flexShrink: 0,
            width: 42,
            height: 42,
            borderRadius: 10,
            background: `${NEX.orange}18`,
            border: `1px solid ${NEX.orange}66`,
            color: NEX.orange,
            display: "grid",
            placeItems: "center",
            fontSize: 20,
          }}
        >
          🌃
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: NEX.orange,
              marginBottom: 2,
            }}
          >
            Free · optional
          </div>
          <h2
            id={headingId}
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: NEX.textPrimary,
              letterSpacing: "0.005em",
            }}
          >
            Join NEX Socials
          </h2>
        </div>
      </div>

      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          lineHeight: 1.55,
          color: NEX.textSecondary,
        }}
      >
        Business openings · new friends · dating · nightlife. Pick any
        that fit · you&apos;ll see those people first on NEX Socials.
      </p>

      <form action={setSocialIntentsAction} data-nex-socials-invite-form>
        <input type="hidden" name="next" value={nextHref} />
        <ul
          style={{
            margin: "0 0 14px",
            padding: 0,
            listStyle: "none",
            display: "grid",
            gap: 8,
          }}
        >
          {OPTIONS.map((opt) => {
            const isOn = picked.has(opt.intent);
            return (
              <li key={opt.intent}>
                <label
                  data-nex-socials-intent-row={opt.intent}
                  data-nex-socials-intent-on={isOn ? "true" : "false"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: isOn ? `${NEX.cyan}1A` : NEX.fieldBg,
                    border: `1px solid ${isOn ? NEX.cyan : NEX.cyanSoft}`,
                    cursor: "pointer",
                    transition:
                      "background 140ms ease, border-color 140ms ease",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      flexShrink: 0,
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 18,
                      background: isOn ? NEX.cyanFaint : "rgba(0,175,255,0.08)",
                      border: `1px solid ${NEX.cyanSoft}`,
                    }}
                  >
                    {opt.emoji}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 14,
                        fontWeight: 600,
                        color: NEX.textPrimary,
                        letterSpacing: "0.005em",
                      }}
                    >
                      {opt.label}
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 2,
                        fontSize: 11.5,
                        color: NEX.textSecondary,
                        lineHeight: 1.4,
                      }}
                    >
                      {opt.blurb}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    name="social_intent"
                    value={opt.intent}
                    checked={isOn}
                    onChange={() => toggle(opt.intent)}
                    data-nex-socials-intent-checkbox={opt.intent}
                    aria-label={opt.label}
                    style={{
                      position: "absolute",
                      opacity: 0,
                      width: 1,
                      height: 1,
                      pointerEvents: "none",
                    }}
                  />
                  <span
                    aria-hidden
                    style={{
                      flexShrink: 0,
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      display: "grid",
                      placeItems: "center",
                      background: isOn ? NEX.cyan : "transparent",
                      border: `1.5px solid ${isOn ? NEX.cyan : NEX.cyanSoft}`,
                      color: "#001522",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    {isOn ? "✓" : ""}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexDirection: "column",
          }}
        >
          <button
            type="submit"
            data-nex-socials-invite-submit
            data-nex-socials-invite-selected={picked.size}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              minHeight: 48,
              padding: "12px 18px",
              background: anyPicked ? NEX.orange : "transparent",
              color: anyPicked ? "#1A1300" : NEX.orange,
              border: `1px solid ${NEX.orange}`,
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition:
                "background 140ms ease, color 140ms ease",
              fontFamily: "inherit",
            }}
          >
            {anyPicked ? "Join NEX Socials" : "Save (no intents picked)"}
          </button>
          <SkipButton nextHref={nextHref} />
        </div>
      </form>
    </section>
  );
}

function SkipButton({ nextHref }: { nextHref: string }) {
  // Separate form so Skip doesn't carry the checkbox values · the
  // server action still runs (persists empty set) but the semantics
  // are clearer in the DOM for anyone reading the markup.
  return (
    <form action={setSocialIntentsAction} data-nex-socials-invite-skip-form>
      <input type="hidden" name="next" value={nextHref} />
      <button
        type="submit"
        data-nex-socials-invite-skip
        style={{
          width: "100%",
          minHeight: 44,
          padding: "10px 16px",
          background: "transparent",
          color: NEX.textSecondary,
          border: `1px solid ${NEX.cyanSoft}`,
          borderRadius: 10,
          fontSize: 12.5,
          fontWeight: 600,
          letterSpacing: "0.04em",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Not now · maybe later
      </button>
    </form>
  );
}
