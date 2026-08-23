// NEX first-time identity onboarding.
//
// Concrete UI for pinned `project_nex_first_time_identity_onboarding_2026_08_21`.
// Renders inside the conversation frame when the identity localStorage is
// empty. Captures name + WhatsApp number + country. Country pick sets an
// INITIAL `conversation_language` hint (Indonesia→id, else→en) — brain
// still adapts from speech per Language-Neutral Brain doctrine.
//
// Explicit non-goals (per pinned `project_nex_should_know_not_ask`):
//   · NO EN/ID toggle · NO "Select Language" prompt
//   · NO marketing-consent checkbox (kept SEPARATE per privacy doctrine)
//   · NO extra fields beyond identity (city, address, business type etc.
//     are asked per-interaction later, not up-front)
// Feel: lightweight, intelligent-feeling, warmly minimal — must NOT read
// like a corporate registration form.
//
// Flow: form → Continue → brief "You're ready." moment (~650ms) → onComplete
// (Philip 2026-08-21: the "You're ready." transition prevents the form
// from snapping straight to chatbot · it's a deliberate moment).
//
// Field styling notes (Philip 2026-08-21):
//   · NO white dropdown on country pick — native <select> menus are
//     OS-controlled and can't be fully themed, so we use a custom
//     dark dropdown that stays inside the NEX aesthetic.
//   · NO white-fill on focus / autofill — browsers' autofill overlays
//     yellow/white backgrounds by default; neutralised via
//     -webkit-autofill CSS injected globally at module load.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import {
  NEX_COUNTRIES,
  DEFAULT_COUNTRY_CODE,
  findCountry,
  normaliseE164,
  type NexIdentityInput,
  type NexCountry,
} from "@/lib/nex-identity";

/**
 * flagcdn.com is a free, well-maintained SVG/PNG flag CDN. Chosen over
 * emoji flags because Windows 11 stock does NOT render regional-indicator
 * emoji (users see boxed country codes instead of a flag). ~1KB per
 * flag, loaded only when the picker mounts.
 */
function flagUrl(countryCode: string): string {
  return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
}

/** Transition duration for the "You're ready." moment before handoff. */
const READY_TRANSITION_MS = 650;

