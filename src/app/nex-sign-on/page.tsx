// src/app/nex-sign-on/page.tsx · Philip 2026-08-29 · 2026-08-31
//
// NEX sign-on · mobile-first · white background.
//
// Flow:
//   Step 1 · Phone entry with country-prefix picker (+62 Indonesia / +44 UK)
//            Prefix choice ALSO decides the user's app language for now:
//            +62 → id (Bahasa Indonesia) · +44 → en (English)
//   Step 2 · 6-digit OTP verification (WhatsApp for +62 · SMS for +44)
//   Step 3 · Success handoff (redirect to app or profile)
//   OR    · Continue as guest (anonymous device UUID browsing)
//
// Doctrine anchors:
//   · project_nex_data_safety_no_localstorage_2026_08_28.md
//     (Phone number is a stable identity · maps to nex_id later on backend)
//   · WhatsApp OTP for Indonesia (everyone has WhatsApp) · SMS OTP for UK
//   · Free infrastructure principle: WhatsApp Business API is unavoidable
//     third-party spend for auth · budget-approved category.
//   · Stage 3.31 (project_nex_brain_accommodation_fluency_id_stage_3_31_2026_08_31.md):
//     app must serve EN + ID as first-class languages. Prefix capture at
//     account creation is the FIRST persistence point for the user's
//     language preference. This screen's own copy localizes immediately
//     when the prefix flips so ID users never see English while picking
//     +62 (and vice versa for UK users).
//
// Storage: language written to localStorage as `nex_user_lang` = "id" | "en".
// Backend hookup (write to user profile) lands with the auth backend.
//
// Design: white bg · black text · orange accent · 44px min tap targets ·
// safe-area padding for iOS notch · large friendly headings · no framework.

"use client";

import React, { useEffect, useRef, useState } from "react";

type Step = "phone" | "otp" | "done";

const OTP_LEN = 6;
const OTP_RESEND_SECONDS = 60;

// ─── Country prefix registry ─────────────────────────────────────────
//
// Prefix → { E.164 dial code, human label, app language, phone digit
// range, OTP delivery channel }. Keep bounded to markets NEX serves in
// production. Broader ISO picker deferred until the +62/+44 flow is
// proven. Digit ranges are inclusive counts of digits AFTER the prefix.
type PrefixCode = "+62" | "+44" | "+1" | "+61" | "+65" | "+64" | "+91";

type Prefix = {
  code: PrefixCode;
  country: string;
  flag: string;
  lang: "id" | "en";
  minDigits: number;
  maxDigits: number;
  channel: "whatsapp" | "sms";
  placeholder: string;
};

// Stage 3.33 · expanded from binary +62/+44 to seven markets covering
// Indonesia (WhatsApp/id) + six English-speaking markets (SMS/en). All
// new markets default lang="en" · when a language pack for a market's
// primary language ships (Hindi for +91, French for +33, etc.), the
// lang field flips + a new pack is added to src/lib/nex/i18n/packs.
// Channel per market is fixed by business decision · see
// src/lib/nex/signon/otp-dispatch.ts channelForPrefix().
const PREFIXES: readonly Prefix[] = [
  { code: "+62", country: "Indonesia",      flag: "🇮🇩", lang: "id", minDigits: 8,  maxDigits: 13, channel: "whatsapp", placeholder: "8123456789" },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧", lang: "en", minDigits: 9,  maxDigits: 11, channel: "sms",      placeholder: "7700900123" },
  { code: "+1",  country: "United States",  flag: "🇺🇸", lang: "en", minDigits: 10, maxDigits: 10, channel: "sms",      placeholder: "2025550123" },
  { code: "+61", country: "Australia",      flag: "🇦🇺", lang: "en", minDigits: 9,  maxDigits: 9,  channel: "sms",      placeholder: "412345678"  },
  { code: "+65", country: "Singapore",      flag: "🇸🇬", lang: "en", minDigits: 8,  maxDigits: 8,  channel: "sms",      placeholder: "81234567"   },
  { code: "+64", country: "New Zealand",    flag: "🇳🇿", lang: "en", minDigits: 8,  maxDigits: 10, channel: "sms",      placeholder: "211234567"  },
  { code: "+91", country: "India",          flag: "🇮🇳", lang: "en", minDigits: 10, maxDigits: 10, channel: "sms",      placeholder: "9876543210" },
] as const;

