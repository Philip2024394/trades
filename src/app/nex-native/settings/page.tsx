// src/app/nex-native/settings/page.tsx
//
// NEX Settings landing · gear icon in the shared page header points here.
// Lists the settings sub-surfaces as landscape cards, matching the visual
// language of /nex-native/home.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { NexPageHeader } from "../_page-header";
import { signOutAction } from "../_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
};

interface SettingRow {
  href: string | null;
  emoji: string;
  title: string;
  subtitle: string;
  comingSoon?: boolean;
}

export default async function SettingsIndex() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const rows: SettingRow[] = [
    {
      href: "/nex-native/settings/profile",
      emoji: "🪪",
      title: "Profile",
      subtitle:
        "Kind · headline · profession · bio · skills · location · privacy",
    },
    {
      href: "/nex-native/settings/tier",
      emoji: "🎯",
      title: "Your NEX plan",
      subtitle:
        "See your current tier · compare Gratis vs. Bisnis · upgrade path",
    },
    {
      href: "/nex-native/settings/theme",
      emoji: "🎨",
      title: "Chat theme",
      subtitle: "Pick the theme applied to your chat bubbles",
    },
    // Bridge 42 · 2026-09-28 · face-sign-in enrolment surface retired.
    // Previously-enrolled devices still see the "Sign in with face"
    // button on /sign-in because that reads the nex-has-face cookie
    // and calls the WebAuthn API directly. New enrolment is out of
    // scope for now · Founder simplified the auth surface to one
    // email + password path.
    {
      // Placeholder · sealed 2026-09-27. Deferred until the token ledger
      // + wallet backend exist as a bounded Bridge. Reserves the settings
      // slot so visitors know where the affordance will live.
      href: null,
      emoji: "⚡",
      title: "Power tokens & wallet",
      subtitle:
        "Earn · spend · tip · affiliate commissions · chat boosts",
      comingSoon: true,
    },
  ];

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "16px 20px 32px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.09), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings" />

          <h1
            style={{
              margin: "24px 0 6px",
              textAlign: "center",
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "0.005em",
            }}
          >
            Settings
          </h1>
          <p
            style={{
              margin: "0 0 22px",
              textAlign: "center",
              fontSize: 12,
              color: NEX.textSecondary,
            }}
          >
            Signed in as{" "}
            <span style={{ color: NEX.textPrimary }}>
              {session.account.display_name}
            </span>
            {session.account.nex_handle && (
              <>
                {" · "}
                <code style={{ fontFamily: "ui-monospace, monospace", color: NEX.cyan }}>
                  {session.account.nex_handle}
                </code>
              </>
            )}
          </p>

          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((r, i) => {
              const style: React.CSSProperties = {
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                background: NEX.panel,
                border: `1px solid ${r.comingSoon ? "rgba(0,175,255,0.18)" : NEX.cyanSoft}`,
                borderRadius: 12,
                textDecoration: "none",
                color: NEX.textPrimary,
                minHeight: 76,
                opacity: r.comingSoon ? 0.7 : 1,
              };
              const body = (
                <>
                  <div
                    aria-hidden
                    style={{
                      flexShrink: 0,
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: NEX.cyanFaint,
                      color: r.comingSoon ? NEX.orange : NEX.cyan,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 22,
                    }}
                  >
                    {r.emoji}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontSize: 15, fontWeight: 500 }}>{r.title}</span>
                      {r.comingSoon && (
                        <span
                          aria-label="coming soon"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "1px 6px",
                            fontSize: 9,
                            fontWeight: 600,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: NEX.orange,
                            border: `1px solid ${NEX.orange}`,
                            borderRadius: 4,
                            lineHeight: 1.3,
                          }}
                        >
                          Soon
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                        color: NEX.textSecondary,
                        lineHeight: 1.4,
                      }}
                    >
                      {r.subtitle}
                    </div>
                  </div>
                  <div
                    aria-hidden
                    style={{
                      color: r.comingSoon ? NEX.textSecondary : NEX.cyan,
                      fontSize: 18,
                    }}
                  >
                    →
                  </div>
                </>
              );
              if (!r.href) {
                return (
                  <div
                    key={`row-${i}`}
                    data-nex-settings-row
                    data-nex-settings-row-coming-soon="true"
                    style={style}
                  >
                    {body}
                  </div>
                );
              }
              return (
                <Link
                  key={r.href}
                  href={r.href}
                  data-nex-settings-row
                  style={style}
                >
                  {body}
                </Link>
              );
            })}
          </div>

          <form action={signOutAction} style={{ marginTop: 28, textAlign: "center" }}>
            <button
              type="submit"
              style={{
                background: "transparent",
                color: NEX.textSecondary,
                border: "none",
                fontSize: 12,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              sign out
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
