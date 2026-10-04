// src/app/nex-native/prototypes/system-rollout/page.tsx
//
// Prototype · how the Call-page glass system (frosted panels +
// orange→cyan rim) rolls out across the rest of NEX. Four surfaces
// shown back-to-back on the real Create Account canvas so the
// founder can decide whether to commit.
//
//   1. Contacts         — identical rim language, cards reuse the
//                         picker grammar
//   2. Sign In          — glass inputs with cyan focus ring, glass
//                         primary CTA
//   3. Create Account   — same as Sign In but longer form
//   4. Vault            — DISCIPLINED variant · cyan-only rim, no
//                         orange, lock corner brackets · still the
//                         same system but reads "sealed"
//
// Read-only · no behaviour, no data fetching. Mock inputs only.

import type * as React from "react";

export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#7D9BC0",
  textMuted: "#4B6683",
  orange: "#FF7200",
  cyan: "#00AFFF",
  darkRed: "#991B1B",
};
const RIM_GRADIENT = `linear-gradient(135deg, ${NEX.orange} 0%, ${NEX.cyan} 100%)`;
const RIM_CYAN_ONLY = `linear-gradient(135deg, ${NEX.cyan} 0%, ${NEX.cyan}66 100%)`;

const CONTACTS = [
  { name: "Maria Santos",   job: "Footwear Designer", city: "Bandung",         handle: "nex-27418", online: true  },
  { name: "Aisha Rahman",   job: "Reseller · Vintage", city: "Jakarta",         handle: "nex-52091", online: true  },
  { name: "Kenji Tanaka",   job: "Photographer",      city: "Tokyo",           handle: "nex-38754", online: false },
  { name: "Lucas Ferreira", job: "Student · Design",  city: "Rio de Janeiro",  handle: "nex-15662", online: true  },
  { name: "Priya Patel",    job: "Bakery Owner",      city: "Mumbai",          handle: "nex-91280", online: false },
];