const DEFAULT_PREFIX: Prefix = PREFIXES[0];

// ─── Per-screen string pack ──────────────────────────────────────────
//
// Scoped mini i18n for this screen only. When the app-wide i18n
// framework lands, this pack folds into it. Every string here is a
// UI label · none of it is user-visible NEX content, so no doctrine
// conflict with the Brain's accommodation fluency work (which handles
// AI-generated reply text).
type Copy = {
  welcome: string;
  enterNumber: string;
  otpSubtitle: (channel: Prefix["channel"]) => string;
  phoneLabel: string;
  continueBtn: string;
  sending: string;
  terms: string;
  guestBtn: string;
  guestNote: string;
  otpTitle: string;
  otpSentTo: string;
  verifyBtn: string;
  verifying: string;
  resendIn: (s: number) => string;
  resendCta: string;
  changeNumber: string;
  doneTitle: string;
  doneNote: string;
  continueApp: string;
  errNoNumber: string;
  errBadCode: string;
  errProviderMissing: string;
  errSendFailed: string;
};

const COPY_ID: Copy = {
  welcome:      "Selamat datang",
  enterNumber:  "Masukkan nomor telepon Anda.\nKami akan kirim kode 6 digit untuk masuk.",
  otpSubtitle:  (c) => c === "whatsapp" ? "Kami akan kirim kode 6 digit via WhatsApp." : "Kami akan kirim kode 6 digit via SMS.",
  phoneLabel:   "Nomor telepon",
  continueBtn:  "Lanjutkan",
  sending:      "Mengirim kode…",
  terms:        "Dengan melanjutkan, Anda menyetujui Ketentuan & Kebijakan Privasi NEX (PDP Indonesia UU 27/2022).",
  guestBtn:     "Lanjutkan sebagai tamu",
  guestNote:    "Jelajahi tanpa akun · data tersimpan hanya di perangkat ini sampai Anda masuk.",
  otpTitle:     "Masukkan kode",
  otpSentTo:    "Dikirim ke",
  verifyBtn:    "Verifikasi",
  verifying:    "Memverifikasi…",
  resendIn:     (s) => `Kirim ulang dalam ${s}s`,
  resendCta:    "Kirim ulang kode",
  changeNumber: "← Gunakan nomor lain",
  doneTitle:    "Anda berhasil masuk",
  doneNote:     "Selamat datang di NEX. Data Anda disimpan aman berdasarkan hukum PDP Indonesia.",
  continueApp:  "Lanjut ke NEX",
  errNoNumber:  "Masukkan nomor telepon Anda",
  errBadCode:   "Masukkan kode 6 digit",
  errProviderMissing: "Layanan pengiriman kode belum aktif. Coba lagi nanti.",
  errSendFailed:      "Gagal mengirim kode. Periksa koneksi dan coba lagi.",
};

const COPY_EN: Copy = {
  welcome:      "Welcome",
  enterNumber:  "Enter your phone number.\nWe'll send a 6-digit code to sign you in.",
  otpSubtitle:  (c) => c === "whatsapp" ? "We'll send a 6-digit code via WhatsApp." : "We'll send a 6-digit code by SMS.",
  phoneLabel:   "Phone number",
  continueBtn:  "Continue",
  sending:      "Sending code…",
  terms:        "By continuing you agree to NEX's Terms & Privacy Notice.",
  guestBtn:     "Continue as guest",
  guestNote:    "Browse without an account · saved things live only on this device until you sign in.",
  otpTitle:     "Enter your code",
  otpSentTo:    "Sent to",
  verifyBtn:    "Verify",
  verifying:    "Verifying…",
  resendIn:     (s) => `Resend code in ${s}s`,
  resendCta:    "Resend code",
  changeNumber: "← Use a different number",
  doneTitle:    "You're in",
  doneNote:     "Welcome to NEX. Your account and preferences are securely stored.",
  continueApp:  "Continue to NEX",
  errNoNumber:  "Enter your phone number",
  errBadCode:   "Enter the 6-digit code",
  errProviderMissing: "The code service isn't active yet. Please try again later.",
  errSendFailed:      "Couldn't send the code. Check your connection and try again.",
};

