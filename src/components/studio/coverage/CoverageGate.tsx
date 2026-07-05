"use client";

// Coverage Radius Postcode Gate.
//
// Public-facing input widget. Visitor types postcode → we look it up on
// postcodes.io → haversine against the merchant's coverage centre →
// state flows through CoverageProvider so every other section reading
// useCoverage() can react.
//
// Three feedback states:
//   in-radius  → green pill with distance + confirmation copy
//   outside    → amber pill + honest "we don't cover you" copy
//   error      → red pill (unknown postcode / merchant not configured)

import { useState, type FormEvent } from "react";
import { useCoverage } from "./CoverageProvider";

const GREEN = "#10B981";
const AMBER = "#F59E0B";
const RED = "#DC2626";
const YELLOW = "#FFB300";

export function CoverageGate({
  heading = "Where do you need us?",
  subhead = "Type your postcode — we'll confirm in one second.",
  inRadiusCopy = "You're inside our coverage area. Standard response times apply.",
  outsideCopy = "You're outside our standard coverage. We may still travel — call to confirm.",
  errorCopy = "We couldn't find that postcode. Try again or type your outward code (e.g. NR1)."
}: {
  heading?: string;
  subhead?: string;
  inRadiusCopy?: string;
  outsideCopy?: string;
  errorCopy?: string;
}) {
  const {
    status,
    visitorPostcode,
    distanceMi,
    merchantPostcode,
    radiusMi,
    isNational,
    submitPostcode,
    clear
  } = useCoverage();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    try {
      await submitPostcode(input.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      <h2 className="text-[24px] font-extrabold leading-tight text-neutral-900">
        {heading}
      </h2>
      <p className="mt-2 text-[13px] text-neutral-600">
        {subhead}
        {isNational && (
          <>
            {" "}
            <span
              className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
              style={{ background: "#DCFCE7", color: "#166534" }}
            >
              National coverage
            </span>
          </>
        )}
      </p>

      {status === "unknown" && (
        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. NR1 2AB or SW9"
            aria-label="Your postcode"
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-3 text-[14px] font-medium outline-none focus:border-neutral-900"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="inline-flex h-12 items-center rounded-lg px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95 disabled:opacity-40"
            style={{ background: YELLOW }}
          >
            {busy ? "Checking…" : "Check"}
          </button>
        </form>
      )}

      {status === "in-radius" && (
        <div
          className="mt-4 flex flex-col gap-1 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"
          role="status"
        >
          <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: GREEN }}>
            Inside coverage
          </p>
          <p className="text-[15px] font-extrabold">
            {visitorPostcode}
            {distanceMi !== null && distanceMi > 0 && !isNational && (
              <span className="ml-2 text-[12px] font-medium text-emerald-800">
                · ~{distanceMi} mi from {merchantPostcode}
              </span>
            )}
          </p>
          <p className="mt-1 text-[12px]">{inRadiusCopy}</p>
          <button
            type="button"
            onClick={() => {
              setInput("");
              clear();
            }}
            className="mt-2 self-start text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 underline"
          >
            Change postcode
          </button>
        </div>
      )}

      {status === "outside" && (
        <div
          className="mt-4 flex flex-col gap-1 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"
          role="status"
        >
          <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: AMBER }}>
            Outside standard coverage
          </p>
          <p className="text-[15px] font-extrabold">
            {visitorPostcode}
            {distanceMi !== null && (
              <span className="ml-2 text-[12px] font-medium text-amber-800">
                · ~{distanceMi} mi from {merchantPostcode}
                {radiusMi ? ` (radius ${radiusMi} mi)` : ""}
              </span>
            )}
          </p>
          <p className="mt-1 text-[12px]">{outsideCopy}</p>
          <button
            type="button"
            onClick={() => {
              setInput("");
              clear();
            }}
            className="mt-2 self-start text-[10px] font-extrabold uppercase tracking-widest text-amber-800 underline"
          >
            Try a different postcode
          </button>
        </div>
      )}

      {status === "error" && (
        <div
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900"
          role="alert"
        >
          <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: RED }}>
            Couldn't check
          </p>
          <p className="mt-1 text-[12px]">{errorCopy}</p>
          <button
            type="button"
            onClick={() => {
              setInput("");
              clear();
            }}
            className="mt-2 self-start text-[10px] font-extrabold uppercase tracking-widest text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}
    </section>
  );
}

/** Convenience wrapper that hides children when the visitor is out of
 *  coverage. When status is 'unknown' or 'error' children render normally
 *  (never punish visitors for not having checked yet). */
export function InCoverageOnly({ children }: { children: React.ReactNode }) {
  const { status } = useCoverage();
  if (status === "outside") return null;
  return <>{children}</>;
}

/** Inverse — reveal only when we know the visitor is outside. */
export function OutsideCoverageOnly({
  children
}: {
  children: React.ReactNode;
}) {
  const { status } = useCoverage();
  if (status !== "outside") return null;
  return <>{children}</>;
}
