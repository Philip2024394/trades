"use client";

// Auth pack — 10 sign-in provider buttons.
//
// Every button carries brand-safe defaults matching each provider's
// public brand kit. Colours, logos, and label formats are the ones
// providers publish for OAuth CTAs. Merchants can change the label but
// the brand mark is protected.
//
// Provider brand notes:
//   • Google  — white bg + Google G + "Sign in with Google"
//   • Apple   — solid black + Apple mark + "Sign in with Apple"
//   • Facebook — #1877F2 + white "f" + "Continue with Facebook"
//   • Microsoft — white + coloured squares + "Sign in with Microsoft"
//   • GitHub  — black + Octocat + "Continue with GitHub"
//   • LinkedIn — #0A66C2 + white "in" + "Sign in with LinkedIn"
//   • Email magic-link — merchant brand + envelope glyph
//   • Passkey — merchant brand + key glyph
//   • SSO / enterprise — merchant brand + building glyph
//   • Sign out — neutral outline + arrow-out
//
// All share the primary_action_label + primary_action_href roles so
// smartSwap preserves the label across variants.

import Link from "next/link";
import { buttonRegistry } from "../buttonRegistry";
import {
  resolveState,
  shapeToStyle,
  sizeToFontPx,
  sizeToHeightPx,
  sizeToPaddingXPx
} from "../themeAdapter";
import { MotionScope } from "../motion/MotionScope";
import type {
  ButtonRegistration,
  ButtonRendererProps
} from "../types";

type Auth = { label: string; href: string };

// ─── Shared renderer ────────────────────────────────

function AuthRenderer({
  reg,
  logo,
  ...props
}: {
  reg: ButtonRegistration<Auth>;
  logo: React.ReactNode;
} & ButtonRendererProps<Auth>) {
  const { config, state, tokens, size, shape, motion, mode, onEvent } = props;
  const resolved = resolveState(reg, state, tokens);
  const height = sizeToHeightPx(size);
  const paddingX = sizeToPaddingXPx(size);
  const font = sizeToFontPx(size);
  const shapeCss = shapeToStyle(shape);
  return (
    <MotionScope motion={motion} state={state}>
      {({ animation }) => (
        <Link
          href={config.href || "#"}
          onClick={() => onEvent?.({ event: "click" })}
          tabIndex={mode === "edit" ? -1 : undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            justifyContent: "center",
            maxWidth: 360,
            height,
            paddingLeft: paddingX,
            paddingRight: paddingX,
            fontSize: font,
            fontWeight: 600,
            background: resolved.background,
            color: resolved.ink,
            border: resolved.borderWidth
              ? `${resolved.borderWidth}px solid ${resolved.border}`
              : "none",
            boxShadow: resolved.shadow,
            transform: resolved.transform,
            opacity: resolved.opacity,
            transition: "transform 120ms ease-out, box-shadow 120ms ease-out, background 120ms ease-out",
            animation,
            cursor: "pointer",
            ...shapeCss
          }}
        >
          <span
            aria-hidden="true"
            style={{ display: "inline-flex", alignItems: "center" }}
          >
            {logo}
          </span>
          <span>{config.label}</span>
        </Link>
      )}
    </MotionScope>
  );
}

