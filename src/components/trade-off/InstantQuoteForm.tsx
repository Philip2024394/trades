"use client";

// Instant Quote form — embedded on every `/trade/<slug>` profile.
//
// Customer fills name + postcode + job description, optionally drags in up
// to three photos (each uploaded to /api/trade-off/quote-upload and stored
// in product-images/trade-off/quotes/<uuid>.<ext>), then taps "Send via
// WhatsApp". We assemble a multi-line wa.me link with the form data and
// open it in a new tab. Form state stays so the customer can resend if
// the wa.me tab gets lost.

import { useRef, useState } from "react";
import { whatsappDigits } from "@/lib/tradeOff";

type UploadStatus = "idle" | "uploading" | "done" | "error";

type PhotoSlot = {
  id: string;
  status: UploadStatus;
  url: string | null;
  fileName: string;
  error: string | null;
};

const MAX_PHOTOS = 3;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_DESC = 50;
const MAX_DESC = 500;
// Generous UK postcode regex: 1-2 letters, 1-2 digits (optionally one
// trailing letter), optional space, then 1 digit + 2 letters. Case-insensitive.
const POSTCODE_RE = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i;

export function InstantQuoteForm({
  slug,
  displayName,
  tradeLabel,
  whatsapp,
  listingId
}: {
  slug: string;
  displayName: string;
  tradeLabel: string;
  whatsapp: string;
  /** Optional — when set, a WhatsApp-click beacon fires on submit so the
   *  trial-tier upgrade-nudge counter stays in sync with the InstantQuote
   *  path (not just the QrFooterDock and TradeMobileActionBar paths). */
  listingId?: string | null;
}) {
  void slug; // currently unused but kept in the signature for future tagging

  const [name, setName] = useState("");
  const [postcode, setPostcode] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const digits = whatsappDigits(whatsapp);
  const descLen = description.trim().length;
  const nameOk = name.trim().length >= 2;
  const postcodeOk = POSTCODE_RE.test(postcode.trim());
  const descOk = descLen >= MIN_DESC && descLen <= MAX_DESC;
  const uploadsPending = photos.some((p) => p.status === "uploading");
  const canSubmit = nameOk && postcodeOk && descOk && !uploadsPending && digits.length > 0;

  function addFiles(files: FileList | File[]) {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    const list = Array.from(files).slice(0, remaining);
    const additions: PhotoSlot[] = list.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: "idle",
      url: null,
      fileName: file.name,
      error: null
    }));
    setPhotos((prev) => [...prev, ...additions]);

    // Kick off uploads in parallel.
    additions.forEach((slot, i) => {
      const file = list[i];
      void uploadOne(slot.id, file);
    });
  }

  async function uploadOne(id: string, file: File) {
    if (!file.type.startsWith("image/")) {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: "error", error: "Not an image" } : p
        )
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: "error", error: "Over 5 MB" } : p
        )
      );
      return;
    }
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "uploading" } : p))
    );
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/trade-off/quote-upload", {
        method: "POST",
        body: fd
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.ok || !body.url) {
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, status: "error", error: body.error ?? "Upload failed" }
              : p
          )
        );
        return;
      }
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: "done", url: body.url ?? null } : p
        )
      );
    } catch (e) {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: "error", error: "Network error" } : p
        )
      );
      console.error("[InstantQuoteForm] upload failed", e);
    }
  }

  function removePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  function buildMessage(): string {
    const photoUrls = photos
      .filter((p) => p.status === "done" && p.url)
      .map((p) => p.url as string);
    const lines = [
      `Hi ${displayName}, quote request via Hammerex Trade Off.`,
      "",
      `Customer: ${name.trim()}`,
      `Postcode: ${postcode.trim().toUpperCase()}`,
      `Trade: ${tradeLabel}`,
      "",
      "Job:",
      description.trim()
    ];
    if (photoUrls.length > 0) {
      lines.push("", "Photos:", ...photoUrls);
    }
    return lines.join("\n");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    // Fire-and-forget click beacon — same endpoint the Contact button uses.
    if (listingId) {
      try {
        const payload = JSON.stringify({ listing_id: listingId });
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          const blob = new Blob([payload], { type: "application/json" });
          if (!navigator.sendBeacon("/api/trade-off/track-whatsapp-click", blob)) {
            void fetch("/api/trade-off/track-whatsapp-click", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: payload,
              keepalive: true
            }).catch(() => undefined);
          }
        }
      } catch {
        // best-effort
      }
    }
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(buildMessage())}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setSent(true);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-brand-line bg-brand-surface/40 p-4 sm:p-5"
      aria-label="Instant WhatsApp quote"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-whatsapp text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Zm4.55-6.23c-.25-.13-1.47-.73-1.7-.82s-.39-.13-.55.13-.64.81-.78.97-.29.19-.54.06a6.84 6.84 0 0 1-2-1.24 7.55 7.55 0 0 1-1.4-1.74c-.15-.25 0-.39.11-.51s.25-.29.37-.43a1.6 1.6 0 0 0 .25-.41.46.46 0 0 0 0-.43c-.06-.13-.55-1.33-.76-1.82s-.4-.41-.55-.42h-.47a.91.91 0 0 0-.66.31 2.78 2.78 0 0 0-.87 2.07 4.83 4.83 0 0 0 1 2.55 11 11 0 0 0 4.21 3.73c.59.25 1 .4 1.4.52a3.41 3.41 0 0 0 1.55.1 2.55 2.55 0 0 0 1.66-1.17 2 2 0 0 0 .15-1.17c-.06-.11-.23-.18-.48-.31Z" />
          </svg>
        </span>
        <h3 className="text-sm font-bold text-brand-text">Send {displayName.split(" ")[0]} a quote request</h3>
      </div>
      <p className="mt-1 text-xs text-brand-muted">
        Fill it in — we open WhatsApp pre-loaded with the details. Free, no signup.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-brand-text">Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First + last"
            autoComplete="name"
            className="h-11 rounded-lg border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
            required
          />
          {touched && !nameOk && (
            <span className="text-xs text-red-600">Enter your name (2+ characters).</span>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-brand-text">Postcode</span>
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            placeholder="e.g. SW1A 1AA"
            autoComplete="postal-code"
            inputMode="text"
            className="h-11 rounded-lg border border-brand-line bg-brand-bg px-3 text-sm uppercase text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
            required
          />
          {touched && !postcodeOk && (
            <span className="text-xs text-red-600">UK postcode required (e.g. SW1A 1AA).</span>
          )}
        </label>
      </div>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs font-semibold text-brand-text">
          Job description{" "}
          <span className="font-normal text-brand-muted">
            ({descLen}/{MAX_DESC})
          </span>
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
          placeholder="What needs doing, rooms / sizes involved, timeline, anything else they should know."
          rows={4}
          className="min-h-[96px] rounded-lg border border-brand-line bg-brand-bg p-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
          required
        />
        {touched && !descOk && (
          <span className="text-xs text-red-600">
            Describe the job in at least {MIN_DESC} characters (max {MAX_DESC}).
          </span>
        )}
      </label>

      <div className="mt-3">
        <span className="text-xs font-semibold text-brand-text">
          Photos{" "}
          <span className="font-normal text-brand-muted">
            (optional, up to {MAX_PHOTOS}, 5 MB each)
          </span>
        </span>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`mt-1 flex min-h-[88px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-3 text-center transition ${
            dragOver ? "border-brand-accent bg-brand-accent/10" : "border-brand-line bg-brand-bg"
          }`}
          role="button"
          tabIndex={0}
        >
          <p className="text-xs font-semibold text-brand-text">
            Drag photos here or tap to upload
          </p>
          <p className="mt-1 text-xs text-brand-muted">
            JPG / PNG / HEIC · {photos.length}/{MAX_PHOTOS} added
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
        </div>
        {photos.length > 0 && (
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <li
                key={p.id}
                className="relative overflow-hidden rounded-lg border border-brand-line bg-neutral-100"
              >
                {p.url ? (
                  <img
                    src={p.url}
                    alt={p.fileName}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-brand-bg text-xs text-brand-muted">
                    {p.status === "uploading"
                      ? "Uploading…"
                      : p.status === "error"
                        ? "Failed"
                        : "Waiting"}
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhoto(p.id);
                  }}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white"
                >
                  ×
                </button>
                {p.status === "error" && p.error && (
                  <span className="absolute inset-x-0 bottom-0 bg-red-900/80 px-2 py-1 text-xs text-white">
                    {p.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-whatsapp px-6 text-sm font-bold text-white transition enabled:hover:brightness-110 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Zm4.55-6.23c-.25-.13-1.47-.73-1.7-.82s-.39-.13-.55.13-.64.81-.78.97-.29.19-.54.06a6.84 6.84 0 0 1-2-1.24 7.55 7.55 0 0 1-1.4-1.74c-.15-.25 0-.39.11-.51s.25-.29.37-.43a1.6 1.6 0 0 0 .25-.41.46.46 0 0 0 0-.43c-.06-.13-.55-1.33-.76-1.82s-.4-.41-.55-.42h-.47a.91.91 0 0 0-.66.31 2.78 2.78 0 0 0-.87 2.07 4.83 4.83 0 0 0 1 2.55 11 11 0 0 0 4.21 3.73c.59.25 1 .4 1.4.52a3.41 3.41 0 0 0 1.55.1 2.55 2.55 0 0 0 1.66-1.17 2 2 0 0 0 .15-1.17c-.06-.11-.23-.18-.48-.31Z" />
        </svg>
        {uploadsPending ? "Uploading photos…" : "Send via WhatsApp"}
      </button>

      {sent && (
        <p className="mt-3 rounded-lg border border-brand-success/40 bg-brand-success/10 p-3 text-xs text-brand-text">
          Sent! Continue chatting on WhatsApp — we kept your details below in case you need to
          resend.
        </p>
      )}
    </form>
  );
}

export default InstantQuoteForm;