export default function SystemRolloutPrototypes(): React.JSX.Element {
  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
      `}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          padding: "calc(env(safe-area-inset-top, 0) + 20px) 20px 48px",
          position: "relative",
          overflow: "hidden",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.09), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 460, margin: "0 auto" }}>
          <TopBar />
          <Section index={1} name="Contacts"
            tagline="Same rim grammar as the picker · stacked list, same cards"
            render={<ContactsSurface />} />
          <Section index={2} name="Sign In"
            tagline="Glass inputs · cyan focus ring · glass primary CTA with rim"
            render={<SignInSurface />} />
          <Section index={3} name="Create Account"
            tagline="Longer form · same glass inputs · same primary rim CTA"
            render={<CreateAccountSurface />} />
          <Section index={4} name="Vault · sealed variant"
            tagline="Cyan-only rim, no orange · darker fills · corner lock brackets"
            render={<VaultSurface />} />
        </div>
      </main>
    </>
  );
}

function TopBar(): React.JSX.Element {
  return (
    <header style={{ textAlign: "center", marginBottom: 32 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.3em", color: NEX.textDim, fontWeight: 600 }}>
        NEX · SYSTEM ROLLOUT PROTOTYPES
      </div>
      <h1 style={{ margin: "8px 0 4px", fontSize: 22, fontWeight: 700 }}>Four surfaces</h1>
      <p style={{ margin: 0, fontSize: 13, color: NEX.textDim, lineHeight: 1.5 }}>
        How the Call-page glass language extends to Contacts, Auth, and Vault.
      </p>
    </header>
  );
}

function Section({
  index, name, tagline, render,
}: { index: number; name: string; tagline: string; render: React.ReactNode }): React.JSX.Element {
  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: NEX.orange, letterSpacing: "0.12em" }}>0{index}</span>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{name}</h2>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: NEX.textDim, lineHeight: 1.4 }}>{tagline}</p>
      <div style={{ padding: 14, borderRadius: 20, background: "rgba(0,175,255,0.015)", border: "1px solid rgba(0,175,255,0.06)" }}>
        {render}
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * 01 · CONTACTS                                                      *
 * ═════════════════════════════════════════════════════════════════ */

function ContactsSurface(): React.JSX.Element {
  const tile = (): React.CSSProperties => ({
    border: "1.5px solid transparent",
    background: `rgba(255,255,255,0.05) padding-box, ${RIM_GRADIENT} border-box`,
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderRadius: 18,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 20px rgba(0,0,0,0.35), 0 0 16px rgba(255,114,0,0.06), 0 0 18px rgba(0,175,255,0.06)",
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ ...tile(), padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <GlassChip tint={NEX.cyan}><PeopleIcon /></GlassChip>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Contacts</div>
          <div style={{ fontSize: 11.5, color: NEX.textDim }}>5 friends on NEX</div>
        </div>
        <div style={{
          padding: "6px 10px", borderRadius: 10, fontSize: 11, color: NEX.cyan,
          border: `1px solid ${NEX.cyan}44`, background: `${NEX.cyan}1A`,
        }}>+ Add</div>
      </div>
      {CONTACTS.map((c) => (
        <button key={c.handle} type="button" style={{
          ...tile(),
          padding: "14px 14px",
          display: "flex", alignItems: "center", gap: 14,
          color: NEX.text, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
        }}>
          <Avatar name={c.name} online={c.online} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{c.name}</div>
            <div style={{ fontSize: 12.5, opacity: 0.9 }}>{c.job}</div>
            <div style={{ fontSize: 11.5, color: NEX.textDim }}>{c.city}</div>
            <div style={{ marginTop: 2, display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 10.5, color: NEX.cyan, fontFamily: "ui-monospace, monospace" }}>{c.handle}</span>
              {c.online && (
                <>
                  <span aria-hidden style={{ width: 3, height: 3, borderRadius: 999, background: NEX.textMuted }} />
                  <span style={{ fontSize: 10.5, color: NEX.cyan, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: "#22C55E", boxShadow: "0 0 6px #22C55E99" }} />
                    Online
                  </span>
                </>
              )}
            </div>
          </div>
          <GlassActionChip tint={NEX.orange}><PhoneSm /></GlassActionChip>
          <GlassActionChip tint={NEX.cyan}><VideoSm /></GlassActionChip>
        </button>
      ))}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * 02 · SIGN IN                                                       *
 * ═════════════════════════════════════════════════════════════════ */

function SignInSurface(): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          display: "inline-block",
          fontSize: 22, fontWeight: 900, letterSpacing: "0.14em",
        }}>
          <span style={{ color: NEX.text }}>NE</span>
          <span style={{ color: NEX.orange }}>X</span>
        </div>
        <h3 style={{ margin: "16px 0 2px", fontSize: 20, fontWeight: 600 }}>Welcome back</h3>
        <p style={{ margin: 0, fontSize: 12.5, color: NEX.textDim }}>Sign in to your NEX</p>
      </div>
      <GlassInput label="Phone or email" placeholder="+62 812 345 6789" />
      <GlassInput label="Password" placeholder="••••••••" />
      <PrimaryGlassButton>Sign in →</PrimaryGlassButton>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
        <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${NEX.cyan}22, transparent)` }} />
        <span style={{ fontSize: 10.5, color: NEX.textMuted, letterSpacing: "0.14em" }}>OR</span>
        <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${NEX.cyan}22, transparent)` }} />
      </div>
      <SecondaryGlassButton>Face Sign-in</SecondaryGlassButton>
      <p style={{ margin: "6px 0 0", textAlign: "center", fontSize: 12, color: NEX.textDim }}>
        No account yet? <span style={{ color: NEX.orange, fontWeight: 600 }}>Create one →</span>
      </p>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * 03 · CREATE ACCOUNT                                                *
 * ═════════════════════════════════════════════════════════════════ */

function CreateAccountSurface(): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.14em" }}>
          <span style={{ color: NEX.text }}>NE</span>
          <span style={{ color: NEX.orange }}>X</span>
        </div>
        <h3 style={{ margin: "16px 0 2px", fontSize: 20, fontWeight: 600 }}>Create your NEX account</h3>
        <p style={{ margin: 0, fontSize: 12.5, color: NEX.textDim }}>Your private space starts here</p>
      </div>
      <GlassInput label="Full name" placeholder="Philip O'Farrell" />
      <GlassInput label="Phone number" placeholder="+62 812 345 6789" />
      <GlassInput label="Choose a handle" placeholder="nex-91045" prefix="nex-" />
      <PrimaryGlassButton>Create account →</PrimaryGlassButton>
      <p style={{ margin: "4px 0 0", textAlign: "center", fontSize: 11, color: NEX.textMuted, lineHeight: 1.5 }}>
        By continuing you agree to NEX{" "}
        <span style={{ color: NEX.cyan }}>Terms</span>{" "}&amp;{" "}
        <span style={{ color: NEX.cyan }}>Privacy</span>.
      </p>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * 04 · VAULT · sealed variant                                        *
 * ═════════════════════════════════════════════════════════════════ */

function VaultSurface(): React.JSX.Element {
  const sealTile = (): React.CSSProperties => ({
    position: "relative",
    border: "1px solid transparent",
    background: `rgba(0,20,40,0.5) padding-box, ${RIM_CYAN_ONLY} border-box`,
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    borderRadius: 16,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 24px rgba(0,0,0,0.5), 0 0 20px rgba(0,175,255,0.12)",
  });
  const LockBrackets = (): React.ReactNode => (
    <>
      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <span key={c} aria-hidden style={{
          position: "absolute", width: 10, height: 10,
          borderColor: `${NEX.cyan}88`, borderStyle: "solid", borderWidth: 0,
          ...(c === "tl" ? { top: 4, left: 4, borderTopWidth: 1, borderLeftWidth: 1 }
            : c === "tr" ? { top: 4, right: 4, borderTopWidth: 1, borderRightWidth: 1 }
            : c === "bl" ? { bottom: 4, left: 4, borderBottomWidth: 1, borderLeftWidth: 1 }
            : { bottom: 4, right: 4, borderBottomWidth: 1, borderRightWidth: 1 }),
        }} />
      ))}
    </>
  );
  const vaultItems = [
    { icon: "🔑", label: "Passport",         meta: "Scanned 12 Aug 2026",   masked: "GB •• 456 ••" },
    { icon: "💳", label: "Primary card",     meta: "Visa · expires 03/28",  masked: "•••• •••• •••• 4291" },
    { icon: "🏦", label: "BCA · Business",   meta: "Updated 3d ago",        masked: "•••• 9120" },
    { icon: "📄", label: "Signed NDA",       meta: "Carla Teixeira · 2026", masked: null },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...sealTile(), padding: "14px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <LockBrackets />
        <span aria-hidden style={{
          width: 34, height: 34, borderRadius: 10,
          background: `${NEX.cyan}1F`, border: `1px solid ${NEX.cyan}44`,
          display: "grid", placeItems: "center", color: NEX.cyan,
        }}><LockIcon /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: NEX.cyan, letterSpacing: "0.2em", fontWeight: 700 }}>SEALED</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Your Vault</div>
        </div>
        <span style={{ fontSize: 10.5, color: NEX.textDim, fontFamily: "ui-monospace, monospace" }}>4 entries</span>
      </div>
      {vaultItems.map((v) => (
        <div key={v.label} style={{ ...sealTile(), padding: "14px 14px" }}>
          <LockBrackets />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              width: 42, height: 42, borderRadius: 10,
              background: `${NEX.cyan}14`, border: `1px solid ${NEX.cyan}33`,
              display: "grid", placeItems: "center", fontSize: 20,
            }}>{v.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{v.label}</div>
              <div style={{ fontSize: 11.5, color: NEX.textDim, marginTop: 2 }}>{v.meta}</div>
              {v.masked && (
                <div style={{ fontSize: 11.5, color: NEX.cyan, fontFamily: "ui-monospace, monospace", marginTop: 3, letterSpacing: "0.04em" }}>
                  {v.masked}
                </div>
              )}
            </div>
            <span aria-hidden style={{
              width: 32, height: 32, borderRadius: 999,
              background: `${NEX.cyan}1A`, border: `1px solid ${NEX.cyan}44`,
              color: NEX.cyan, display: "grid", placeItems: "center",
            }}><EyeIcon /></span>
          </div>
        </div>
      ))}
      <div style={{ ...sealTile(), padding: "14px", textAlign: "center" }}>
        <LockBrackets />
        <span style={{ fontSize: 12, color: NEX.textDim }}>
          🔒 Encrypted with your device key · never leaves your phone
        </span>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * Shared primitives                                                  *
 * ═════════════════════════════════════════════════════════════════ */

function GlassChip({ tint, children }: { tint: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <span aria-hidden style={{
      width: 36, height: 36, borderRadius: 12,
      border: "1.5px solid transparent",
      background: `${tint}1F padding-box, ${RIM_GRADIENT} border-box`,
      backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
      color: tint, display: "grid", placeItems: "center",
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1), 0 0 12px ${tint}33`,
    }}>{children}</span>
  );
}

