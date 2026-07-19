"use client";

// GuestActivationModal — the "Activate my storage" popup.
//
// Fires when a guest visitor (no account yet, just a cookie with
// their SiteBook nickname) tries to do anything that requires
// persistent storage — create a project, upload a photo, invite a
// trade.
//
// Copy is deliberately warm: framing signup as "activate storage"
// makes the account creation feel like unlocking their own safe,
// not "give us your data".
//
// On successful activation:
//   - Server creates the real hammerex_homeowners row with the
//     guest nickname as house_nickname
//   - Guest cookie is cleared, real session cookie is set
//   - Success toast fires
//   - Parent component routes the user onward

import { useState } from "react";
import { X, ShieldCheck, Check } from "lucide-react";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

type Props = {
  nickname:    string;
  onClose:     () => void;
  onActivated: () => void;
};

export function GuestActivationModal({ nickname, onClose, onActivated }: Props) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [postcode, setPostcode]   = useState("");
  const [whatsapp, setWhatsapp]   = useState("");
  const [status, setStatus]       = useState<"idle" | "activating" | "activated" | "error">("idle");
  const [errorMsg, setErrorMsg]   = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("activating");
    setErrorMsg("");

    const res = await fetch("/api/homeowner/activate", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        firstName,
        email,
        password,
        postcode:       postcode || undefined,
        whatsappNumber: whatsapp || undefined
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setStatus("error");
      setErrorMsg(errorFor(data.error) || "Something went wrong. Try again.");
      return;
    }

    // Success state — show the toast-style confirmation for 1.5s then
    // hand off to the parent (which routes to /sitebook/new).
    setStatus("activated");
    setTimeout(onActivated, 1600);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(10,10,10,0.65)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="activate-title"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        {/* Close button — only visible until activated */}
        {status !== "activated" && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close"
          >
            <X size={16}/>
          </button>
        )}

        {status === "activated" ? (
          <ActivatedSuccessState nickname={nickname}/>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "#FFFBEB", color: "#7A5B00" }}>
                <ShieldCheck size={18}/>
              </span>
              <p className="text-[10.5px] font-black uppercase tracking-[0.16em] text-neutral-500">Activate your storage</p>
            </div>
            <h2 id="activate-title" className="mt-3 text-[22px] font-black leading-tight text-neutral-900">
              Let&rsquo;s get your account active
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">
              We&rsquo;ll set up secure storage for <span className="font-black">{nickname}</span> — every photo, quote, warranty and message will save automatically from now on.
            </p>

            <form onSubmit={onSubmit} className="mt-5 space-y-3">
              <Field label="First name" htmlFor="af-firstname">
                <input
                  id="af-firstname"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="Sarah"
                />
              </Field>
              <Field label="Email" htmlFor="af-email">
                <input
                  id="af-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="you@your-email.com"
                />
              </Field>
              <Field label="Password" htmlFor="af-password" hint="8+ characters — you'll use this to log back in.">
                <input
                  id="af-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Postcode (optional)" htmlFor="af-postcode">
                  <input
                    id="af-postcode"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400 uppercase"
                    placeholder="M15 5EQ"
                  />
                </Field>
                <Field label="WhatsApp (optional)" htmlFor="af-whatsapp">
                  <input
                    id="af-whatsapp"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder="+44..."
                  />
                </Field>
              </div>

              {status === "error" && errorMsg && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-[11.5px] font-bold text-red-800">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === "activating"}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[12px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-95 disabled:opacity-60"
                style={{ backgroundColor: BRAND_GREEN }}
              >
                {status === "activating" ? "Activating…" : "Activate my storage →"}
              </button>

              <p className="text-center text-[10.5px] text-neutral-500">
                Free forever. No card. Your data belongs to you — export anytime.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function ActivatedSuccessState({ nickname }: { nickname: string }) {
  return (
    <div className="py-4 text-center">
      <div
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: BRAND_GREEN, color: "#FFFFFF" }}
      >
        <Check size={32} strokeWidth={3}/>
      </div>
      <h2 className="mt-4 text-[20px] font-black text-neutral-900">
        Your SiteBook back-end is fully active.
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-neutral-700">
        <span className="font-black">{nickname}</span> is ready. You can post projects, upload photos and files, invite trades — everything will save automatically.
      </p>
      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-green-800">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500"/>
        Taking you to your project form…
      </div>
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-neutral-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10.5px] text-neutral-500">{hint}</span>}
    </label>
  );
}

function errorFor(code?: string): string | null {
  const map: Record<string, string> = {
    "invalid-email":       "That doesn't look like a valid email.",
    "password-too-short":  "Password must be at least 8 characters.",
    "missing-first-name":  "Please enter your first name.",
    "missing-nickname":    "Your SiteBook name is missing — start again from the landing.",
    "email-in-use":        "This email is already registered. Log in instead.",
    "no-guest":            "Session expired. Please start again from the landing.",
    "signup-failed":       "Something went wrong. Try again."
  };
  return code ? (map[code] || null) : null;
}
