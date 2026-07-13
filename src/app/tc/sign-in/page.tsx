// /tc/sign-in — Trade Center sign-in / sign-up.
//
// Design brief:
//   • Fast OAuth (Google + Facebook) up top — most trades pick this.
//   • Email + WhatsApp OTP below the fold as the fallback.
//   • Same flow for sign-in and sign-up — one code, no password.
//   • Header treatment matches the "Network" wordmark: yellow dot +
//     "The Network" wordmark, subtitle "Sign in or create account".

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, MessageCircle, Mail, ShieldCheck, Loader2, Send, HardHat, Home, ArrowRight } from "lucide-react";
import { HowItWorksButton } from "@/apps/hub/components/HowItWorksButton";
import { mergeGuestBasketToServer, drainGuestBasket } from "@/apps/marketplace/lib/useGuestBasket";

type Channel = "whatsapp" | "email";
type ViewerRole = "trade" | "diy";

const CHANNELS: Array<{
  key: Channel;
  label: string;
  hint: string;
  Icon: typeof MessageCircle;
  placeholder: string;
  inputMode: "tel" | "email";
}> = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    hint: "6-digit code via WhatsApp.",
    Icon: MessageCircle,
    placeholder: "07…",
    inputMode: "tel"
  },
  {
    key: "email",
    label: "Email",
    hint: "6-digit code to your inbox.",
    Icon: Mail,
    placeholder: "you@work.co.uk",
    inputMode: "email"
  }
];

