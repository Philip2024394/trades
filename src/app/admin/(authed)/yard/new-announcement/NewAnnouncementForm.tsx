"use client";

// Client form for posting a new Trade Off team announcement to the
// Yard. POSTs to /api/admin/yard/announcement and pushes the admin
// back to the Announcements tab on success.

import { useState } from "react";
import { useRouter } from "next/navigation";

const TITLE_MIN = 6;
const TITLE_MAX = 80;
const BODY_MIN = 30;
const BODY_MAX = 600;

export function NewAnnouncementForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPinned, setIsPinned] = useState(true);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const titleOk = title.trim().length >= TITLE_MIN && title.trim().length <= TITLE_MAX;
  const bodyOk = body.trim().length >= BODY_MIN && body.trim().length <= BODY_MAX;
  const canSubmit = titleOk && bodyOk && !pending;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setErr(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/yard/announcement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          is_pinned: isPinned
        })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(j.error || "Could not post announcement.");
        setPending(false);
        return;
      }
      router.push("/admin/yard?tab=announcements");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-brand-muted">
          Title
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          placeholder="What's happening?"
          className="rounded border border-brand-line bg-brand-surface px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/70"
        />
        <span className="text-[10px] text-brand-muted">
          {title.trim().length} / {TITLE_MAX} (min {TITLE_MIN})
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-brand-muted">
          Body (Markdown allowed)
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={BODY_MAX}
          rows={8}
          placeholder="The details. Plain prose. Links inline."
          className="rounded border border-brand-line bg-brand-surface px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted/70"
        />
        <span className="text-[10px] text-brand-muted">
          {body.trim().length} / {BODY_MAX} (min {BODY_MIN})
        </span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isPinned}
          onChange={(e) => setIsPinned(e.target.checked)}
        />
        <span className="text-xs text-brand-text">
          Pin to top of feed (default on)
        </span>
      </label>

      {err && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
          {err}
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded bg-brand-accent px-4 py-2 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Posting…" : "Post announcement"}
        </button>
      </div>
    </form>
  );
}