function GlassActionChip({ tint, children }: { tint: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <span aria-hidden style={{
      width: 40, height: 40, borderRadius: 12,
      border: "1.5px solid transparent",
      background: `${tint}1F padding-box, ${RIM_GRADIENT} border-box`,
      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      color: tint, display: "grid", placeItems: "center", flex: "none",
      boxShadow: `0 0 12px ${tint}33`,
    }}>{children}</span>
  );
}

function Avatar({ name, online }: { name: string; online: boolean }): React.JSX.Element {
  const tint = name.charCodeAt(0) % 2 === 0 ? NEX.orange : NEX.cyan;
  const initials = name.split(" ").slice(0, 2).map((p) => p[0]!).join("");
  return (
    <span style={{ position: "relative", flex: "none" }}>
      <span style={{
        width: 56, height: 56, borderRadius: "50%",
        background: `${tint}22`, color: tint,
        border: `1.5px solid ${tint}66`,
        display: "grid", placeItems: "center",
        fontSize: 18, fontWeight: 700,
      }}>{initials}</span>
      {online && (
        <span style={{
          position: "absolute", right: 0, bottom: 0,
          width: 12, height: 12, borderRadius: 999,
          background: "#22C55E", border: `2px solid ${NEX.bg}`,
          boxShadow: "0 0 8px #22C55E",
        }} />
      )}
    </span>
  );
}