export function NexIdentityOnboarding({
  onComplete,
}: {
  // Form supplies user-provided fields only. The identity hook generates
  // the two IDs (internal + public NEX) per pinned
  // `project_nex_user_identity_id_model_2026_08_21`.
  onComplete: (identity: NexIdentityInput) => void;
}) {
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [pendingIdentity, setPendingIdentity] = useState<NexIdentityInput | null>(null);

  const country = useMemo(() => findCountry(countryCode) ?? NEX_COUNTRIES[0], [countryCode]);

  const canSubmit = name.trim().length >= 1 && phoneLocal.trim().length >= 4 && !isReady;

  function handleSubmit() {
    setError(null);
    const cleanName = name.trim();
    if (!cleanName) { setError("What should I call you?"); return; }
    const e164 = normaliseE164(phoneLocal, country.dialCode);
    if (!e164) { setError("That doesn't look like a valid phone number."); return; }
    const id: NexIdentityInput = {
      name: cleanName,
      countryCode: country.code,
      country: country.name,
      phoneNumber: e164,
      conversationLanguage: country.initialLanguage,
    };
    setPendingIdentity(id);
    setIsReady(true);
  }

  useEffect(() => {
    if (!isReady || !pendingIdentity) return;
    const t = setTimeout(() => {
      onComplete(pendingIdentity);
    }, READY_TRANSITION_MS);
    return () => clearTimeout(t);
  }, [isReady, pendingIdentity, onComplete]);

  // ── "You're ready." transition ─────────────────────────────
  if (isReady) {
    return (
      <div style={rootStyle} aria-live="polite">
        <div style={readyWrapStyle}>
          <div style={readyKickerStyle}>NEX</div>
          <div style={readyTitleStyle}>You&rsquo;re ready.</div>
        </div>
      </div>
    );
  }

  // ── Onboarding form ────────────────────────────────────────
  return (
    <div style={rootStyle}>
      <div style={introStyle}>
        <div style={introKickerStyle}>NEX</div>
        <div style={introTitleStyle}>Before we get started&hellip;</div>
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle} htmlFor="nex-onboard-name">What should I call you?</label>
        <input
          id="nex-onboard-name"
          className="nex-onboard-input"
          type="text"
          autoComplete="given-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) handleSubmit(); }}
          placeholder="Your name"
          maxLength={40}
          style={inputStyle}
          aria-invalid={!!error && !name.trim()}
          autoFocus
        />
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle} htmlFor="nex-onboard-phone">And your WhatsApp number?</label>
        <div style={phoneRowStyle}>
          <CountryPicker
            selected={country}
            onSelect={(code) => setCountryCode(code)}
          />
          <input
            id="nex-onboard-phone"
            className="nex-onboard-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phoneLocal}
            onChange={(e) => setPhoneLocal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) handleSubmit(); }}
            placeholder="Phone number"
            style={phoneInputStyle}
            aria-invalid={!!error && !phoneLocal.trim()}
          />
        </div>
      </div>

      {error && (
        <div role="alert" style={errorStyle}>{error}</div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={submitButtonStyle(canSubmit)}
      >
        Continue
      </button>

      <div style={privacyNoteStyle}>
        NEX uses your number to talk with you &mdash; never for marketing without your explicit permission.
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Custom country picker (Philip 2026-08-21).
// Native <select> was replaced because:
//   · Windows Chrome/Edge draw the dropdown menu in OS colours (white)
//   · <option> background/color CSS is unreliable across browsers
//   · Emoji flags don't render inside <option> on Windows
// This component gives full control: dark aesthetic · flag inline ·
// dial code · country name · click-outside to close · keyboard ESC.
// Intentionally minimal — no fuzzy search, no filter — 24 countries
// scroll fits comfortably in the popover.
// ────────────────────────────────────────────────────────────
function CountryPicker({
  selected,
  onSelect,
}: {
  selected: NexCountry;
  onSelect: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on click outside or ESC.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={pickerWrapStyle}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={pickerButtonStyle(open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country: ${selected.name} ${selected.dialCode}`}
      >
        <img
          src={flagUrl(selected.code)}
          alt=""
          width={22}
          height={16}
          style={flagImgStyle}
        />
        <span style={pickerDialStyle}>{selected.dialCode}</span>
        <span style={caretStyle(open)} aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul role="listbox" style={dropdownStyle}>
          {NEX_COUNTRIES.map((c) => {
            const isSelected = c.code === selected.code;
            return (
              <li
                key={c.code}
                role="option"
                aria-selected={isSelected}
                onClick={() => { onSelect(c.code); setOpen(false); }}
                style={dropdownItemStyle(isSelected)}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(249,115,22,0.10)"; }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isSelected
                    ? "rgba(249,115,22,0.08)"
                    : "transparent";
                }}
              >
                <img
                  src={flagUrl(c.code)}
                  alt=""
                  width={22}
                  height={16}
                  style={flagImgStyle}
                />
                <span style={dropdownDialStyle}>{c.dialCode}</span>
                <span style={dropdownNameStyle}>{c.name}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Styles (co-located · matches NexAppHome's inline-style pattern)
// ────────────────────────────────────────────────────────────

const rootStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: 18,
  padding: "22px 12px 8px",
};

const introStyle: React.CSSProperties = {
  marginBottom: 4,
};
const introKickerStyle: React.CSSProperties = {
  color: NEX.orange,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 2,
  marginBottom: 6,
};
const introTitleStyle: React.CSSProperties = {
  color: NEX.text,
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: -0.3,
  lineHeight: 1.2,
};

const fieldGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.75)",
  fontSize: 14,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: `1px solid rgba(255,255,255,0.12)`,
  borderRadius: 12,
  color: NEX.text,
  fontSize: 16,
  padding: "12px 14px",
  outline: "none",
  transition: "border-color 160ms ease, background 160ms ease",
  width: "100%",
  boxSizing: "border-box",
};

const phoneRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "stretch",
  position: "relative",   // so the country dropdown can position absolutely
};

const flagImgStyle: React.CSSProperties = {
  display: "block",
  borderRadius: 2,
  boxShadow: "0 0 0 1px rgba(0,0,0,0.15)",
  flex: "0 0 auto",
};

const phoneInputStyle: React.CSSProperties = {
  ...inputStyle,
  flex: 1,
  minWidth: 0,
};

// ── Country picker (custom dropdown) ──────────────────────
const pickerWrapStyle: React.CSSProperties = {
  position: "relative",
  flex: "0 0 auto",
};

function pickerButtonStyle(open: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${open ? NEX.orangeSoft : "rgba(255,255,255,0.12)"}`,
    borderRadius: 12,
    color: NEX.text,
    fontSize: 14,
    padding: "12px 12px",
    cursor: "pointer",
    outline: "none",
    height: "100%",
    boxSizing: "border-box",
    transition: "border-color 160ms ease, background 160ms ease",
  };
}

const pickerDialStyle: React.CSSProperties = {
  fontWeight: 500,
  letterSpacing: -0.1,
};

function caretStyle(open: boolean): React.CSSProperties {
  return {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    transform: open ? "rotate(180deg)" : "rotate(0deg)",
    transition: "transform 200ms ease",
  };
}

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  zIndex: 20,
  minWidth: 260,
  maxHeight: 260,
  overflowY: "auto",
  padding: 4,
  margin: 0,
  listStyle: "none",
  background: "#111",                                   // solid dark, NOT white
  border: `1px solid rgba(255,255,255,0.12)`,
  borderRadius: 12,
  boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
  animation: "nex-onboard-dropdown-in 160ms ease-out",
};

function dropdownItemStyle(selected: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 10px",
    borderRadius: 8,
    cursor: "pointer",
    color: NEX.text,
    fontSize: 14,
    background: selected ? "rgba(249,115,22,0.08)" : "transparent",
    transition: "background 120ms ease",
  };
}
const dropdownDialStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.65)",
  minWidth: 48,
  fontWeight: 500,
};
const dropdownNameStyle: React.CSSProperties = {
  color: NEX.text,
};

