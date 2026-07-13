"use client";

// Client-side restore form with the three safety gates:
//   1. Admin passcode (matched server-side against ADMIN_RESET_PASSCODE)
//   2. Slug confirmation (must type the canteen slug exactly)
//   3. Reason note (min 20 chars, permanent audit log)
//
// The Restore button stays disabled until all three fields are filled
// (client-side hint) — the server re-validates so bypassing the client
// gate still fails the request.

import { useState } from "react";

const MIN_REASON = 20;

export function CanteenRestoreForm({
  canteenSlug,
  snapshots
}: {
  canteenSlug: string;
  snapshots: { id: string; label: string }[];
}) {
  const [snapshotId, setSnapshotId] = useState<string>("");
  const [passcode, setPasscode] = useState<string>("");
  const [slugConfirmation, setSlugConfirmation] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; message: string; preRestoreSnapshotId: string }
    | { ok: false; error: string }
    | null
  >(null);

  const slugOk = slugConfirmation === canteenSlug;
  const reasonOk = reason.trim().length >= MIN_REASON;
  const canSubmit = snapshotId && passcode && slugOk && reasonOk && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    // eslint-disable-next-line no-alert
    if (!confirm(`Restore ${canteenSlug} to the selected snapshot? This is non-destructive — a pre-restore snapshot is captured first — but the canteen's current designs, products, and settings will be replaced.`)) {
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/canteens/${encodeURIComponent(canteenSlug)}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId,
          passcode,
          slugConfirmation,
          reason: reason.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setResult({ ok: false, error: data.error ?? "Unknown error" });
      } else {
        setResult({
          ok: true,
          message: data.message ?? "Restore complete",
          preRestoreSnapshotId: data.preRestoreSnapshotId
        });
        // Reset the sensitive fields but keep snapshotId + reason
        // visible so admin can see what they just did.
        setPasscode("");
        setSlugConfirmation("");
      }
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-brand-line bg-brand-surface p-4"
    >
      <div className="mb-3 flex items-center gap-2 rounded border border-yellow-400 bg-yellow-50 p-3 text-xs leading-relaxed text-yellow-900">
        <strong className="uppercase tracking-wider">Safety gates</strong>
        <span>All four fields required. Server re-validates every field. Reason is logged permanently.</span>
      </div>

      {/* Snapshot picker */}
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-muted">
          1. Snapshot to restore
        </span>
        <select
          value={snapshotId}
          onChange={(e) => setSnapshotId(e.target.value)}
          className="block w-full rounded border border-brand-line bg-white p-2 text-sm text-brand-text"
        >
          <option value="">— Select a snapshot —</option>
          {snapshots.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </label>

      {/* Passcode */}
      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-muted">
          2. Admin reset passcode
        </span>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Enter ADMIN_RESET_PASSCODE"
          autoComplete="off"
          className="block w-full rounded border border-brand-line bg-white p-2 text-sm text-brand-text"
        />
      </label>

      {/* Slug confirmation */}
      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-muted">
          3. Type the canteen slug to confirm targeting
        </span>
        <input
          type="text"
          value={slugConfirmation}
          onChange={(e) => setSlugConfirmation(e.target.value)}
          placeholder={canteenSlug}
          autoComplete="off"
          className={`block w-full rounded border p-2 font-mono text-sm ${
            slugConfirmation === "" ? "border-brand-line bg-white" :
            slugOk ? "border-green-500 bg-green-50 text-green-900" : "border-red-400 bg-red-50 text-red-900"
          }`}
        />
        <span className="mt-1 block text-[10px] text-brand-muted">
          Must match <span className="font-mono">{canteenSlug}</span> exactly.
        </span>
      </label>

      {/* Reason */}
      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-muted">
          4. Reason (min {MIN_REASON} chars, permanent audit log)
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder='e.g. "Mike Watson WhatsApped support saying he deleted all designs by mistake around 3pm"'
          rows={3}
          className="block w-full rounded border border-brand-line bg-white p-2 text-sm text-brand-text"
        />
        <span className={`mt-1 block text-[10px] ${reasonOk ? "text-green-700" : "text-brand-muted"}`}>
          {reason.trim().length} / {MIN_REASON} characters
        </span>
      </label>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className={`inline-flex h-10 items-center gap-2 rounded px-4 text-sm font-semibold transition ${
            canSubmit
              ? "bg-red-600 text-white hover:bg-red-700"
              : "cursor-not-allowed bg-brand-line text-brand-muted"
          }`}
        >
          {submitting ? "Restoring…" : "Restore canteen"}
        </button>
        <span className="text-[11px] text-brand-muted">
          Non-destructive — pre-restore snapshot is captured first so this action itself is undoable.
        </span>
      </div>

      {result && (
        <div
          className={`mt-4 rounded border p-3 text-sm ${
            result.ok
              ? "border-green-400 bg-green-50 text-green-900"
              : "border-red-400 bg-red-50 text-red-900"
          }`}
        >
          {result.ok ? (
            <>
              <strong>Restored.</strong>
              <p className="mt-1">{result.message}</p>
              <p className="mt-1 text-xs">
                Undo by restoring back to the pre-restore snapshot{" "}
                <span className="font-mono">{result.preRestoreSnapshotId.slice(0, 8)}…</span>
              </p>
            </>
          ) : (
            <>
              <strong>Restore failed.</strong>
              <p className="mt-1">{result.error}</p>
            </>
          )}
        </div>
      )}
    </form>
  );
}