// ─── Logos (inline SVG, brand-safe paths) ───────────

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.5 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.7-.2-3.3-.5-4.9H24v9.3h12.7c-.5 3-2.2 5.6-4.7 7.3l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6z"/>
      <path fill="#FBBC05" d="M10.4 28.6c-.5-1.5-.8-3.1-.8-4.6s.3-3.1.8-4.6l-7.9-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.5 10.7l7.9-6.1z"/>
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.2 2.3-6.3 0-11.6-4.2-13.6-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
    </svg>
  );
}
function AppleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.28c-.03-3.02 2.47-4.48 2.58-4.55-1.4-2.05-3.59-2.33-4.37-2.36-1.86-.19-3.63 1.09-4.57 1.09-.95 0-2.4-1.07-3.94-1.04-2.03.03-3.9 1.18-4.94 3-2.11 3.65-.54 9.04 1.52 12 .99 1.45 2.17 3.08 3.71 3.02 1.5-.06 2.06-.96 3.86-.96 1.79 0 2.31.96 3.9.93 1.61-.03 2.63-1.48 3.62-2.94 1.14-1.68 1.6-3.31 1.63-3.4-.04-.02-3.12-1.19-3.15-4.79zM14.3 4.03c.83-1.01 1.39-2.41 1.24-3.8-1.19.05-2.64.79-3.5 1.79-.77.89-1.44 2.31-1.26 3.68 1.33.1 2.69-.67 3.52-1.67z"/>
    </svg>
  );
}
function FacebookLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12c0-6.6-5.4-12-12-12S0 5.4 0 12c0 6 4.4 11 10.1 11.9v-8.4H7.1V12h3v-2.3c0-3 1.8-4.6 4.5-4.6 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4C19.6 23 24 18 24 12z"/>
    </svg>
  );
}
function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
function GithubLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.3 11.3 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/>
    </svg>
  );
}
function LinkedinLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.2 0H1.8C.8 0 0 .8 0 1.7v20.5c0 1 .8 1.7 1.8 1.7h20.5c1 0 1.8-.8 1.8-1.7V1.7c0-1-.8-1.7-1.8-1.7zM7.1 20.5H3.6V9h3.6v11.5zM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zm15.2 13.1H17V15c0-1.3 0-3-1.9-3-1.8 0-2.1 1.5-2.1 3v5.6H9.5V9H13v1.6c.5-1 1.7-2 3.5-2 3.7 0 4.4 2.4 4.4 5.6v6.4z"/>
    </svg>
  );
}
function EnvelopeGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>
    </svg>
  );
}
function KeyGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="14" r="4"/><path d="M11.3 12.7 22 2m-5 5 3 3M15 9l3 3"/>
    </svg>
  );
}
function BuildingGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M2 22h20M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>
    </svg>
  );
}
function SignOutGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

// ─── Registrations ──────────────────────────────────

const REGS: Record<string, ButtonRegistration<Auth>> = {};

type AuthSpec = {
  id: string;
  name: string;
  defaultLabel: string;
  defaultHref: string;
  bg: string;
  ink: string;
  border?: string;
  shortPitch: string;
  logo: React.ReactNode;
  telemetryKey: string;
};

const SPECS: AuthSpec[] = [
  {
    id: "auth.google_1",
    name: "Sign in with Google",
    defaultLabel: "Sign in with Google",
    defaultHref: "/auth/google",
    bg: "#FFFFFF",
    ink: "#3C4043",
    border: "#DADCE0",
    shortPitch: "Google's canonical sign-in — light theme.",
    logo: <GoogleLogo />,
    telemetryKey: "auth.google"
  },
  {
    id: "auth.apple_1",
    name: "Sign in with Apple",
    defaultLabel: "Sign in with Apple",
    defaultHref: "/auth/apple",
    bg: "#000000",
    ink: "#FFFFFF",
    shortPitch: "Apple HIG — solid black with the Apple mark.",
    logo: <AppleLogo />,
    telemetryKey: "auth.apple"
  },
  {
    id: "auth.facebook_1",
    name: "Continue with Facebook",
    defaultLabel: "Continue with Facebook",
    defaultHref: "/auth/facebook",
    bg: "#1877F2",
    ink: "#FFFFFF",
    shortPitch: "Meta brand blue with white F.",
    logo: <FacebookLogo />,
    telemetryKey: "auth.facebook"
  },
  {
    id: "auth.microsoft_1",
    name: "Sign in with Microsoft",
    defaultLabel: "Sign in with Microsoft",
    defaultHref: "/auth/microsoft",
    bg: "#FFFFFF",
    ink: "#5E5E5E",
    border: "#8C8C8C",
    shortPitch: "Microsoft-safe: white with the coloured squares.",
    logo: <MicrosoftLogo />,
    telemetryKey: "auth.microsoft"
  },
  {
    id: "auth.github_1",
    name: "Continue with GitHub",
    defaultLabel: "Continue with GitHub",
    defaultHref: "/auth/github",
    bg: "#24292F",
    ink: "#FFFFFF",
    shortPitch: "GitHub brand — Octocat on onyx.",
    logo: <GithubLogo />,
    telemetryKey: "auth.github"
  },
  {
    id: "auth.linkedin_1",
    name: "Sign in with LinkedIn",
    defaultLabel: "Sign in with LinkedIn",
    defaultHref: "/auth/linkedin",
    bg: "#0A66C2",
    ink: "#FFFFFF",
    shortPitch: "LinkedIn brand blue.",
    logo: <LinkedinLogo />,
    telemetryKey: "auth.linkedin"
  },
  {
    id: "auth.magic_link_1",
    name: "Email magic link",
    defaultLabel: "Send me a magic link",
    defaultHref: "/auth/magic",
    bg: "#0A0A0A",
    ink: "#FFFFFF",
    shortPitch: "No-password email flow.",
    logo: <EnvelopeGlyph />,
    telemetryKey: "auth.magic"
  },
  {
    id: "auth.passkey_1",
    name: "Sign in with Passkey",
    defaultLabel: "Sign in with a passkey",
    defaultHref: "/auth/passkey",
    bg: "#FFB300",
    ink: "#0A0A0A",
    shortPitch: "WebAuthn — the phishing-resistant default.",
    logo: <KeyGlyph />,
    telemetryKey: "auth.passkey"
  },
  {
    id: "auth.sso_1",
    name: "Sign in with SSO",
    defaultLabel: "Sign in with SSO",
    defaultHref: "/auth/sso",
    bg: "#FFFFFF",
    ink: "#0A0A0A",
    border: "#D4D4D4",
    shortPitch: "Enterprise / SAML flow.",
    logo: <BuildingGlyph />,
    telemetryKey: "auth.sso"
  },
  {
    id: "auth.sign_out_1",
    name: "Sign out",
    defaultLabel: "Sign out",
    defaultHref: "/auth/signout",
    bg: "transparent",
    ink: "#0A0A0A",
    border: "#D4D4D4",
    shortPitch: "Neutral outline. Confirms in a modal if wired.",
    logo: <SignOutGlyph />,
    telemetryKey: "auth.signout"
  }
];