export default function TradeSignInPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get("next") ?? "/tc/notebook";
  // Signup intent + optional pre-selected role from the header pill /
  // SignInPromptModal deep-link. When signup=1 and no role is pre-set,
  // gate the sign-in UI behind a two-card role picker so we know who
  // we're creating an account for.
  const signupIntent = params?.get("signup") === "1";
  const preRole = params?.get("role");
  const initialRole: ViewerRole | null =
    preRole === "trade" || preRole === "diy" ? preRole : null;
  const [viewerRole, setViewerRole] = useState<ViewerRole | null>(
    signupIntent ? initialRole : "trade"
  );
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [destination, setDestination] = useState("");
  const [step, setStep] = useState<"destination" | "code" | "sending" | "verifying">("destination");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [magicLinkStatus, setMagicLinkStatus] = useState<"idle" | "sending" | "sent">("idle");

  const active = CHANNELS.find((c) => c.key === channel)!;
  const inRolePick = viewerRole === null;

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!destination.trim()) return;
    setStep("sending");
    setError(null);
    try {
      const res = await fetch("/api/auth/trade/otp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel, destination })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? String(res.status));
      setDevCode(json.devCode ?? null);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "send_failed");
      setStep("destination");
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return;
    setStep("verifying");
    setError(null);
    try {
      // Peek at the guest basket without draining — if verify fails we
      // must not lose the items. Only drain on success.
      const guestBasket = (() => {
        try {
          const raw = typeof window !== "undefined"
            ? window.localStorage.getItem("tc.guest-basket")
            : null;
          const parsed = raw ? JSON.parse(raw) : [];
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();
      const res = await fetch("/api/auth/trade/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel,
          destination,
          code,
          // Only meaningful for new signups; ignored server-side on
          // existing users so a returning trade can't get re-roled.
          viewerRole: viewerRole ?? "trade",
          // Belt + braces: server-side merge as part of the verify txn.
          // If it fails or the migration isn't applied, the client-side
          // mergeGuestBasketToServer() below is a fallback.
          guestBasket
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? String(res.status));
      // Server already merged — drain localStorage so the client-side
      // useGuestBasket server-fetch on the next mount reads the fresh
      // authoritative state. mergeGuestBasketToServer is a no-op fallback
      // if anything hit localStorage between drain and here.
      drainGuestBasket();
      mergeGuestBasketToServer().catch(() => null);
      router.push(json.newUser ? `/tc/complete-identity?next=${encodeURIComponent(next)}` : next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "verify_failed");
      setStep("code");
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(magicLinkEmail)) return;
    setMagicLinkStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/auth/trade/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: magicLinkEmail, next })
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? String(res.status));
      }
      setMagicLinkStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "magic_link_failed");
      setMagicLinkStatus("idle");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      {/* Network-style top bar */}
      <header
        className="sticky top-0 z-20 border-b bg-[#FBF6EC]/95 backdrop-blur"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/tc/hub"
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full border bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 shadow-sm hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <ArrowLeft size={12}/>
            Back
          </Link>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: "#FFB300" }}
              aria-hidden
            />
            <div className="leading-none">
              <div className="text-[13px] font-black tracking-tight text-neutral-900">
                THE NETWORK
              </div>
              <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-neutral-500">
                Sign in or create account
              </div>
            </div>
          </div>
          <HowItWorksButton topic="sign-in" variant="ghost"/>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pt-8 pb-16 md:pt-14">
        {inRolePick ? (
          <>
            {/* Two-card role picker — signup-only pre-step. */}
            <div className="text-center">
              <div
                className="mx-auto inline-block rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em]"
                style={{ backgroundColor: "#FEF3C7", color: "#0A0A0A" }}
              >
                Free · 30 seconds
              </div>
              <h1 className="mt-3 text-[26px] font-black leading-tight text-neutral-900 md:text-[32px]">
                Which describes you?
              </h1>
              <p className="mx-auto mt-2 max-w-xs text-[12.5px] leading-relaxed text-neutral-500">
                Pick the app that fits. Both are free. You can't change later, so choose the one you'll use most.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RoleCard
                icon={<HardHat size={22} strokeWidth={2}/>}
                title="I'm a trade"
                subtitle="Yard, trade prices, merchant tools"
                accent="#FFB300"
                onSelect={() => setViewerRole("trade")}
              />
              <RoleCard
                icon={<Home size={22} strokeWidth={2}/>}
                title="I'm doing DIY"
                subtitle="Browse, quote, home projects"
                accent="#3B82F6"
                onSelect={() => setViewerRole("diy")}
              />
            </div>

            <div className="mt-2 text-center text-[11.5px] text-neutral-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setViewerRole("trade")}
                className="inline-flex items-center gap-1 font-black text-neutral-900 hover:underline"
              >
                Sign in
                <ArrowRight size={11}/>
              </button>
            </div>
          </>
        ) : (
          <>
        {/* Hero */}
        <div className="text-center">
          {viewerRole === "diy" ? (
            <>
              <div
                className="mx-auto inline-block rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em]"
                style={{ backgroundColor: "#DBEAFE", color: "#0A0A0A" }}
              >
                DIY · Free
              </div>
              <h1 className="mt-3 text-[28px] font-black leading-tight text-neutral-900 md:text-[34px]">
                One tap in.
              </h1>
              <p className="mx-auto mt-2 max-w-xs text-[12.5px] leading-relaxed text-neutral-500">
                Browse merchants, request quotes, track projects. No passwords, no verification loops.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-[28px] font-black leading-tight text-neutral-900 md:text-[34px]">
                One tap in.
              </h1>
              <p className="mx-auto mt-2 max-w-xs text-[12.5px] leading-relaxed text-neutral-500">
                Same flow for new + returning trades. No passwords, no email verification loops.
              </p>
            </>
          )}
          {signupIntent && (
            <button
              type="button"
              onClick={() => setViewerRole(null)}
              className="mx-auto mt-3 inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-600 shadow-sm hover:bg-neutral-50"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <ArrowLeft size={10}/>
              Change role
            </button>
          )}
        </div>

        {/* OAuth — pinned top. Carries the selected role through the
            OAuth flow so DIY signups via Google/Facebook aren't
            silently defaulted to trade at profile provisioning. */}
        <div className="flex flex-col gap-2.5">
          <a
            href={`/api/auth/trade/google?next=${encodeURIComponent(next)}&role=${viewerRole ?? "trade"}`}
            className="inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-full border bg-white px-6 text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
          >
            <GoogleGlyph/>
            Continue with Google
          </a>
          <a
            href={`/api/auth/trade/facebook?next=${encodeURIComponent(next)}&role=${viewerRole ?? "trade"}`}
            className="inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-full px-6 text-[13px] font-black uppercase tracking-wider text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            style={{ backgroundColor: "#1877F2" }}
          >
            <FacebookGlyph/>
            Continue with Facebook
          </a>
        </div>

        {step === "destination" && (
          <div className="my-1 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
            <span className="h-px flex-1 bg-neutral-200"/>
            or use a code
            <span className="h-px flex-1 bg-neutral-200"/>
          </div>
        )}

        {/* Channel tabs — WhatsApp green when active, Email white when active */}
        {step === "destination" && (
          <div
            className="grid grid-cols-2 gap-1 rounded-full border bg-white p-1 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            {CHANNELS.map((c) => {
              const activeTab = channel === c.key;
              const brand = c.key === "whatsapp"
                ? { active: "#25D366", activeText: "#0A0A0A" }
                : { active: "#FFFFFF", activeText: "#0A0A0A" };
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setChannel(c.key)}
                  aria-pressed={activeTab}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full text-[11.5px] font-black uppercase tracking-wider transition"
                  style={{
                    backgroundColor: activeTab ? brand.active : "transparent",
                    color:           activeTab ? brand.activeText : "#525252",
                    boxShadow:       activeTab && c.key === "email" ? "inset 0 0 0 1px rgba(139,69,19,0.2)" : undefined
                  }}
                >
                  <c.Icon size={13}/>
                  {c.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Destination entry */}
        {step === "destination" && (
          <form onSubmit={sendOtp} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                {active.label === "Email" ? "Email address" : "WhatsApp number"}
              </span>
              <input
                type={active.inputMode === "email" ? "email" : "tel"}
                inputMode={active.inputMode}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={active.placeholder}
                className="min-h-[52px] rounded-xl border bg-white px-4 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400"
                style={{ borderColor: "rgba(139,69,19,0.18)" }}
                autoFocus
                autoComplete={active.inputMode === "email" ? "email" : "tel"}
              />
              <span className="text-[10.5px] leading-snug text-neutral-500">{active.hint}</span>
            </label>

            {error && (
              <div className="rounded-md bg-red-50 p-2.5 text-[11px] text-red-700">
                {friendlyError(error)}
              </div>
            )}

            <button
              type="submit"
              disabled={!destination.trim()}
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-40"
              style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
            >
              Send code
            </button>

            {/* [DEV BUTTON] — remove on "remove dev buttons" */}
            <div className="mt-1 flex justify-center">
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  setStep("verifying");
                  try {
                    const res = await fetch("/api/auth/trade/dev-signin", { method: "POST" });
                    if (!res.ok) {
                      const json = await res.json().catch(() => ({}));
                      throw new Error(json.error ?? String(res.status));
                    }
                    router.push(next);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "dev_signin_failed");
                    setStep("destination");
                  }
                }}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[9.5px] font-black uppercase tracking-wider shadow-sm"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
                title="Dev-only bypass — signs in as Demo Trade with no OTP"
              >
                Dev · Pass
              </button>
            </div>
            {/* [/DEV BUTTON] */}
          </form>
        )}

        {step === "sending" && (
          <div className="flex flex-col items-center gap-2 py-10">
            <Loader2 size={22} className="animate-spin text-neutral-500"/>
            <div className="text-[12px] font-black text-neutral-900">Sending your code…</div>
          </div>
        )}

        {(step === "code" || step === "verifying") && (
          <form onSubmit={verifyOtp} className="flex flex-col gap-3">
            <div
              className="rounded-xl bg-white p-4 text-[11.5px] leading-snug text-neutral-600 shadow-sm"
              style={{ border: "1px solid rgba(139,69,19,0.12)" }}
            >
              We sent a 6-digit code to <strong className="text-neutral-900">{destination}</strong> via {active.label}.
              {devCode && (
                <div className="mt-1 text-[10.5px] text-neutral-500">
                  Dev code: <strong className="font-mono text-neutral-900">{devCode}</strong>
                </div>
              )}
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">6-digit code</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                placeholder="000000"
                className="min-h-[60px] rounded-xl border bg-white px-4 text-center font-mono text-[26px] font-black tracking-[0.4em] text-neutral-900 outline-none placeholder:text-neutral-300 focus:border-neutral-400"
                style={{ borderColor: "rgba(139,69,19,0.18)" }}
                autoFocus
                autoComplete="one-time-code"
              />
            </label>

            {error && (
              <div className="rounded-md bg-red-50 p-2.5 text-[11px] text-red-700">
                {friendlyError(error)}
              </div>
            )}

            <button
              type="submit"
              disabled={code.length !== 6 || step === "verifying"}
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider shadow-sm disabled:opacity-40"
              style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
            >
              <ShieldCheck size={14}/>
              {step === "verifying" ? "Verifying…" : "Sign in"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("destination");
                setCode("");
                setDevCode(null);
              }}
              className="mt-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
            >
              ← Change number / email
            </button>
          </form>
        )}

        {/* Magic link — one-click email sign-in, no code entry */}
        {step === "destination" && (
          <>
            <div className="mt-2 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
              <span className="h-px flex-1 bg-neutral-200"/>
              or email me a link
              <span className="h-px flex-1 bg-neutral-200"/>
            </div>
            {magicLinkStatus === "sent" ? (
              <div
                className="rounded-xl p-4 text-center text-[11.5px] leading-snug"
                style={{ backgroundColor: "#F0FDF4", border: "1px solid rgba(22,101,52,0.35)", color: "#166534" }}
              >
                Link sent to <strong>{magicLinkEmail}</strong>. Open your email on this device — one tap and you&apos;re in.
              </div>
            ) : (
              <form onSubmit={sendMagicLink} className="flex flex-col gap-2">
                <input
                  type="email"
                  inputMode="email"
                  value={magicLinkEmail}
                  onChange={(e) => setMagicLinkEmail(e.target.value)}
                  placeholder="you@work.co.uk"
                  className="min-h-[48px] rounded-xl border bg-white px-4 text-[13.5px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400"
                  style={{ borderColor: "rgba(139,69,19,0.18)" }}
                />
                <button
                  type="submit"
                  disabled={magicLinkStatus === "sending" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(magicLinkEmail)}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 text-[11.5px] font-black uppercase tracking-wider shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-40"
                  style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
                >
                  <Send size={12}/>
                  {magicLinkStatus === "sending" ? "Sending…" : "Email me a sign-in link"}
                </button>
              </form>
            )}
          </>
        )}

        <p className="mx-auto mt-6 max-w-sm text-center text-[10.5px] leading-snug text-neutral-500">
          By signing in you agree to Trade Center&apos;s fair-use terms. Zero commission on winning quotes.
          Trade Center never publishes your quote publicly.
        </p>
          </>
        )}
      </main>
    </div>
  );
}

