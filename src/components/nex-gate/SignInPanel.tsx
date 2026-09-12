"use client";

// src/components/nex-gate/SignInPanel.tsx
//
// NEX Glass Gate · reference-match authentication controls
// Philip 2026-09-07
//
// Real Supabase auth via signInWithPassword. Honest states only:
//
//   idle       · nothing pending · user can type/submit
//   signing_in · request in flight · Sign-In disabled
//   error      · last request failed · error text visible · user can retry
//   opening    · auth returned a session · parent starts the reveal
//                transition · Sign-In stays disabled so a double-submit
//                can't retrigger the network call
//
// §7 · Face Recognition is NOT rendered here. NEX has no biometric
// authentication infrastructure today · showing a face-recognition
// affordance that fakes a scan would violate §7 and §17. When real
// biometrics ship, this is where they would slot in.
//
// §18 · Errors preserve the atmosphere. Compact single line, no giant
// red boxes.
//
// Reference composition delivered by this component:
//   · EMAIL label + email input with envelope icon
//   · PASSWORD label + password input with lock icon + eye toggle
//   · SIGN IN button with animated shine (see .primaryShine in CSS)
//   · Create Account row with cyan energy lines and dot terminators
//
// The bottom N mark is rendered by <GlassGate> itself · outside the
// panel · because it sits below the create-account row and is purely
// decorative branding.

import { useCallback, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import styles from "./glass-gate.module.css";

export type SignInPanelProps = {
  /** Fires when Supabase returns a session. Parent should play the
   *  cinematic reveal transition and then redirect to /nexapp. */
  onAuthenticated: () => void;
};

type Phase = "idle" | "signing_in" | "error" | "opening";

/** Envelope icon (email). Currentcolor · inherits text color. */
function EnvelopeIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={props.className} aria-hidden>
      <path d="M3.5 6.5A2.5 2.5 0 0 1 6 4h12a2.5 2.5 0 0 1 2.5 2.5v11A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5v-11Z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** Lock icon (password). */
function LockIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={props.className} aria-hidden>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="15.5" r="1.4" fill="currentColor"/>
    </svg>
  );
}

/** Eye · shown when password is hidden (click to reveal). */
function EyeIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={props.className} aria-hidden>
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

/** Eye-off · shown when password is revealed (click to hide). */
function EyeOffIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={props.className} aria-hidden>
      <path d="M3.5 3.5 20.5 20.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6.6 6.7C4.15 8.4 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.85 0 3.5-.5 4.9-1.25M9.9 5.55C10.6 5.4 11.3 5.5 12 5.5c6 0 9.5 6.5 9.5 6.5s-.87 1.6-2.6 3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M9.5 9.6a3.2 3.2 0 0 0 4.6 4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function SignInPanel({ onAuthenticated }: SignInPanelProps) {
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [phase,       setPhase]       = useState<Phase>("idle");
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);

  const canSubmit = email.length > 3 && password.length > 0 && (phase === "idle" || phase === "error");

  const submit = useCallback(async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!canSubmit) return;

    setPhase("signing_in");
    setErrorMsg(null);

    // NEX authenticates against the NEX Supabase project (Project B ·
    // ijvqdvsvwtwxzcqmoqit). The generic NEXT_PUBLIC_SUPABASE_URL vars
    // point at the legacy trades/hammerex project (Project A) and MUST
    // NOT be used for NEX auth per the NEX Supabase Authority Reset.
    const url  = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      setPhase("error");
      setErrorMsg("NEX authentication isn't configured on this build.");
      return;
    }

    try {
      const supabase = createBrowserClient(url, anon);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setPhase("error");
        const message = (error.message || "").trim();
        const short = message.length > 0 && message.length <= 120 ? message : null;
        setErrorMsg(short ?? "We couldn't open NEX. Please try again.");
        return;
      }
      if (!data?.session) {
        setPhase("error");
        setErrorMsg("NEX didn't return a session. Please try again.");
        return;
      }
      setPhase("opening");
      onAuthenticated();
    } catch (err) {
      setPhase("error");
      const detail = err instanceof Error ? err.message : String(err);
      const isNetwork = /fetch failed|Failed to fetch|network|ENOTFOUND|ECONNREFUSED/i.test(detail);
      setErrorMsg(isNetwork
        ? "We couldn't reach NEX right now. Please try again in a moment."
        : "We couldn't open NEX. Please try again.");
    }
  }, [canSubmit, email, password, onAuthenticated]);

  const busy = phase === "signing_in" || phase === "opening";

  return (
    <>
      <form className={styles.panel} onSubmit={submit} data-testid="nex-gate-signin" data-phase={phase} noValidate>
        <label className={styles.fieldLabel} htmlFor="nex-gate-email">EMAIL</label>
        <div className={styles.inputWrap}>
          <EnvelopeIcon className={styles.inputIcon} />
          <input
            id="nex-gate-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={styles.input}
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            data-testid="nex-gate-email"
          />
        </div>

        <div className={styles.fieldGap} aria-hidden />

        <label className={styles.fieldLabel} htmlFor="nex-gate-password">PASSWORD</label>
        <div className={styles.inputWrap}>
          <LockIcon className={styles.inputIcon} />
          <input
            id="nex-gate-password"
            type={showPass ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className={styles.input}
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            data-testid="nex-gate-password"
          />
          <button
            type="button"
            className={styles.eyeButton}
            aria-label={showPass ? "Hide password" : "Show password"}
            aria-pressed={showPass}
            onClick={() => setShowPass((v) => !v)}
            data-testid="nex-gate-eye"
            tabIndex={0}
          >
            {showPass ? <EyeOffIcon className={styles.eyeIcon} /> : <EyeIcon className={styles.eyeIcon} />}
          </button>
        </div>

        <div className={styles.buttonGap} aria-hidden />

        <button
          type="submit"
          className={styles.primary}
          disabled={!canSubmit || busy}
          data-testid="nex-gate-submit"
        >
          <span>{phase === "signing_in" ? "OPENING…" : phase === "opening" ? "ENTERING…" : "SIGN IN"}</span>
          <span className={styles.primaryShine} aria-hidden />
        </button>
      </form>

      {phase === "signing_in" && (
        <div className={styles.status} role="status" aria-live="polite">
          Opening NEX{"…"}
        </div>
      )}
      {phase === "opening" && (
        <div className={styles.status} role="status" aria-live="polite">
          Entering
        </div>
      )}
      {phase === "error" && errorMsg && (
        <div className={styles.error} role="alert" data-testid="nex-gate-error">
          {errorMsg}
        </div>
      )}

      {/* Create Account row · positioned absolutely at the reference
          coordinates by the .createRow class. Sign-up flow is a
          separate authorized slice · this button surfaces an honest
          inline note rather than routing nowhere. */}
      <div className={styles.createRow}>
        <span className={`${styles.createLine} ${styles.createLineLeft}`} aria-hidden />
        <button
          type="button"
          className={styles.createButton}
          disabled={busy}
          onClick={() => {
            setErrorMsg("Creating a NEX account isn't available on this build yet.");
            setPhase("error");
          }}
          data-testid="nex-gate-create-account"
        >
          Create account
        </button>
        <span className={`${styles.createLine} ${styles.createLineRight}`} aria-hidden />
      </div>
    </>
  );
}
