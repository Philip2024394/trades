"use client";

// KeyCuttingPhotoScan — in-app photo-scan submission for the key-
// cutting page. Customer picks 1-2 photos from their device, they get
// uploaded to Supabase Storage via the existing /api/trade-off/upload-
// photo endpoint, then the merchant receives a pre-filled WhatsApp
// message with the hosted image URLs. Merchant sees the photos in the
// WhatsApp thread — no need for the customer to attach anything
// manually.

import { useState } from "react";

export function KeyCuttingPhotoScan({
  merchantName,
  waHref
}: {
  merchantName: string;
  waHref: string | null;
}) {
  const [uploading, setUploading] = useState(false);
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function pickFiles(files: FileList) {
    if (urls.length + files.length > 4) {
      setError("Maximum 4 photos");
      return;
    }
    setError(null);
    setUploading(true);
    const uploaded: string[] = [];
    for (const f of Array.from(files)) {
      const form = new FormData();
      form.append("file", f);
      try {
        const res = await fetch("/api/trade-off/upload-photo", { method: "POST", body: form });
        const j = (await res.json()) as { ok?: boolean; url?: string; error?: string };
        if (j.ok && j.url) {
          uploaded.push(j.url);
        } else {
          setError(j.error ?? "Upload failed");
        }
      } catch (e) {
        setError((e as Error).message);
      }
    }
    setUrls((prev) => [...prev, ...uploaded]);
    setUploading(false);
  }

  function remove(idx: number) {
    setUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  const canSend = urls.length > 0 && !!waHref;
  const sendHref = (() => {
    if (!waHref) return "#";
    const noteText = note.trim() ? `\n\nNotes: ${note.trim()}` : "";
    const photosBlock = urls.map((u, i) => `${i + 1}. ${u}`).join("\n");
    const encoded = encodeURIComponent(
      `Hi ${merchantName}, key-cutting photo submission.\n\nPhotos:\n${photosBlock}${noteText}\n\nWhat's the price and how long until it's ready?`
    );
    // Split waHref if it already has a text param — otherwise append one.
    return waHref.includes("?text=")
      ? waHref.split("?text=")[0] + "?text=" + encoded
      : waHref + "?text=" + encoded;
  })();

  return (
    <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        Upload photos of your key
      </p>
      <p className="mt-1 text-[11px] text-neutral-600">
        Take 1-4 photos: both edges of the key + a coin for scale. We&rsquo;ll
        confirm the type + price before you commit.
      </p>

      {urls.length > 0 && (
        <ul className="mt-3 grid grid-cols-4 gap-2">
          {urls.map((u, i) => (
            <li key={u} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-16 w-full rounded-md object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove photo"
                className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-neutral-900 text-[10px] font-extrabold text-white"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {urls.length < 4 && (
        <label
          className="mt-3 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 active:scale-[0.98]"
          style={{ background: "#FFB300" }}
        >
          {uploading ? "Uploading…" : `+ Add photo${urls.length > 0 ? "s" : ""}`}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                pickFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />
        </label>
      )}

      {urls.length > 0 && (
        <label className="mt-3 block">
          <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">
            Notes (optional)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Key number stamped as Yale KB-51, worn on the edges"
            maxLength={400}
            className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[#FFB300]"
          />
        </label>
      )}

      {error && (
        <p className="mt-2 text-[11px] font-bold text-red-700">{error}</p>
      )}

      {canSend && (
        <a
          href={sendHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[12px] font-extrabold uppercase tracking-widest text-white shadow-sm transition hover:opacity-90"
          style={{ background: "#0F7A3F" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Z" />
          </svg>
          Send {urls.length} photo{urls.length === 1 ? "" : "s"} via WhatsApp
        </a>
      )}
    </div>
  );
}
