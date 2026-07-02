"use client";

// MachineReviewsSection — reviews grid + view-review modal + leave-
// review modal (WhatsApp handoff — merchant later adds to their
// reviews array via the editor).
//
// Reviewer avatars: when set, render as circular photo. When null,
// fall back to initials in a yellow chip.
//
// Overall rating is either the merchant-supplied `rating` or the
// average of any set service_ratings values.

import { useEffect, useMemo, useState } from "react";
import type { PlantReview } from "@/lib/plantHire";

type Props = {
  reviews: PlantReview[];
  machineLabel: string;
  machineImageUrl?: string;
  merchantName: string;
  waHref: string | null;
};

const DIMENSION_LABELS: Record<string, string> = {
  machine_quality: "Machine quality",
  service: "Service",
  price: "Price",
  punctuality: "Punctuality"
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function effectiveOverall(r: PlantReview): number {
  if (r.service_ratings) {
    const vals = Object.values(r.service_ratings).filter(
      (v): v is number => typeof v === "number" && v > 0
    );
    if (vals.length > 0) {
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }
  }
  return r.rating;
}

function fmtNiceDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  } catch {
    return iso;
  }
}

export function MachineReviewsSection({
  reviews,
  machineLabel,
  machineImageUrl,
  merchantName,
  waHref
}: Props) {
  const [openReview, setOpenReview] = useState<PlantReview | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);

  useEffect(() => {
    if (!openReview && !leaveOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenReview(null);
        setLeaveOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [openReview, leaveOpen]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          What customers say
        </h2>
        <button
          type="button"
          onClick={() => setLeaveOpen(true)}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90"
          style={{ background: "#FFB300" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
          Leave a review
        </button>
      </div>

      {reviews.length > 0 ? (
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {reviews.slice(0, 6).map((r, i) => {
            const overall = effectiveOverall(r);
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setOpenReview(r)}
                  className="group flex w-full items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:border-[#FFB300] hover:shadow"
                >
                  {r.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={r.avatar_url}
                      alt={r.author}
                      className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white"
                      loading="lazy"
                    />
                  ) : (
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[13px] font-extrabold"
                      style={{ background: "#FFB300", color: "#0A0A0A" }}
                      aria-hidden="true"
                    >
                      {initials(r.author)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-extrabold text-neutral-900">
                        {r.author}
                      </p>
                      <p className="text-[13px] font-bold text-[#FFB300]">
                        {"★".repeat(Math.max(1, Math.round(overall)))}
                        <span className="ml-1 text-neutral-500">
                          {overall.toFixed(1)}
                        </span>
                      </p>
                    </div>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                      {fmtNiceDate(r.date)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-neutral-700">
                      {r.text}
                    </p>
                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-[#FFB300] group-hover:underline">
                      View review →
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center text-[13px] text-neutral-600">
          No reviews yet — be the first. Tap <span className="font-extrabold text-neutral-900">Leave a review</span> above.
        </p>
      )}

      {openReview && (
        <ReviewViewModal
          review={openReview}
          machineLabel={machineLabel}
          machineImageUrl={machineImageUrl}
          onClose={() => setOpenReview(null)}
        />
      )}

      {leaveOpen && (
        <LeaveReviewModal
          machineLabel={machineLabel}
          machineImageUrl={machineImageUrl}
          merchantName={merchantName}
          waHref={waHref}
          onClose={() => setLeaveOpen(false)}
        />
      )}
    </section>
  );
}

// ─── Review view modal ────────────────────────────────────────────

function ReviewViewModal({
  review,
  machineLabel,
  machineImageUrl,
  onClose
}: {
  review: PlantReview;
  machineLabel: string;
  machineImageUrl?: string;
  onClose: () => void;
}) {
  const overall = effectiveOverall(review);
  const ratings = review.service_ratings ?? {};
  const dims = Object.entries(DIMENSION_LABELS)
    .map(([key, label]) => ({
      key,
      label,
      value: ratings[key as keyof typeof ratings] ?? 0
    }))
    .filter((d) => d.value > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Review by ${review.author}`}
      onClick={onClose}
      className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ boxShadow: "0 0 0 4px #FFB300, 0 20px 60px rgba(0,0,0,0.45)" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full text-[24px] font-extrabold transition hover:opacity-90"
          style={{ background: "#0A0A0A", color: "#FFB300" }}
          aria-label="Close"
        >
          ×
        </button>

        {machineImageUrl && (
          <div className="grid aspect-[16/10] w-full place-items-center overflow-hidden bg-neutral-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={machineImageUrl}
              alt={machineLabel}
              className="h-full w-full object-contain"
            />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Verified review · {machineLabel}
          </p>
          <div className="mt-3 flex items-center gap-3">
            {review.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={review.avatar_url}
                alt=""
                className="h-14 w-14 rounded-full object-cover ring-2 ring-white shadow-md"
              />
            ) : (
              <span
                className="grid h-14 w-14 place-items-center rounded-full text-[15px] font-extrabold shadow-md"
                style={{ background: "#FFB300", color: "#0A0A0A" }}
                aria-hidden="true"
              >
                {initials(review.author)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold text-neutral-900">
                {review.author}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                {fmtNiceDate(review.date)}
              </p>
              <p className="mt-1 flex items-center gap-1 text-[16px] font-extrabold text-[#FFB300]">
                {"★".repeat(Math.max(1, Math.round(overall)))}
                <span className="ml-1 text-[13px] font-bold text-neutral-800">
                  {overall.toFixed(1)} / 5
                </span>
              </p>
            </div>
          </div>

          {dims.length > 0 && (
            <ul className="mt-4 space-y-2">
              {dims.map((d) => (
                <li key={d.key}>
                  <div className="flex items-center justify-between text-[11px] font-bold text-neutral-700">
                    <span>{d.label}</span>
                    <span className="text-neutral-500">{d.value.toFixed(1)} / 5</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${(d.value / 5) * 100}%`,
                        background: "#FFB300"
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-5 rounded-md bg-neutral-50 p-4 text-[13px] leading-relaxed text-neutral-800">
            &ldquo;{review.text}&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Leave-review modal (WhatsApp handoff) ────────────────────────

function LeaveReviewModal({
  machineLabel,
  machineImageUrl,
  merchantName,
  waHref,
  onClose
}: {
  machineLabel: string;
  machineImageUrl?: string;
  merchantName: string;
  waHref: string | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [scores, setScores] = useState({
    machine_quality: 5,
    service: 5,
    price: 5,
    punctuality: 5
  });
  const [text, setText] = useState("");

  const overall = useMemo(() => {
    const vals = Object.values(scores);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [scores]);

  function buildMessage(): string {
    const dims = Object.entries(DIMENSION_LABELS)
      .map(([key, label]) => `${label}: ${scores[key as keyof typeof scores]}/5`)
      .join("  •  ");
    return `Hi ${merchantName}, here's a review for ${machineLabel}.\n\nFrom: ${name || "(anonymous)"}\nOverall: ${overall.toFixed(1)}/5\n${dims}\n\n${text}`.trim();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!waHref || text.trim().length < 10) return;
    const url = `${waHref}?text=${encodeURIComponent(buildMessage())}`;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Leave a review for ${machineLabel}`}
      onClick={onClose}
      className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="relative flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ boxShadow: "0 0 0 4px #FFB300, 0 20px 60px rgba(0,0,0,0.45)" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full text-[24px] font-extrabold transition hover:opacity-90"
          style={{ background: "#0A0A0A", color: "#FFB300" }}
          aria-label="Close"
        >
          ×
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Leave a review
          </p>
          <div className="mt-3 flex items-center gap-3">
            {machineImageUrl && (
              <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={machineImageUrl}
                  alt=""
                  className="h-full w-full object-contain"
                />
              </span>
            )}
            <div>
              <h3 className="text-lg font-extrabold text-neutral-900">{machineLabel}</h3>
              <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                Rate your hire experience
              </p>
            </div>
          </div>

          <ul className="mt-5 space-y-3">
            {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
              <li key={key}>
                <div className="flex items-center justify-between text-[12px] font-bold text-neutral-800">
                  <span>{label}</span>
                  <span className="text-[11px] font-extrabold text-[#FFB300]">
                    {scores[key as keyof typeof scores]} / 5
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={scores[key as keyof typeof scores]}
                  onChange={(e) =>
                    setScores((s) => ({
                      ...s,
                      [key]: Number(e.target.value)
                    }))
                  }
                  className="mt-1 w-full accent-[#FFB300]"
                />
              </li>
            ))}
          </ul>

          <div
            className="mt-4 rounded-md p-3 text-center"
            style={{ background: "#FFF8E1" }}
          >
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Overall rating
            </p>
            <p className="mt-1 text-[24px] font-extrabold text-neutral-900">
              {overall.toFixed(1)} / 5
            </p>
            <p className="mt-0.5 text-[16px] font-extrabold text-[#FFB300]">
              {"★".repeat(Math.round(overall))}
            </p>
          </div>

          <label className="mt-4 block">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Your name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dave M."
              maxLength={60}
              className="mt-1 h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 outline-none focus:border-[#FFB300]"
            />
          </label>

          <label className="mt-3 block">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Your review
            </span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Tell us how the hire went — machine condition, service, delivery, anything worth flagging."
              maxLength={400}
              className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-[#FFB300]"
            />
            <p className="mt-1 text-[10px] text-neutral-500">
              Minimum 10 characters. {text.trim().length}/400 used.
            </p>
          </label>
        </div>

        <div className="border-t border-neutral-200 p-4">
          <button
            type="submit"
            disabled={!waHref || text.trim().length < 10}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-extrabold uppercase tracking-widest text-white transition hover:opacity-90 disabled:opacity-40"
            style={{ background: "#0F7A3F" }}
          >
            Send review over WhatsApp
          </button>
          <p className="mt-2 text-center text-[10px] text-neutral-500">
            Merchant reviews all submissions before publishing. No spam, no auto-post.
          </p>
        </div>
      </form>
    </div>
  );
}