function copyFor(lang: Prefix["lang"]): Copy {
  return lang === "id" ? COPY_ID : COPY_EN;
}

// Local device-id helper · matches sitewide data-safety pattern.
function ensureDeviceId(): string {
  if (typeof window === "undefined") return "device:preview-ssr";
  let id = localStorage.getItem("nex_device_id");
  if (!id || !id.startsWith("device:")) {
    id = "device:" + (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem("nex_device_id", id);
  }
  return id;
}

export default function NexSignOnPage() {
  const [step, setStep] = useState<Step>("phone");
  const [prefix, setPrefix] = useState<Prefix>(DEFAULT_PREFIX);
  const [prefixPickerOpen, setPrefixPickerOpen] = useState(false);
  const [phoneDigits, setPhoneDigits] = useState("");     // digits after the prefix
  const [otp, setOtp] = useState<string[]>(Array(OTP_LEN).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const t = copyFor(prefix.lang);

  useEffect(() => { ensureDeviceId(); }, []);

  // Persist the language preference immediately when the prefix changes.
  // This is the app's first-and-only source of truth for lang until the
  // auth backend is wired · consumers read `localStorage.nex_user_lang`
  // and default to "id" when missing (Indonesia is the primary market).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem("nex_user_lang", prefix.lang); } catch { /* private-mode fallthrough */ }
  }, [prefix.lang]);

  // OTP resend countdown
  useEffect(() => {
    if (step !== "otp" || resendIn <= 0) return;
    const interval = setInterval(() => setResendIn((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(interval);
  }, [step, resendIn]);

  const fullE164 = prefix.code + phoneDigits;
  const phoneValid = new RegExp(`^\\d{${prefix.minDigits},${prefix.maxDigits}}$`).test(phoneDigits);
  const otpValid = otp.every((d) => /^\d$/.test(d));

  function choosePrefix(next: Prefix) {
    setPrefix(next);
    setPrefixPickerOpen(false);
    setError(null);
    // Reset the phone digits if they no longer fit the new prefix's range.
    // Prevents a user who typed a 13-digit Indonesian number then switched
    // to +44 (max 11) from seeing a stale invalid state.
    if (phoneDigits.length > next.maxDigits) setPhoneDigits(phoneDigits.slice(0, next.maxDigits));
  }

  async function sendCode() {
    if (!phoneValid) { setError(t.errNoNumber); return; }
    setBusy(true); setError(null);
    // Stage 3.33 · calls the real /api/nex-sign-on/otp/send endpoint.
    // Returns 501 when the provider (WhatsApp / SMS) credentials aren't
    // configured — client surfaces that as an honest error rather than
    // silently pretending the code was sent.
    try {
      const res = await fetch("/api/nex-sign-on/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneDigits, prefix: prefix.code }),
      });
      if (res.status === 501) {
        setBusy(false);
        setError(t.errProviderMissing);
        return;
      }
      if (!res.ok) {
        setBusy(false);
        setError(t.errSendFailed);
        return;
      }
    } catch {
      setBusy(false);
      setError(t.errSendFailed);
      return;
    }
    setBusy(false);
    setStep("otp");
    setResendIn(OTP_RESEND_SECONDS);
    setTimeout(() => otpRefs.current[0]?.focus(), 40);
  }

  async function verifyCode() {
    if (!otpValid) { setError(t.errBadCode); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/nex-sign-on/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneDigits,
          prefix: prefix.code,
          code: otp.join(""),
        }),
      });
      if (!res.ok) {
        setBusy(false);
        setError(t.errBadCode);
        return;
      }
    } catch {
      setBusy(false);
      setError(t.errBadCode);
      return;
    }
    setBusy(false);
    setStep("done");
  }

  function handleOtpChange(i: number, v: string) {
    const digit = v.replace(/\D/g, "").slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[i] = digit;
      return next;
    });
    if (digit && i < OTP_LEN - 1) otpRefs.current[i + 1]?.focus();
  }
  function handleOtpKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }
  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LEN);
    if (!text) return;
    e.preventDefault();
    const arr = Array(OTP_LEN).fill("").map((_, i) => text[i] ?? "");
    setOtp(arr);
    otpRefs.current[Math.min(text.length, OTP_LEN - 1)]?.focus();
  }

  return (
    <div style={{
      // Outer gutter · dark radial atmosphere matching SIGNON_THEME.
      // On phones the phone-shaped frame fills the viewport; on desktop
      // the frame centres with atmosphere around it. Stage 3.32 ·
      // Philip 2026-08-31.
      minHeight: "100dvh",
      background: "radial-gradient(circle at 50% 30%, #1a1a1e 0%, #0a0a0c 100%)",
      color: "#0a0e18",
      fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}>
      {/* Phone-shaped frame · arrival variant · Stage 3.32.
          Frame PNG paints the industrial bezel + top wordmark + top-right
          hex indicators + bottom orange pill. Interior of the PNG is
          transparent so the sign-on form paints through it. */}
      <div style={{
        position: "relative",
        width: "min(420px, 100%)",
        aspectRatio: "851 / 1849",
        background: "#ffffff",
      }}>
        {/* Interior content · sign-on form. Padded to sit inside the frame's
            interior viewport (bezel takes ~7% on the sides · ~6% top · ~11%
            bottom for the orange pill housing). */}
        <div style={{
          position: "absolute",
          inset: "6% 7% 11% 7%",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          // Preserve iOS safe-area on the inner container so the notch
          // doesn't clip the wordmark.
          paddingTop:    "max(env(safe-area-inset-top), 12px)",
          paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
          paddingLeft:   "max(env(safe-area-inset-left), 8px)",
          paddingRight:  "max(env(safe-area-inset-right), 8px)",
          boxSizing: "border-box",
        }}>
        <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", flex: 1 }}>

        {/* Wordmark */}
        <div style={{
          marginTop: 12,
          marginBottom: 40,
          textAlign: "center",
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: -1,
          color: "#0a0e18",
        }}>
          NEX
        </div>

        {step === "phone" && (
          <>
            <h1 style={{
              fontSize: 26,
              fontWeight: 700,
              margin: "0 0 8px",
              letterSpacing: -0.4,
              lineHeight: 1.15,
            }}>
              {t.welcome}
            </h1>
            <p style={{
              fontSize: 15,
              color: "#4b5563",
              margin: "0 0 32px",
              lineHeight: 1.5,
              whiteSpace: "pre-line",
            }}>
              {t.enterNumber}
            </p>

            <label style={{ display: "block", position: "relative" }}>
              <span style={{
                fontSize: 12, fontWeight: 600, color: "#4b5563",
                letterSpacing: 0.4, textTransform: "uppercase",
                display: "block", marginBottom: 8,
              }}>
                {t.phoneLabel}
              </span>
              <div style={{
                display: "flex", alignItems: "stretch",
                border: "1px solid #d1d5db",
                borderRadius: 12,
                background: "#f9fafb",
                overflow: "hidden",
                transition: "border-color 150ms ease, background 150ms ease",
              }}>
                <button
                  type="button"
                  onClick={() => setPrefixPickerOpen((o) => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={prefixPickerOpen}
                  aria-label={`${prefix.country} ${prefix.code}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "0 12px 0 14px",
                    fontSize: 16, fontWeight: 600, color: "#0a0e18",
                    background: "#f3f4f6",
                    borderRight: "1px solid #e5e7eb",
                    border: "none",
                    cursor: "pointer",
                    minWidth: 88,
                  }}>
                  <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>{prefix.flag}</span>
                  <span>{prefix.code}</span>
                  <span aria-hidden="true" style={{
                    fontSize: 10, color: "#6b7280", marginLeft: 2,
                    transform: prefixPickerOpen ? "rotate(180deg)" : "none",
                    transition: "transform 120ms ease",
                  }}>▾</span>
                </button>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phoneDigits}
                  onChange={(e) => { setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, prefix.maxDigits)); setError(null); }}
                  placeholder={prefix.placeholder}
                  style={{
                    flex: 1,
                    padding: "16px 14px",
                    fontSize: 17,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: "#0a0e18",
                    minHeight: 52,
                    letterSpacing: 0.5,
                  }}
                />
              </div>
              {prefixPickerOpen && (
                <ul
                  role="listbox"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)", left: 0,
                    width: "100%", maxWidth: 360,
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                    listStyle: "none", padding: 6, margin: 0,
                    zIndex: 20,
                  }}>
                  {PREFIXES.map((p) => (
                    <li key={p.code}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={p.code === prefix.code}
                        onClick={() => choosePrefix(p)}
                        style={{
                          width: "100%", minHeight: 48,
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 12px",
                          background: p.code === prefix.code ? "#fff7ed" : "transparent",
                          border: "none", borderRadius: 8,
                          fontSize: 15, color: "#0a0e18", fontWeight: 500,
                          cursor: "pointer", textAlign: "left",
                        }}>
                        <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>{p.flag}</span>
                        <span style={{ flex: 1 }}>{p.country}</span>
                        <span style={{ color: "#6b7280", fontWeight: 600 }}>{p.code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </label>

            {error && <ErrorLine>{error}</ErrorLine>}

            <button
              onClick={sendCode}
              disabled={busy || !phoneValid}
              style={{
                marginTop: 20,
                width: "100%",
                minHeight: 52,
                padding: "14px 16px",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 0.3,
                border: "none",
                borderRadius: 12,
                background: phoneValid ? "#f97316" : "#e5e7eb",
                color: phoneValid ? "#ffffff" : "#9ca3af",
                cursor: phoneValid ? "pointer" : "not-allowed",
                transition: "background 150ms ease, opacity 150ms ease",
                opacity: busy ? 0.6 : 1,
              }}>
              {busy ? t.sending : t.continueBtn}
            </button>

            <p style={{
              marginTop: 16, fontSize: 12, color: "#6b7280",
              textAlign: "center", lineHeight: 1.5,
            }}>
              {t.terms}
            </p>

            <div style={{ marginTop: "auto", paddingTop: 32 }}>
              <button
                onClick={() => setStep("done")}
                style={{
                  width: "100%",
                  minHeight: 48,
                  padding: "12px 16px",
                  fontSize: 15,
                  fontWeight: 600,
                  background: "transparent",
                  color: "#4b5563",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  cursor: "pointer",
                }}>
                {t.guestBtn}
              </button>
              <p style={{
                marginTop: 8, fontSize: 11, color: "#9ca3af",
                textAlign: "center", lineHeight: 1.5,
              }}>
                {t.guestNote}
              </p>
            </div>
          </>
        )}

        {step === "otp" && (
          <>
            <h1 style={{
              fontSize: 26, fontWeight: 700, margin: "0 0 8px", letterSpacing: -0.4, lineHeight: 1.15,
            }}>
              {t.otpTitle}
            </h1>
            <p style={{
              fontSize: 15, color: "#4b5563", margin: "0 0 28px", lineHeight: 1.5,
            }}>
              {t.otpSentTo} <span style={{ fontWeight: 600, color: "#0a0e18" }}>{fullE164}</span>
              {" · "}{t.otpSubtitle(prefix.channel)}
            </p>

            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${OTP_LEN}, 1fr)`,
              gap: 8,
              marginBottom: 8,
            }}>
              {otp.map((v, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="tel"
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  value={v}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKey(i, e)}
                  onPaste={handleOtpPaste}
                  style={{
                    height: 56,
                    fontSize: 24,
                    fontWeight: 700,
                    textAlign: "center",
                    border: `1px solid ${v ? "#0a0e18" : "#d1d5db"}`,
                    borderRadius: 12,
                    background: "#f9fafb",
                    color: "#0a0e18",
                    outline: "none",
                    fontVariantNumeric: "tabular-nums",
                  }}
                />
              ))}
            </div>

            {error && <ErrorLine>{error}</ErrorLine>}

            <button
              onClick={verifyCode}
              disabled={busy || !otpValid}
              style={{
                marginTop: 16,
                width: "100%",
                minHeight: 52,
                padding: "14px 16px",
                fontSize: 16,
                fontWeight: 700,
                border: "none",
                borderRadius: 12,
                background: otpValid ? "#f97316" : "#e5e7eb",
                color: otpValid ? "#ffffff" : "#9ca3af",
                cursor: otpValid ? "pointer" : "not-allowed",
                opacity: busy ? 0.6 : 1,
              }}>
              {busy ? t.verifying : t.verifyBtn}
            </button>

            <div style={{
              marginTop: 16, textAlign: "center",
              fontSize: 14, color: "#6b7280",
            }}>
              {resendIn > 0 ? (
                <span>{t.resendIn(resendIn)}</span>
              ) : (
                <button
                  onClick={() => { setOtp(Array(OTP_LEN).fill("")); setResendIn(OTP_RESEND_SECONDS); }}
                  style={{
                    background: "none", border: "none", padding: 0,
                    color: "#f97316", fontWeight: 700, cursor: "pointer", fontSize: 14,
                  }}>{t.resendCta}</button>
              )}
            </div>

            <button
              onClick={() => { setStep("phone"); setError(null); }}
              style={{
                marginTop: 20,
                background: "none", border: "none",
                color: "#6b7280", fontSize: 14, cursor: "pointer",
                alignSelf: "center",
              }}>
              {t.changeNumber}
            </button>
          </>
        )}

        {step === "done" && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 16, textAlign: "center", paddingTop: 40,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 999,
              background: "linear-gradient(135deg, #f97316, #ec4899)",
              display: "grid", placeItems: "center",
              color: "#fff", fontSize: 34, fontWeight: 800,
              boxShadow: "0 8px 24px rgba(249,115,22,0.35)",
            }}>✓</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>
              {t.doneTitle}
            </h1>
            <p style={{ fontSize: 15, color: "#4b5563", margin: 0, maxWidth: 320, lineHeight: 1.5 }}>
              {t.doneNote}
            </p>
            <button
              onClick={() => window.location.href = "/nexapp"}
              style={{
                marginTop: 20, width: "100%", minHeight: 52,
                padding: "14px 16px", fontSize: 16, fontWeight: 700,
                border: "none", borderRadius: 12,
                background: "#0a0e18", color: "#fff", cursor: "pointer",
              }}>
              {t.continueApp}
            </button>
          </div>
        )}
      </div>
        </div>

        {/* Arrival bezel · PNG overlay · pointer-events none so the sign-on
            form inside stays fully interactive. z above content but below
            any modal overlays a future toast/error surface might add. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nex/hud-frame-v13-arrival.png"
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 5,
          }}
        />
      </div>
    </div>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: 12,
      padding: "10px 12px",
      borderRadius: 10,
      background: "#fef2f2",
      border: "1px solid #fecaca",
      color: "#b91c1c",
      fontSize: 13,
      lineHeight: 1.4,
    }}>{children}</div>
  );
}