function GlassInput({ label, placeholder, prefix }: { label: string; placeholder: string; prefix?: string }): React.JSX.Element {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, color: NEX.textDim, letterSpacing: "0.08em", fontWeight: 600 }}>
        {label.toUpperCase()}
      </span>
      <div style={{
        display: "flex", alignItems: "center",
        padding: "12px 14px",
        borderRadius: 14,
        border: "1.5px solid transparent",
        background: `rgba(255,255,255,0.04) padding-box, ${RIM_CYAN_ONLY} border-box`,
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.3)",
      }}>
        {prefix && <span style={{ color: NEX.cyan, fontFamily: "ui-monospace, monospace", fontSize: 13.5 }}>{prefix}</span>}
        <span style={{ color: NEX.textDim, fontSize: 14, fontWeight: 500 }}>
          {prefix ? placeholder.replace(prefix, "") : placeholder}
        </span>
      </div>
    </label>
  );
}

function PrimaryGlassButton({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <button type="button" style={{
      padding: "14px 18px",
      borderRadius: 14,
      border: "2px solid transparent",
      background: `rgba(255,114,0,0.18) padding-box, ${RIM_GRADIENT} border-box`,
      backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
      color: NEX.text, fontSize: 15, fontWeight: 700, letterSpacing: "0.01em",
      cursor: "pointer", fontFamily: "inherit",
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), 0 10px 24px rgba(0,0,0,0.4), 0 0 20px rgba(255,114,0,0.3), 0 0 24px rgba(0,175,255,0.2)`,
    }}>{children}</button>
  );
}

function SecondaryGlassButton({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <button type="button" style={{
      padding: "12px 18px",
      borderRadius: 14,
      border: "1.5px solid transparent",
      background: `rgba(255,255,255,0.04) padding-box, ${RIM_CYAN_ONLY} border-box`,
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      color: NEX.cyan, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
    }}>{children}</button>
  );
}

/* ─── Icons · minimal inline SVG ────────────────────────────────── */

function PeopleIcon(): React.JSX.Element {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx={9} cy={7} r={4} /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function PhoneSm(): React.JSX.Element {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.9.35 1.84.6 2.8.72a2 2 0 0 1 1.72 2z" />
    </svg>
  );
}
function VideoSm(): React.JSX.Element {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="23 7 16 12 23 17 23 7" /><rect x={1} y={5} width={15} height={14} rx={2} />
    </svg>
  );
}
function LockIcon(): React.JSX.Element {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x={3} y={11} width={18} height={11} rx={2} /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function EyeIcon(): React.JSX.Element {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx={12} cy={12} r={3} />
    </svg>
  );
}