for (const s of SPECS) {
  const reg: ButtonRegistration<Auth> = {
    id: s.id,
    name: s.name,
    version: "1.0.0",
    category: "utility",
    role: "primary_action",
    description: `${s.name} — brand-safe provider CTA.`,
    shortPitch: s.shortPitch,
    editableFields: [
      { key: "label", label: "Label", type: { kind: "text", maxLength: 40 }, default: s.defaultLabel, role: "primary_action_label", priority: "text", aiPromptable: true, description: "Provider brand guidelines usually require 'Sign in with X' or 'Continue with X' — keep the provider name.", group: "Content" },
      { key: "href", label: "Auth endpoint", type: { kind: "link" }, default: s.defaultHref, role: "primary_action_href", group: "Content" }
    ],
    states: {
      default: {
        backgroundLiteral: s.bg,
        inkLiteral: s.ink,
        borderLiteral: s.border ?? "transparent",
        borderWidthPx: s.border ? 1 : 0,
        shadowPreset: "soft"
      },
      hover: { translateYPx: -1, shadowPreset: "floating" },
      focus_visible: { shadowPreset: "glow" },
      pressed: { scale: 0.98 },
      loading: { opacity: 0.7 },
      disabled: { opacity: 0.4 }
    },
    motion: { hover: "lift", press: "shrink", focus: "glow", loading: "spinner" },
    shape: { kind: "rect", radiusPx: 8 },
    size: "md",
    themeTokensUsed: [],
    a11y: {
      ariaLabelFor: (c) => (c.label as string) || s.name,
      role: "link",
      activateOnSpace: false
    },
    telemetry: { eventOnClick: s.telemetryKey, payloadKeys: ["href"] },
    conversionHints: {
      primaryActionRecommended: true,
      aboveFoldRecommended: false,
      minContrast: 4.5,
      minTapTargetPx: 44
    },
    aiPrompts: {
      explain: `Explain when a ${s.name} button is the highest-converting choice.`,
      improveCopy: "Provider guidelines pin the brand name — only adjust the verb ('Sign in' vs 'Continue' vs 'Log in').",
      improveStyle: "Provider brand assets are protected — style adjustments limited to size, radius, and shadow.",
      restyle: "Apply {mood} but keep brand mark intact.",
      generateFromBrief: `Provider-safe ${s.name} button.`,
      scoreConversion: "Assess conversion friction — mostly about placement and load speed.",
      scoreAccessibility: "Contrast + tap + focus outline.",
      suggestIcon: "Brand mark is fixed."
    },
    searchKeywords: ["auth", "sign in", "login", s.name.toLowerCase()],
    defaultConfig: () => ({ label: s.defaultLabel, href: s.defaultHref }),
    renderer: (props) => (
      <AuthRenderer reg={REGS[s.id]} logo={s.logo} {...props} />
    )
  };
  REGS[s.id] = reg;
  buttonRegistry.register(reg);
}