const errorStyle: React.CSSProperties = {
  color: NEX.orange,
  fontSize: 12,
  padding: "6px 10px",
  background: "rgba(249,115,22,0.10)",
  border: `1px solid ${NEX.orangeSoft}`,
  borderRadius: 10,
};

function submitButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    marginTop: 4,
    background: enabled ? NEX.orange : "rgba(255,255,255,0.08)",
    color: enabled ? "#0a0a0a" : "rgba(255,255,255,0.35)",
    border: "none",
    borderRadius: 999,
    padding: "12px 22px",
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: -0.1,
    cursor: enabled ? "pointer" : "not-allowed",
    alignSelf: "flex-start",
    transition: "background 160ms ease, color 160ms ease, transform 100ms ease",
  };
}

const privacyNoteStyle: React.CSSProperties = {
  marginTop: 4,
  color: "rgba(255,255,255,0.45)",
  fontSize: 11,
  lineHeight: 1.5,
  maxWidth: 380,
};

const readyWrapStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 220,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  animation: "nex-onboard-ready-in 380ms ease-out",
};
const readyKickerStyle: React.CSSProperties = {
  color: NEX.orange,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 2,
  opacity: 0.85,
};
const readyTitleStyle: React.CSSProperties = {
  color: NEX.text,
  fontSize: 26,
  fontWeight: 600,
  letterSpacing: -0.3,
  textShadow: `0 0 30px ${NEX.orangeGlowLo}`,
};

// Global keyframes + autofill neutralisation.
// -webkit-autofill: Chrome/Edge overlay a yellow/white background on
// autofilled inputs — visible pop-in of white behind the field. Fixed
// by matching the box-shadow to the NEX field background and forcing
// the text colour back to NEX text. Applied via the `.nex-onboard-input`
// class on <input> elements.
if (typeof document !== "undefined") {
  const KEYFRAME_ID = "nex-onboard-keyframes";
  if (!document.getElementById(KEYFRAME_ID)) {
    const style = document.createElement("style");
    style.id = KEYFRAME_ID;
    style.textContent = `
      @keyframes nex-onboard-ready-in {
        0%   { opacity: 0; transform: translateY(6px) scale(0.985); }
        100% { opacity: 1; transform: translateY(0)    scale(1); }
      }
      @keyframes nex-onboard-dropdown-in {
        0%   { opacity: 0; transform: translateY(-4px) scale(0.98); }
        100% { opacity: 1; transform: translateY(0)    scale(1); }
      }
      /* Neutralise browser autofill white/yellow overlay. Matches the
         NEX field background and text colour so autofill looks identical
         to a normally-typed field. */
      input.nex-onboard-input:-webkit-autofill,
      input.nex-onboard-input:-webkit-autofill:hover,
      input.nex-onboard-input:-webkit-autofill:focus,
      input.nex-onboard-input:-webkit-autofill:active {
        -webkit-box-shadow: 0 0 0 1000px #0a0a0a inset !important;
        -webkit-text-fill-color: #ffffff !important;
        caret-color: #ffffff !important;
        transition: background-color 5000s ease-in-out 0s !important;
      }
      /* Focus state: keep NEX field colour, only shift the border. */
      input.nex-onboard-input:focus {
        border-color: rgba(249, 115, 22, 0.55) !important;
        background: rgba(255,255,255,0.04) !important;
        outline: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}
