"use client";

// StudioVersionHistoryModal — per-page publish timeline + rollback UI.
//
// Every publish creates a new immutable snapshot; this modal is the
// merchant-facing view of that history. Restore writes the chosen
// snapshot back into the current DRAFT — not the live layout — so the
// merchant can adjust or bail out before re-publishing.
//
// Preview and Restore both call the versions API; the modal never
// mutates the editor's in-memory layout. onRestored → router.refresh()
// so the server re-loads the freshly restored draft.

import { useCallback, useEffect, useState } from "react";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const RED = "#DC2626";
const BLUE = "#3B82F6";

type VersionSummary = {
  id: string;
  version: number;
  published_at: string | null;
  parent_layout_id: string | null;
  section_count: number;
};

type Props = {
  pageId: string;
  onClose: () => void;
  onRestored?: () => void;
};

export function StudioVersionHistoryModal({
  pageId,
  onClose,
  onRestored
}: Props) {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoredId, setRestoredId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/studio/versions?pageId=${encodeURIComponent(pageId)}`
      );
      const json = (await res.json()) as
        | { ok: true; versions: VersionSummary[] }
        | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setError("error" in json ? json.error : `HTTP ${res.status}`);
        return;
      }
      setVersions(json.versions);
    } catch (err) {
      setError((err as Error)?.message ?? "network");
    }
  }, [pageId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(v: VersionSummary) {
    if (busy) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `Restore version ${v.version} into your current draft? Your existing draft will be overwritten. Republish to make it live.`
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/versions/${v.id}/restore`, {
        method: "POST"
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      setRestoredId(v.id);
      onRestored?.();
    } catch (err) {
      setError((err as Error)?.message ?? "network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Version history"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-neutral-200 p-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            ⟲ Version history
          </p>
          <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
            Every time you published this page
          </h2>
          <p className="mt-1 text-[12px] text-neutral-500">
            Page <span className="font-mono">{pageId}</span> · newest first
          </p>
        </header>

        <div className="p-5">
          {restoredId && (
            <p
              className="mb-3 rounded-xl px-3 py-2 text-[12px] font-bold"
              style={{
                background: "rgba(16,185,129,0.08)",
                color: GREEN
              }}
            >
              ✓ Version restored into draft — republish to make it live.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mb-3 rounded-xl px-3 py-2 text-[12px] font-bold"
              style={{ background: "rgba(220,38,38,0.08)", color: RED }}
            >
              {error}
            </p>
          )}

          {!versions && <p className="text-[13px] font-bold text-neutral-500">Loading…</p>}

          {versions && versions.length === 0 && (
            <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center">
              <p className="text-[13px] font-extrabold text-neutral-700">
                No published versions yet
              </p>
              <p className="mt-1 text-[12px] text-neutral-500">
                The first time you publish this page, it appears here — and
                every publish after that becomes a restorable snapshot.
              </p>
            </div>
          )}

          {versions && versions.length > 0 && (
            <ul className="space-y-2">
              {versions.map((v, i) => (
                <li key={v.id}>
                  <VersionRow
                    version={v}
                    isLive={i === 0}
                    busy={busy}
                    onRestore={() => void restore(v)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-end border-t border-neutral-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-100"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────

function VersionRow({
  version,
  isLive,
  busy,
  onRestore
}: {
  version: VersionSummary;
  isLive: boolean;
  busy: boolean;
  onRestore: () => void;
}) {
  const published = version.published_at
    ? new Date(version.published_at)
    : null;
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white"
          style={{ background: isLive ? GREEN : "#0A0A0A" }}
        >
          v{version.version}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold text-neutral-900">
            {isLive ? "Live now" : "Snapshot"}
            {isLive && (
              <span
                className="ml-2 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
                style={{ background: GREEN }}
              >
                Current
              </span>
            )}
          </p>
          <p className="text-[11px] text-neutral-500">
            {published
              ? `${published.toLocaleDateString()} · ${published.toLocaleTimeString()}`
              : "(no timestamp)"}
            {" · "}
            <span style={{ color: BLUE }}>
              {version.section_count} section
              {version.section_count === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        {!isLive && (
          <button
            type="button"
            onClick={onRestore}
            disabled={busy}
            className="inline-flex h-8 items-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:brightness-95"
            style={{ background: YELLOW }}
          >
            Restore to draft
          </button>
        )}
      </div>
    </div>
  );
}
