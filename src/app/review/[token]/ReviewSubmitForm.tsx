// Public review submission form. Mobile-first. No login. One tap per star.

"use client";

import { useState } from "react";
import {
  Star,
  Loader2,
  Camera,
  CheckCircle2,
  ShieldCheck
} from "lucide-react";
import { SurfaceCard } from "@/platform/ui";

type Merchant = {
  display_name: string;
  trading_name: string | null;
  avatar_url: string | null;
  city: string;
  postcode_prefix: string | null;
} | null;

export function ReviewSubmitForm({
  token,
  merchant,
  project,
  homeowner,
  alreadyPosted,
  expired
}: {
  token: string;
  merchant: Merchant;
  project: { title: string; leaf_slug: string | null } | null;
  homeowner: { full_name: string; postcode: string } | null;
  alreadyPosted: boolean;
  expired: boolean;
}) {
  const merchantName =
    merchant?.trading_name || merchant?.display_name || "your trade";
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [reviewerDisplayName, setReviewerDisplayName] = useState(
    homeowner
      ? `${homeowner.full_name.split(" ")[0]} in ${(homeowner.postcode || "").slice(0, 4)}`
      : ""
  );
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(alreadyPosted);

  async function uploadPhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/reviews/${token}/upload`, {
        method: "POST",
        body: form
      });
      const data: { ok: boolean; url?: string; error?: string } = await res.json();
      if (!data.ok || !data.url) {
        setError(data.error || "Upload failed.");
        return;
      }
      setMediaUrls((v) => [...v, data.url as string].slice(0, 4));
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError("Tap the stars to rate.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${token}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating,
          headline,
          body,
          mediaUrls,
          reviewerDisplayName
        })
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error || "Submit failed.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            Review · {merchantName}
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight md:text-3xl">
            {project?.title || "How did it go?"}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {done ? (
          <SurfaceCard variant="success" padding="lg">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5" aria-hidden />
              <div>
                <div className="text-[15px] font-semibold">Thanks — review posted.</div>
                <p className="mt-1 text-[13px]">
                  It's now public on {merchantName}'s profile and on your
                  Home Timeline. If your review needs editing, contact us.
                </p>
              </div>
            </div>
          </SurfaceCard>
        ) : expired ? (
          <SurfaceCard variant="warning" padding="md">
            <div className="text-[13px] font-semibold">
              This review link has expired.
            </div>
            <p className="mt-1 text-[13px]">
              If you'd still like to review, ask {merchantName} to
              resend it.
            </p>
          </SurfaceCard>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <SurfaceCard variant="primary" padding="md">
              <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Verified — this review is tied to a real signed-off job
              </div>
              <div
                className="mt-4 flex justify-center gap-1"
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = (hoverRating || rating) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      aria-label={`${n} star${n === 1 ? "" : "s"}`}
                      className="min-h-[56px] min-w-[56px] rounded-lg p-1 transition hover:bg-neutral-50"
                    >
                      <Star
                        className={`h-10 w-10 ${
                          active
                            ? "fill-amber-400 text-amber-400"
                            : "text-neutral-300"
                        }`}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
              <div className="text-center text-[13px] text-neutral-600">
                {rating === 0
                  ? "Tap to rate"
                  : rating === 5
                    ? "Excellent — thank you!"
                    : rating === 1
                      ? "Sorry it wasn't great — please tell us why"
                      : ""}
              </div>
            </SurfaceCard>

            <SurfaceCard variant="primary" padding="md">
              <label className="block text-[13px] font-semibold text-neutral-700">
                Short headline
              </label>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Beautiful shaker kitchen, fantastic team"
                maxLength={120}
                required
                className="mt-1 block min-h-[44px] w-full rounded-lg border border-neutral-200 bg-white px-3 text-[14px] outline-none focus:border-neutral-900"
              />
              <label className="mt-3 block text-[13px] font-semibold text-neutral-700">
                Your review
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                required
                placeholder="What did they do, how was communication, would you use them again?"
                className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[14px] outline-none focus:border-neutral-900"
              />
              <label className="mt-3 block text-[13px] font-semibold text-neutral-700">
                Display name
              </label>
              <input
                value={reviewerDisplayName}
                onChange={(e) => setReviewerDisplayName(e.target.value)}
                placeholder="e.g. Sarah in NG74"
                maxLength={60}
                className="mt-1 block min-h-[44px] w-full rounded-lg border border-neutral-200 bg-white px-3 text-[14px] outline-none focus:border-neutral-900"
              />
              <p className="mt-1 text-[13px] text-neutral-500">
                Shown publicly. Full name / address never displayed.
              </p>
            </SurfaceCard>

            <SurfaceCard variant="primary" padding="md">
              <div className="text-[13px] font-semibold text-neutral-700">
                Photos of the finished job (up to 4)
              </div>
              <label className="mt-2 inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-800 hover:border-neutral-400">
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Camera className="h-3.5 w-3.5" aria-hidden />
                )}
                Add photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={mediaUrls.length >= 4}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadPhoto(f);
                  }}
                />
              </label>
              {mediaUrls.length > 0 ? (
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {mediaUrls.map((u) => (
                    <img
                      key={u}
                      src={u}
                      alt=""
                      className="aspect-square w-full rounded object-cover"
                    />
                  ))}
                </div>
              ) : null}
            </SurfaceCard>

            {error ? (
              <p className="text-[13px] text-red-600">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-5 text-[15px] font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Star className="h-4 w-4" aria-hidden />
              )}
              Post review
            </button>
            <p className="text-center text-[13px] text-neutral-500">
              Reviews here are verified — every one tied to a real signed-off job.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
