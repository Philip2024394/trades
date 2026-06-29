"use client";

// Per-row admin action buttons for /admin/reviews. Wires Edit / Mark
// Safe / Hide / Delete / Restore to the admin reviews API and refreshes
// the parent server-component table on success.
//
// Delete uses confirm() — the migration spec calls it the "nuclear
// option" for illegal / unrecoverable content. Hide is the everyday
// "turn it off" action.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ReviewEditModal, type ReviewEditPayload } from "./ReviewEditModal";

type Status = "live" | "hidden" | "flagged" | "pending" | "disputed" | "withdrawn" | "spam";

export function ReviewRowActions({
  review
}: {
  review: ReviewEditPayload & { status: Status };
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  async function setStatus(status: "live" | "hidden" | "flagged") {
    if (pending) return;
    setPending(status);
    setErr(null);
    try {
      const res = await fetch(
        `/api/admin/reviews/${encodeURIComponent(review.id)}/status`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status })
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setErr(json.error || `Failed (${res.status}).`);
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setPending(null);
    }
  }

  async function hardDelete() {
    if (pending) return;
    const ok = confirm(
      `Hard DELETE this review? This cannot be undone — only use for illegal or unrecoverably bad content.\n\n"${review.body.slice(0, 120)}"`
    );
    if (!ok) return;
    setPending("delete");
    setErr(null);
    try {
      const res = await fetch(
        `/api/admin/reviews/${encodeURIComponent(review.id)}`,
        { method: "DELETE" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setErr(json.error || `Failed (${res.status}).`);
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setPending(null);
    }
  }

  const isHidden = review.status === "hidden";
  const isLive = review.status === "live";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        <Btn
          label="Edit"
          tone="neutral"
          disabled={pending !== null}
          loading={false}
          onClick={() => setEditing(true)}
        />
        {!isLive && (
          <Btn
            label="Mark Safe"
            tone="success"
            disabled={pending !== null}
            loading={pending === "live"}
            onClick={() => setStatus("live")}
          />
        )}
        {isHidden ? (
          <Btn
            label="Restore"
            tone="success"
            disabled={pending !== null}
            loading={pending === "live"}
            onClick={() => setStatus("live")}
          />
        ) : (
          <Btn
            label="Hide"
            tone="danger"
            disabled={pending !== null}
            loading={pending === "hidden"}
            onClick={() => setStatus("hidden")}
          />
        )}
        <Btn
          label="Delete"
          tone="danger"
          disabled={pending !== null}
          loading={pending === "delete"}
          onClick={hardDelete}
        />
      </div>
      {err && <span className="text-[10px] text-red-300">{err}</span>}

      {editing && (
        <ReviewEditModal review={review} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

function Btn({
  label,
  tone,
  loading,
  disabled,
  onClick
}: {
  label: string;
  tone: "danger" | "success" | "neutral";
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const base =
    "rounded px-2 py-1 text-[10px] font-semibold transition disabled:opacity-50";
  const toneClass =
    tone === "danger"
      ? "border border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
      : tone === "success"
        ? "border border-green-500/40 bg-green-500/10 text-green-200 hover:bg-green-500/20"
        : "border border-brand-line bg-brand-surface text-brand-text hover:bg-brand-line";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${toneClass}`}
    >
      {loading ? "…" : label}
    </button>
  );
}
