// SignInPromptModal — action-triggered guest sign-in gate.
//
// When a guest attempts an action that requires state (save merchant,
// add to quote, message merchant), any component calls
// useSignInPrompt().open({ reason, next }) and this modal appears.
//
// Modal shows the two role cards (Trade / DIY) so the visitor picks
// their app type in one tap. Selection routes to /tc/sign-in with
// role= and next= params — the sign-in page handles OTP / password
// as usual and deep-links back on success. No auth flow embedded
// inside the modal itself (keeps the modal simple and reuses the
// existing sign-in route).

"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, HardHat, Home, ArrowRight } from "lucide-react";

// ─── Context ────────────────────────────────────────────────────────

type OpenOptions = {
  /** Short human-readable reason shown in the modal ("save this to
   *  your quote", "message this merchant"). */
  reason?: string;
  /** URL to return to after successful sign-in. Defaults to current
   *  pathname. */
  next?: string;
};

type Ctx = {
  open: (opts?: OpenOptions) => void;
  close: () => void;
};

const SignInPromptContext = createContext<Ctx | null>(null);

export function useSignInPrompt(): Ctx {
  const ctx = useContext(SignInPromptContext);
  if (!ctx) {
    throw new Error("useSignInPrompt must be used within <SignInPromptProvider>");
  }
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────

export function SignInPromptProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; opts: OpenOptions }>({
    open: false,
    opts: {}
  });
  const pathname = usePathname() ?? "/tc/trade-center";

  const open = useCallback((opts: OpenOptions = {}) => {
    setState({ open: true, opts });
  }, []);
  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const nextParam = encodeURIComponent(state.opts.next ?? pathname);

  return (
    <SignInPromptContext.Provider value={{ open, close }}>
      {children}
      {state.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signin-prompt-title"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close sign-in prompt"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={close}
          />

          {/* Modal card */}
          <div
            className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between border-b px-5 py-4"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div>
                <div
                  className="text-[9px] font-black uppercase tracking-[0.18em]"
                  style={{ color: "#FFB300" }}
                >
                  Free · 30 seconds
                </div>
                <h2
                  id="signin-prompt-title"
                  className="mt-1 text-[16px] font-black text-neutral-900"
                >
                  {state.opts.reason
                    ? `Create an account to ${state.opts.reason}`
                    : "Create an account to continue"}
                </h2>
                <p className="mt-1 text-[12px] text-neutral-500">
                  Pick the app that fits you. You can change later.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
              >
                <X size={16}/>
              </button>
            </div>

            {/* Role cards */}
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
              <RoleCard
                href={`/tc/sign-in?next=${nextParam}&signup=1&role=trade`}
                icon={<HardHat size={22} strokeWidth={2}/>}
                title="I'm a trade"
                subtitle="Yard, trade prices, merchant tools"
                accent="#FFB300"
                onNavigate={close}
              />
              <RoleCard
                href={`/tc/sign-in?next=${nextParam}&signup=1&role=diy`}
                icon={<Home size={22} strokeWidth={2}/>}
                title="I'm doing DIY"
                subtitle="Browse, quote, home projects"
                accent="#3B82F6"
                onNavigate={close}
              />
            </div>

            {/* Already have an account footer */}
            <div
              className="border-t bg-neutral-50 px-5 py-3 text-center text-[12px] text-neutral-600"
              style={{ borderColor: "rgba(139,69,19,0.10)" }}
            >
              Already have an account?{" "}
              <Link
                href={`/tc/sign-in?next=${nextParam}`}
                onClick={close}
                className="inline-flex items-center gap-1 font-black text-neutral-900 hover:underline"
              >
                Sign in
                <ArrowRight size={11}/>
              </Link>
            </div>
          </div>
        </div>
      )}
    </SignInPromptContext.Provider>
  );
}

// ─── Role card ──────────────────────────────────────────────────────

function RoleCard({
  href,
  icon,
  title,
  subtitle,
  accent,
  onNavigate
}: {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  accent: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="group flex flex-col gap-2 rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md"
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
    </Link>
  );
}
