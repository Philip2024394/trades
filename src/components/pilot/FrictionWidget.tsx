// Floating "was this clear?" chip — attach to any screen. Only renders
// when NEXT_PUBLIC_PILOT_COHORT is set on the page's server context or
// via localStorage override, so production pages don't show it.
"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Loader2, X, CheckCircle2 } from "lucide-react";

const COHORT_STORAGE_KEY = "xrt:pilot-cohort";
const ACTOR_STORAGE_KEY = "xrt:pilot-actor";

export type FrictionWidgetProps = {
  screenId: string;
  defaultActor?: "merchant" | "homeowner" | "trade" | "admin";
  /** Overrides the cohort resolution (defaults to localStorage). */
  cohort?: string;
};

type Severity = "stuck" | "confusion" | "minor" | "positive";

const SEVERITY_META: Array<{ key: Severity; label: string; emoji: string }> = [
  { key: "stuck", label: "Stuck", emoji: "🛑" },
  { key: "confusion", label: "Confusing", emoji: "🤔" },
  { key: "minor", label: "Just a note", emoji: "📝" },
  { key: "positive", label: "Loved it", emoji: "❤️" }
];

export function FrictionWidget({
  screenId,
  defaultActor = "homeowner",
  cohort: cohortProp
}: FrictionWidgetProps) {
  const [cohort, setCohort] = useState<string | null>(null);
  const [actor, setActor] = useState<
    "merchant" | "homeowner" | "trade" | "admin"
  >(defaultActor);
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState<Severity>("confusion");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (cohortProp) {
      setCohort(cohortProp);
      return;
    }
    const stored = window.localStorage.getItem(COHORT_STORAGE_KEY);
    if (stored) setCohort(stored);
    const storedActor = window.localStorage.getItem(
      ACTOR_STORAGE_KEY
    ) as typeof actor | null;
    if (storedActor) setActor(storedActor);
  }, [cohortProp]);

  if (!cohort) return null;

  async function submit() {
    if (body.trim().length < 3) return;
    setSubmitting(true);
    try {
      await fetch("/api/os/pilot/friction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cohort,
          screenId,
          severity,
          actorKind: actor,
          body,
          context: {
            url: typeof window !== "undefined" ? window.location.href : null,
            referrer: typeof document !== "undefined" ? document.referrer : null,
            ua: typeof navigator !== "undefined" ? navigator.userAgent : null
          }
        })
      });
      setSent(true);
      setBody("");
      setTimeout(() => {
        setSent(false);
        setOpen(false);
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report friction"
        className="fixed bottom-4 right-4 z-40 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-neutral-900 px-3 text-[13px] font-semibold text-white shadow-lg hover:bg-neutral-800"
      >
        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
        Was this clear?
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[320px] max-w-[calc(100vw-2rem)] rounded-xl border border-neutral-200 bg-white p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Quick feedback
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {sent ? (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-[13px] font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Thanks — logged.
        </div>
      ) : (
        <>
          <div className="mb-2 grid grid-cols-4 gap-1">
            {SEVERITY_META.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSeverity(s.key)}
                className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-[13px] transition ${
                  severity === s.key
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                }`}
              >
                <span className="text-base leading-none">{s.emoji}</span>
                <span className="text-[13px] font-semibold">{s.label}</span>
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="What happened? (30 seconds is enough)"
            className="block w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[14px] outline-none focus:border-neutral-900"
          />
          <div className="mt-2 flex items-center justify-between gap-2 text-[13px]">
            <select
              value={actor}
              onChange={(e) => {
                setActor(e.target.value as typeof actor);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem(ACTOR_STORAGE_KEY, e.target.value);
                }
              }}
              className="min-h-[36px] rounded border border-neutral-200 bg-white px-2"
            >
              <option value="merchant">I'm the merchant</option>
              <option value="homeowner">I'm the homeowner</option>
              <option value="trade">I'm the trade</option>
              <option value="admin">Admin/observer</option>
            </select>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || body.trim().length < 3}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-neutral-900 px-3 text-[13px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : null}
              Send
            </button>
          </div>
          <p className="mt-2 text-[13px] text-neutral-500">
            Screen · <span className="font-mono">{screenId}</span>
          </p>
        </>
      )}
    </div>
  );
}
