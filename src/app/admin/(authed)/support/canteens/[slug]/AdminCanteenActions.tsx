"use client";

// Admin quick-actions strip for a canteen — theme editor link
// + header banner upload. Rendered above the restore form on
// /admin/support/canteens/[slug] so support can adjust the
// merchant's public look without leaving the admin surface.

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";

export function AdminCanteenActions({
  canteenSlug,
  initialHeaderBgUrl
}: {
  canteenSlug: string;
  initialHeaderBgUrl: string | null;
}) {
  const [headerBgUrl, setHeaderBgUrl] = useState<string | null>(initialHeaderBgUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/canteens/${encodeURIComponent(canteenSlug)}/header-bg`, {
        method: "POST",
        body: fd
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setHeaderBgUrl(data.url);
    } catch (err) {
      setError((err as Error).message ?? "network");
    } finally {
      setUploading(false);
    }
  }

  async function clear() {
    if (!confirm("Clear the header banner? Hero will fall back to a plain gradient.")) return;
    setError(null);
    setUploading(true);
    try {
      const res = await fetch(`/api/canteens/${encodeURIComponent(canteenSlug)}/header-bg?clear=1`, {
        method: "POST"
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setHeaderBgUrl(null);
    } catch (err) {
      setError((err as Error).message ?? "network");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-brand-line p-4">
      <h2 className="text-sm font-semibold text-brand-text">Admin quick-edit</h2>
      <p className="mt-1 text-xs text-brand-muted">
        Change the theme + hero banner without leaving admin. Full picker opens in a new tab.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Theme editor link */}
        <div className="rounded-md border border-brand-line p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
            Theme colour · palette · feed tile
          </div>
          <p className="mt-1 text-xs text-brand-muted">
            Base hue, lightness, dark mode, hero shade, feed tile (colour / library / upload) — all live on the merchant&apos;s templates picker.
          </p>
          <Link
            href={`/trade-off/edit/${canteenSlug}/templates`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 rounded-md border border-brand-line px-3 py-1.5 text-xs font-semibold text-brand-text transition hover:bg-brand-surface"
          >
            Open theme picker ↗
          </Link>
        </div>

        {/* Header banner upload */}
        <div className="rounded-md border border-brand-line p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
            Hero header banner
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div
              className="flex h-16 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded border border-brand-line bg-brand-surface"
            >
              {headerBgUrl ? (
                <Image
                  src={headerBgUrl}
                  alt="Current header banner"
                  width={96}
                  height={64}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-[10px] text-brand-muted">no banner</span>
              )}
            </div>
            <div className="min-w-0 flex-1 text-xs text-brand-muted">
              PNG · JPEG · WEBP · max 8 MB. Upsert replaces the existing banner.
              {error && <div className="mt-1 text-red-500">Error: {error}</div>}
              {uploading && <div className="mt-1 text-brand-text">Uploading…</div>}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-brand-line px-3 py-1.5 text-xs font-semibold text-brand-text transition hover:bg-brand-surface">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (f) upload(f);
                  e.currentTarget.value = "";
                }}
                disabled={uploading}
              />
              {headerBgUrl ? "Replace" : "Upload"}
            </label>
            {headerBgUrl && (
              <button
                type="button"
                onClick={clear}
                disabled={uploading}
                className="rounded-md border border-brand-line px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-brand-surface disabled:opacity-40"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
