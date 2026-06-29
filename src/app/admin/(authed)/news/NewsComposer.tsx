"use client";

// Shared client island used by /admin/news/new and
// /admin/news/[id]/edit. Renders the form (title / slug / category /
// excerpt / body / banner / video / status) and POSTs/PATCHes to the
// admin API. On success, navigates back to /admin/news?tab=<status>.

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  NEWS_CATEGORIES,
  slugifyTitle,
  VALID_STATUSES,
  type NewsStatus
} from "@/lib/newsCategories";

type InitialState = {
  id?: string;
  title?: string;
  slug?: string;
  category?: string;
  excerpt?: string;
  body_markdown?: string;
  banner_url?: string;
  video_url?: string;
  status?: NewsStatus;
};

type Props = {
  initial?: InitialState;
  mode: "new" | "edit";
};

export function NewsComposer({ initial, mode }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!initial?.slug);
  const [category, setCategory] = useState(initial?.category ?? "general");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [bodyMd, setBodyMd] = useState(initial?.body_markdown ?? "");
  const [bannerUrl, setBannerUrl] = useState(initial?.banner_url ?? "");
  const [videoUrl, setVideoUrl] = useState(initial?.video_url ?? "");
  const [status, setStatus] = useState<NewsStatus>(initial?.status ?? "draft");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-derive the slug from the title until the user manually edits
  // the slug field. After that, leave it alone.
  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyTitle(title));
    }
  }, [title, slugTouched]);

  const wordCount = useMemo(
    () => bodyMd.split(/\s+/).filter(Boolean).length,
    [bodyMd]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        category,
        excerpt: excerpt.trim() || null,
        body_markdown: bodyMd,
        banner_url: bannerUrl.trim() || null,
        video_url: videoUrl.trim() || null,
        status
      };
      const url =
        mode === "new" ? "/api/admin/news" : `/api/admin/news/${initial?.id}`;
      const method = mode === "new" ? "POST" : "PATCH";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j?.error ?? `Save failed (${r.status})`);
        return;
      }
      router.push(`/admin/news?tab=${status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-muted">
          Title
        </label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded border border-brand-line bg-brand-surface px-3 py-2 text-sm text-brand-text"
          placeholder="e.g. xratedtrade.com is live — what we built and why"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-muted">
          Slug (URL)
        </label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[12px] text-brand-muted">/news/</span>
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            className="flex-1 rounded border border-brand-line bg-brand-surface px-3 py-2 text-sm text-brand-text"
            placeholder="auto-generated from title"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-muted">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded border border-brand-line bg-brand-surface px-3 py-2 text-sm text-brand-text"
          >
            {NEWS_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-muted">
            Status
          </label>
          <div className="mt-1 flex items-center gap-3">
            {VALID_STATUSES.map((s) => (
              <label
                key={s}
                className="inline-flex items-center gap-1.5 text-[13px] text-brand-text"
              >
                <input
                  type="radio"
                  name="status"
                  value={s}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                />
                {s}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-muted">
          Excerpt (1 line — shown on cards + meta description)
        </label>
        <textarea
          rows={2}
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          className="mt-1 w-full rounded border border-brand-line bg-brand-surface px-3 py-2 text-sm text-brand-text"
          placeholder="A short summary, around 150 characters."
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-muted">
          Body (Markdown — supports ## headings, lists, **bold**, *italic*, [links](url))
        </label>
        <textarea
          rows={14}
          value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)}
          className="mt-1 w-full rounded border border-brand-line bg-brand-surface px-3 py-2 font-mono text-[13px] text-brand-text"
          placeholder={`## Section heading\n\nLead paragraph here.\n\n- Bullet point\n- Another bullet`}
        />
        <p className="mt-1 text-[11px] text-brand-muted">
          {wordCount} word{wordCount === 1 ? "" : "s"} · ~
          {Math.max(2, Math.round(wordCount / 200))} min read
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-muted">
            Banner URL (Supabase Storage)
          </label>
          <input
            type="url"
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
            className="mt-1 w-full rounded border border-brand-line bg-brand-surface px-3 py-2 text-sm text-brand-text"
            placeholder="https://msdonkkechxzgagyguoe.supabase.co/..."
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-muted">
            Video URL (optional)
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="mt-1 w-full rounded border border-brand-line bg-brand-surface px-3 py-2 text-sm text-brand-text"
            placeholder="https://..."
          />
        </div>
      </div>

      {error && (
        <p className="rounded border border-red-700/40 bg-red-900/20 px-3 py-2 text-[13px] text-red-300">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-brand-accent px-4 py-2 text-[12px] font-bold uppercase tracking-wider text-black hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : mode === "new" ? "Create post" : "Save changes"}
        </button>
        <a
          href="/admin/news"
          className="rounded border border-brand-line px-3 py-2 text-[12px] text-brand-muted hover:bg-brand-line hover:text-brand-text"
        >
          Cancel
        </a>
        {status === "live" && (
          <p className="text-[11px] text-brand-muted">
            Going live will also cross-post a Yard announcement (idempotent).
          </p>
        )}
      </div>
    </form>
  );
}
