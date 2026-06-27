"use client";

// Public profile — single download tile. Client component because the
// tap action either opens the email-gate modal (when requires_email=true)
// or POSTs straight to /track-download and triggers the file download.
//
// File icon is rendered as an inline SVG sized to ~64x64, colour-coded
// per type (PDF red, Word blue, Excel green, image preview, other grey).
// Card is a single tap target — h ≥ 44px equivalent for the action chip.

import { useState } from "react";
import type { HammerexXratedDownload } from "@/lib/supabase";
import { EmailGateModal } from "./EmailGateModal";

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

// Tiny inline icons — every download type renders an SVG, not an emoji,
// to honour the brand "no emojis" rule. Each tile is rendered as a
// rounded square so the card layout stays uniform whether the file is
// a PDF, a Word doc or a JPG.
function FileTypeBadge({ download }: { download: HammerexXratedDownload }) {
  if (download.cover_image_url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={download.cover_image_url}
        alt=""
        loading="lazy"
        className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-20 sm:w-20"
      />
    );
  }
  const isImage =
    download.file_type === "jpg" ||
    download.file_type === "jpeg" ||
    download.file_type === "png";
  if (isImage) {
    return (
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 sm:h-20 sm:w-20">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="9" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </span>
    );
  }
  const palette =
    download.file_type === "pdf"
      ? { bg: "#DC2626", label: "PDF" }
      : download.file_type === "doc" || download.file_type === "docx"
        ? { bg: "#2563EB", label: "DOC" }
        : download.file_type === "xls" || download.file_type === "xlsx"
          ? { bg: "#16A34A", label: "XLS" }
          : { bg: "#525252", label: "FILE" };
  return (
    <span
      className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg text-white shadow-sm sm:h-20 sm:w-20"
      style={{ background: palette.bg }}
      aria-hidden="true"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <span className="mt-0.5 text-[10px] font-extrabold tracking-widest">
        {palette.label}
      </span>
    </span>
  );
}

export function DownloadCard({
  download,
  trackingSlug
}: {
  download: HammerexXratedDownload;
  /** Public listing slug — currently unused for tracking but kept on the
   *  prop surface so future analytics tied to the page (not the file)
   *  can attribute correctly. */
  trackingSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function startDirectDownload() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/trade-off/downloads/track-download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ download_id: download.id })
      });
      const json = await res.json();
      if (!json.ok || !json.signed_url) {
        setErr(json.error ?? "Couldn't start download.");
        return;
      }
      // Open in a new tab so the customer keeps the profile open.
      window.open(json.signed_url, "_blank", "noopener,noreferrer");
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleTap() {
    if (download.requires_email) {
      setOpen(true);
    } else {
      void startDirectDownload();
    }
  }

  const size = formatBytes(download.file_size_bytes);

  return (
    <>
      <article className="flex h-full flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-[#FFB300] hover:shadow-md">
        <div className="flex items-start gap-3">
          <FileTypeBadge download={download} />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-[14px] font-extrabold leading-snug text-neutral-900">
              {download.name}
            </h3>
            {download.description && (
              <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-neutral-600">
                {download.description}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-neutral-500">
              <span className="font-bold uppercase tracking-widest text-neutral-400">
                {download.file_type}
              </span>
              {size && <span>· {size}</span>}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleTap}
          disabled={busy}
          aria-label={
            download.requires_email
              ? `Get ${download.name} — email required`
              : `Download ${download.name}`
          }
          className={`mt-auto inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] font-extrabold transition active:scale-[0.98] disabled:opacity-60 ${
            download.requires_email
              ? "border-2 border-[#FFB300] bg-white text-neutral-900 hover:bg-[#FFF8E5]"
              : "text-neutral-900 shadow-sm"
          }`}
          style={
            download.requires_email
              ? undefined
              : { background: "#FFB300" }
          }
        >
          {busy
            ? "Starting…"
            : download.requires_email
              ? (
                  <>
                    Get download
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </>
                )
              : (
                  <>
                    Download
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </>
                )}
        </button>
        {err && (
          <p className="text-[13px] font-semibold text-red-600">{err}</p>
        )}
      </article>

      {open && (
        <EmailGateModal
          download={download}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
