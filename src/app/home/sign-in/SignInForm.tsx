// Homeowner sign-in — email magic link now; WhatsApp toggle visible
// but disabled until the utility template lands (waiting on Meta review).

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Mail,
  MessageCircle,
  CheckCircle2,
  Shield,
  ChevronDown,
  ChevronUp
} from "lucide-react";

type Channel = "email" | "whatsapp";

export function SignInForm({
  errorParam,
  nextParam
}: {
  errorParam?: string;
  nextParam?: string;
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>("email");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminSecret, setAdminSecret] = useState("");
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = window.localStorage.getItem("xr_admin_bypass_secret");
    if (cached) setAdminSecret(cached);
    const cachedEmail = window.localStorage.getItem("xr_admin_bypass_email");
    if (cachedEmail) setAdminEmail(cachedEmail);
  }, []);

  async function adminSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAdminError(null);
    setAdminSubmitting(true);
    try {
      const res = await fetch("/api/os/homeowner/session/admin-bypass", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: adminEmail,
          secret: adminSecret,
          next: nextParam || "/home"
        })
      });
      const data = (await res.json()) as {
        ok: boolean;
        next?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setAdminError(
          data.error === "not_configured"
            ? "Admin bypass not enabled in this environment."
            : data.error === "unauthorised"
              ? "Wrong admin secret."
              : data.error === "invalid_email"
                ? "Enter a valid email."
                : "Bypass failed."
        );
        setAdminSubmitting(false);
        return;
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem("xr_admin_bypass_secret", adminSecret);
        window.localStorage.setItem("xr_admin_bypass_email", adminEmail);
      }
      router.push(data.next || "/home");
    } catch {
      setAdminError("Network error.");
      setAdminSubmitting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (channel !== "email") return; // WhatsApp not live yet
    setSubmitting(true);
    try {
      await fetch("/api/os/homeowner/session/send-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          next: nextParam || "/home"
        })
      });
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-400/40 bg-emerald-50 p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden />
          <div>
            <div className="text-[15px] font-black text-emerald-900">
              Check your inbox
            </div>
            <p className="mt-1 text-[13px] text-emerald-900/85">
              If we recognise <b>{email}</b>, we&apos;ve sent a sign-in link. It
              expires in 30 minutes.
            </p>
            <p className="mt-3 text-[12.5px] leading-snug text-emerald-900/60">
              Not seeing it? Check spam, or try a different email you may have
              used when you registered.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#1B1A17]/10 bg-white p-5 shadow-sm sm:p-6">
      {errorParam ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-800"
        >
          {errorParam === "expired"
            ? "That sign-in link expired. Ask for a new one below."
            : "Something went wrong with your sign-in link. Try again."}
        </div>
      ) : null}

      <div
        className="mb-4 grid grid-cols-2 gap-2"
        role="tablist"
        aria-label="Sign-in channel"
      >
        <ChannelTab
          active={channel === "email"}
          icon={<Mail className="h-4 w-4" aria-hidden />}
          label="Email"
          onClick={() => setChannel("email")}
        />
        <ChannelTab
          active={channel === "whatsapp"}
          icon={<MessageCircle className="h-4 w-4" aria-hidden />}
          label="WhatsApp"
          badge="Coming soon"
          onClick={() => setChannel("whatsapp")}
        />
      </div>

      {channel === "email" ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="block text-[13px] font-black text-[#1B1A17]">
            Your email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="min-h-[48px] w-full rounded-lg border border-[#1B1A17]/15 bg-white px-3 text-[14px] outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-300/40"
          />
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-amber-400 px-4 text-[14px] font-black text-[#0A0A0A] shadow-sm transition hover:bg-amber-300 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Sending…
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" aria-hidden />
                Send me a sign-in link
              </>
            )}
          </button>
          <p className="mt-1 text-[12.5px] leading-snug text-[#1B1A17]/60">
            We&apos;ll email you a one-time link. No password, no callback fee,
            no fuss.
          </p>

          {/* [DEV BUTTON] — remove on "remove dev buttons".
              Dev-only bypass: /api/auth/trade/dev-signin mints a demo
              trade session with no email or OTP. */}
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch("/api/auth/trade/dev-signin", { method: "POST" });
                  if (!res.ok) throw new Error(String(res.status));
                  router.push(nextParam ?? "/home");
                } catch {
                  /* silent — dev button */
                }
              }}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[9.5px] font-black uppercase tracking-wider shadow-sm"
              style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              title="Dev-only bypass — signs in as Demo Trade with no email or OTP"
            >
              Dev · Pass
            </button>
          </div>
          {/* [/DEV BUTTON] */}
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="block text-[13px] font-black text-[#1B1A17]">
            WhatsApp number
          </label>
          <input
            type="tel"
            disabled
            placeholder="+44 7…"
            className="min-h-[48px] w-full rounded-lg border border-[#1B1A17]/10 bg-neutral-50 px-3 text-[14px] text-neutral-400 outline-none"
          />
          <button
            type="button"
            disabled
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-neutral-200 px-4 text-[14px] font-black text-neutral-500"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Send me a sign-in link on WhatsApp
          </button>
          <p className="mt-1 text-[12.5px] leading-snug text-[#1B1A17]/60">
            WhatsApp sign-in is nearly ready — we&apos;re just waiting on
            template approval. For now, please use email.
          </p>
        </div>
      )}

      <div className="mt-6 border-t border-[#1B1A17]/10 pt-4">
        <button
          type="button"
          onClick={() => setAdminOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1B1A17]/50 hover:text-[#1B1A17]"
        >
          <Shield className="h-3.5 w-3.5" aria-hidden />
          Admin bypass (dev)
          {adminOpen ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>

        {adminOpen ? (
          <form
            onSubmit={adminSubmit}
            className="mt-3 flex flex-col gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-3"
          >
            <label className="text-[12px] font-semibold text-neutral-700">
              Impersonate email
            </label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
              placeholder="any@homeowner.com"
              className="min-h-[42px] w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] outline-none focus:border-neutral-900"
            />
            <label className="mt-2 text-[12px] font-semibold text-neutral-700">
              Admin secret
            </label>
            <input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              required
              placeholder="HOMEOWNER_ADMIN_BYPASS_SECRET"
              autoComplete="off"
              className="min-h-[42px] w-full rounded-lg border border-neutral-200 bg-white px-3 font-mono text-[12px] outline-none focus:border-neutral-900"
            />
            <button
              type="submit"
              disabled={adminSubmitting}
              className="mt-1 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-[13px] font-bold text-neutral-900 transition hover:bg-amber-400 disabled:opacity-60"
            >
              {adminSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                <>
                  <Shield className="h-3.5 w-3.5" aria-hidden />
                  Bypass and enter Notebook
                </>
              )}
            </button>
            {adminError ? (
              <p className="mt-1 text-[12px] text-red-700">{adminError}</p>
            ) : null}
            <p className="mt-1 text-[11px] leading-snug text-neutral-500">
              Server checks the secret against{" "}
              <code>HOMEOWNER_ADMIN_BYPASS_SECRET</code>. Every use is logged.
            </p>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function ChannelTab({
  active,
  icon,
  label,
  badge,
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border px-3 text-[13px] font-black transition ${
        active
          ? "border-amber-400 bg-amber-400 text-[#0A0A0A] shadow-sm"
          : "border-[#1B1A17]/10 bg-white text-[#1B1A17]/70 hover:border-[#1B1A17]/25"
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge ? (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] ${
            active
              ? "bg-[#0A0A0A]/15 text-[#0A0A0A]"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