function RoleCard({
  icon,
  title,
  subtitle,
  accent,
  onSelect
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex flex-col gap-2 rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: accent, color: "#0A0A0A" }}
      >
        {icon}
      </div>
      <div>
        <div className="text-[13.5px] font-black text-neutral-900">{title}</div>
        <div className="mt-0.5 text-[11px] text-neutral-500">{subtitle}</div>
      </div>
      <div className="mt-auto inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 group-hover:text-neutral-900">
        Continue
        <ArrowRight size={11}/>
      </div>
    </button>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function FacebookGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#FFFFFF" d="M13.5 21v-8h2.7l.4-3.2H13.5V7.7c0-.9.2-1.5 1.5-1.5H17V3.3c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5v2.5H7.3V13H10v8h3.5z"/>
    </svg>
  );
}

function friendlyError(err: string): string {
  switch (err) {
    case "invalid_code":                return "That code doesn't match. Try again.";
    case "code_expired_or_missing":     return "Code expired. Send a new one.";
    case "too_many_attempts":           return "Too many tries. Send a new code and try again.";
    case "invalid_channel":             return "Pick a channel above.";
    case "missing_destination":         return "Type your number or email first.";
    case "cooldown":                    return "Slow down — a code was just sent. Try again in a moment.";
    default:                            return `Something went wrong (${err}). Try again.`;
  }
}
