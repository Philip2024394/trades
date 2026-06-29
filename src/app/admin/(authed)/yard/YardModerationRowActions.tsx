"use client";

// Per-row admin action buttons for /admin/yard. Wires Hide / Spam /
// Restore / Pin / Unpin to /api/admin/yard/moderate and refreshes the
// route on success so the table reflects the change without a hard
// page reload.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Action = "hide" | "spam" | "restore" | "pin" | "unpin";
type Status = "live" | "hidden" | "spam" | "flagged";

export function YardModerationRowActions({
  postId,
  status,
  isPinned
}: {
  postId: string;
  status: Status;
  isPinned: boolean;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function send(action: Action) {
    setErr(null);
    setPendingAction(action);
    try {
      const res = await fetch("/api/admin/yard/moderate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ post_id: postId, action })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setErr(body.error || `Failed to ${action}.`);
        setPendingAction(null);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setPendingAction(null);
    }
  }

  const isHidden = status === "hidden" || status === "spam";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {!isHidden && (
          <ActionBtn
            label="Hide"
            tone="danger"
            disabled={pendingAction !== null}
            loading={pendingAction === "hide"}
            onClick={() => send("hide")}
          />
        )}
        {!isHidden && (
          <ActionBtn
            label="Spam"
            tone="danger"
            disabled={pendingAction !== null}
            loading={pendingAction === "spam"}
            onClick={() => send("spam")}
          />
        )}
        {(isHidden || status === "flagged") && (
          <ActionBtn
            label="Restore"
            tone="success"
            disabled={pendingAction !== null}
            loading={pendingAction === "restore"}
            onClick={() => send("restore")}
          />
        )}
        {isPinned ? (
          <ActionBtn
            label="Unpin"
            tone="neutral"
            disabled={pendingAction !== null}
            loading={pendingAction === "unpin"}
            onClick={() => send("unpin")}
          />
        ) : (
          <ActionBtn
            label="Pin"
            tone="neutral"
            disabled={pendingAction !== null}
            loading={pendingAction === "pin"}
            onClick={() => send("pin")}
          />
        )}
      </div>
      {err && <span className="text-[10px] text-red-300">{err}</span>}
    </div>
  );
}

function ActionBtn({
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
