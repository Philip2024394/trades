"use client";

// Edit modal for /admin/reviews. Mounted from ReviewRowActions when the
// admin taps "Edit". PATCHs /api/admin/reviews/[id] with the fields the
// admin actually changed, then router.refresh()es the parent page so
// the table reflects the new values without a hard reload.
//
// Internal-note field (action_reason) writes to admin_action_reason so
// the moderation audit trail captures the "why" alongside the
// admin_edited_at timestamp.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type ReviewEditPayload = {
  id: string;
  customer_name: string;
  body: string;
  overall_rating: number;
  service_name: string | null;
};

export function ReviewEditModal({
  review,
  onClose
}: {
  review: ReviewEditPayload;
  onClose: () => void;
}) {
  const router = useRouter();
  const [customerName, setCustomerName] = useState(review.customer_name);
  const [body, setBody] = useState(review.body);
  const [overall, setOverall] = useState<number>(review.overall_rating);
  const [serviceName, setServiceName] = useState(review.service_name ?? "");
  const [actionReason, setActionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function save() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        customer_name: customerName,
        body,
        overall_rating: overall,
        service_name: serviceName,
        action_reason: actionReason
      };
      const res = await fetch(`/api/admin/reviews/${encodeURIComponent(review.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setErr(json.error || `Save failed (${res.status}).`);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-12"
      role="dialog"
      aria-modal="true"
      aria-label="Edit review"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-xl border border-brand-line bg-brand-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-brand-text">Edit review</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded border border-brand-line px-2 py-1 text-[11px] text-brand-muted hover:bg-brand-line"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <Field label="Customer name">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={busy}
              className="w-full rounded border border-brand-line bg-brand-bg px-2 py-1.5 text-[13px] text-brand-text"
            />
          </Field>

          <Field label="Body">
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={busy}
              className="w-full rounded border border-brand-line bg-brand-bg px-2 py-1.5 text-[13px] leading-snug text-brand-text"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Overall rating (1-5)">
              <input
                type="number"
                min={1}
                max={5}
                step={1}
                value={overall}
                onChange={(e) => setOverall(Number(e.target.value))}
                disabled={busy}
                className="w-full rounded border border-brand-line bg-brand-bg px-2 py-1.5 text-[13px] text-brand-text"
              />
            </Field>
            <Field label="Service name">
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                disabled={busy}
                className="w-full rounded border border-brand-line bg-brand-bg px-2 py-1.5 text-[13px] text-brand-text"
              />
            </Field>
          </div>

          <Field label="Why this edit (internal note — never public)">
            <textarea
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              disabled={busy}
              placeholder="e.g. cleaned up profanity, customer asked for name change…"
              className="w-full rounded border border-brand-line bg-brand-bg px-2 py-1.5 text-[13px] leading-snug text-brand-text placeholder:text-brand-muted/70"
            />
          </Field>
        </div>

        {err && (
          <p className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] font-semibold text-red-200">
            {err}
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded border border-brand-line px-3 py-1.5 text-[12px] text-brand-text hover:bg-brand-line"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded bg-brand-accent px-3 py-1.5 text-[12px] font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-brand-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
