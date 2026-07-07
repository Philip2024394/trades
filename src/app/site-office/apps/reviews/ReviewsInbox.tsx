// Reviews inbox — verified only by default. Merchant respond + dispute.

"use client";

import { useState } from "react";
import {
  Star,
  ShieldCheck,
  MessageSquareReply,
  Flag,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { SurfaceCard } from "@/platform/ui";

type Review = {
  id: string;
  reviewerDisplayName: string;
  rating: number;
  headline: string;
  body: string;
  mediaUrls: string[];
  verified: boolean;
  visibility: string;
  createdAt: string;
  projectId: string | null;
  response?:
    | { body: string; responder_display_name: string; updated_at: string }
    | undefined;
  dispute?:
    | { status: string; reason: string; created_at: string }
    | undefined;
};

export function ReviewsInbox({
  reviews,
  openRequests
}: {
  reviews: Review[];
  openRequests: number;
}) {
  if (reviews.length === 0) {
    return (
      <SurfaceCard variant="secondary" padding="lg">
        <div className="text-[13px] font-semibold text-neutral-600">
          {openRequests > 0
            ? `${openRequests} review request${openRequests === 1 ? "" : "s"} out — customers will show up here once they respond.`
            : "No reviews yet."}
        </div>
        <p className="mt-1 text-[13px] text-neutral-500">
          Every job signed off in Job Diary automatically triggers a review
          request. Nothing to configure.
        </p>
      </SurfaceCard>
    );
  }
  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <ReviewCard key={r.id} review={r} />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const [responseOpen, setResponseOpen] = useState(false);
  const [responseText, setResponseText] = useState(review.response?.body || "");
  const [responderName, setResponderName] = useState(
    review.response?.responder_display_name || "The team"
  );
  const [savingResponse, setSavingResponse] = useState(false);
  const [responded, setResponded] = useState(Boolean(review.response));
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [savingDispute, setSavingDispute] = useState(false);
  const [disputed, setDisputed] = useState(Boolean(review.dispute));
  const [error, setError] = useState<string | null>(null);

  const disputedPending = review.visibility === "disputed_pending" || disputed;

  async function submitResponse() {
    setSavingResponse(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/reviews/${review.id}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: responseText,
          responderDisplayName: responderName
        })
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error || "Save failed.");
        return;
      }
      setResponded(true);
      setResponseOpen(false);
    } finally {
      setSavingResponse(false);
    }
  }

  async function submitDispute() {
    setSavingDispute(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/reviews/${review.id}/dispute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: disputeReason })
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error || "Save failed.");
        return;
      }
      setDisputed(true);
      setDisputeOpen(false);
    } finally {
      setSavingDispute(false);
    }
  }

  return (
    <SurfaceCard
      variant={disputedPending ? "warning" : "primary"}
      padding="md"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`h-4 w-4 ${
                  review.rating >= n
                    ? "fill-amber-400 text-amber-400"
                    : "text-neutral-300"
                }`}
                aria-hidden
              />
            ))}
            <span className="ml-2 text-[13px] text-neutral-600">
              {review.reviewerDisplayName}
            </span>
          </div>
          <div className="mt-1 text-[15px] font-semibold text-neutral-900">
            {review.headline}
          </div>
        </div>
        <div className="text-right text-[13px] text-neutral-500">
          {new Date(review.createdAt).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric"
          })}
        </div>
      </div>
      <p className="whitespace-pre-wrap text-[13px] text-neutral-800">
        {review.body}
      </p>
      {review.mediaUrls.length > 0 ? (
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {review.mediaUrls.map((u) => (
            <img
              key={u}
              src={u}
              alt=""
              className="aspect-square w-full rounded object-cover"
            />
          ))}
        </div>
      ) : null}

      {review.verified ? (
        <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[13px] font-semibold text-emerald-800">
          <ShieldCheck className="h-3 w-3" aria-hidden />
          Verified sign-off
        </div>
      ) : null}

      {responded ? (
        <div className="mt-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
          <div className="text-[13px] font-semibold text-neutral-700">
            Your response · {responderName}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-neutral-800">
            {responseText}
          </p>
        </div>
      ) : null}

      {disputedPending ? (
        <div className="mt-3 flex items-center gap-1 text-[13px] font-semibold text-amber-900">
          <Flag className="h-3 w-3" aria-hidden />
          Dispute under admin review
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-[13px] text-red-600">{error}</p>
      ) : null}

      {!responded ? (
        <div className="mt-3">
          {responseOpen ? (
            <div className="space-y-2">
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={3}
                placeholder="Public reply. Thank the customer, address anything specific."
                className="block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px]"
              />
              <input
                value={responderName}
                onChange={(e) => setResponderName(e.target.value)}
                placeholder="Signed off as (e.g. Redgrave team)"
                className="block min-h-[36px] w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px]"
              />
              <button
                type="button"
                onClick={submitResponse}
                disabled={savingResponse}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-neutral-900 px-3 text-[13px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {savingResponse ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                )}
                Post reply
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setResponseOpen(true)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-800 hover:border-neutral-400"
            >
              <MessageSquareReply className="h-3.5 w-3.5" aria-hidden />
              Respond
            </button>
          )}
        </div>
      ) : null}

      {!disputed && review.rating <= 3 ? (
        <div className="mt-3">
          {disputeOpen ? (
            <div className="space-y-2">
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                rows={3}
                placeholder="Explain why this review is inaccurate. Admin will review — the review is temporarily hidden while pending."
                className="block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px]"
              />
              <button
                type="button"
                onClick={submitDispute}
                disabled={savingDispute}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-red-600 px-3 text-[13px] font-semibold text-white hover:bg-red-500 disabled:opacity-60"
              >
                {savingDispute ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Flag className="h-3.5 w-3.5" aria-hidden />
                )}
                Send dispute to admin
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDisputeOpen(true)}
              className="mt-2 inline-flex text-[13px] text-neutral-500 hover:text-red-700"
            >
              Dispute this review →
            </button>
          )}
        </div>
      ) : null}
    </SurfaceCard>
  );
}
