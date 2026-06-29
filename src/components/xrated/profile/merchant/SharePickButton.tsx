"use client";

// Trade Center Picks — share button for a single pick.
//
// Two-step flow mirroring ShareCardButton:
//   1. Tap the button → modal opens with the pick's banner preview
//      plus explicit channel buttons (Native / WhatsApp / Facebook /
//      X / Copy link).
//   2. Tap a channel → opens the right share intent for that channel.
//      Copy link writes the URL to the clipboard and flashes a
//      "Copied" confirmation in place.
//
// Channels are explicit (not just a single "Share") because on desktop
// the native share sheet isn't available — explicit buttons give the
// customer a working path on every device. Mobile that supports
// navigator.share gets a "More options…" tile that opens the system
// share sheet.

import { useEffect, useState } from "react";

const BRAND_YELLOW = "#FFB300";
const WHATSAPP_GREEN = "#25D366";
const FACEBOOK_BLUE = "#1877F2";
const X_BLACK = "#000000";

export interface SharePickButtonProps {
  slug: string;
  pickId: string;
  bannerUrl: string | null;
  productName: string;
  statusLabel: string;
  merchantName: string;
  /** "default" = full-width outlined yellow CTA in the commercial card.
   *  "overlay" = compact 44px filled-yellow circular icon button for
   *  use as an absolute-positioned overlay on the hero image. */
  variant?: "default" | "overlay";
}

export function SharePickButton({
  slug,
  pickId,
  bannerUrl,
  productName,
  statusLabel,
  merchantName,
  variant = "default"
}: SharePickButtonProps) {
  // Resolve the share URL on mount — origin only exists client-side.
  const [pickUrl, setPickUrl] = useState(`/${slug}/picks/${pickId}`);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPickUrl(`${window.location.origin}/${slug}/picks/${pickId}`);
    }
  }, [slug, pickId]);
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "overlay" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-neutral-900 shadow-lg transition active:scale-[0.95]"
          style={{ background: BRAND_YELLOW }}
          aria-label="Share this offer"
        >
          <ShareGlyph />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-12 min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-extrabold text-neutral-900 shadow-sm transition hover:opacity-90 active:scale-[0.97] sm:text-sm"
          style={{ background: BRAND_YELLOW }}
          aria-label="Share this offer"
        >
          <ShareGlyph />
          Share this offer
        </button>
      )}
      {open && (
        <ShareModal
          pickUrl={pickUrl}
          bannerUrl={bannerUrl}
          productName={productName}
          statusLabel={statusLabel}
          merchantName={merchantName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ShareModal({
  pickUrl,
  bannerUrl,
  productName,
  statusLabel,
  merchantName,
  onClose
}: {
  pickUrl: string;
  bannerUrl: string | null;
  productName: string;
  statusLabel: string;
  merchantName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setCanNativeShare(true);
    }
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const shareText = `${merchantName} — ${statusLabel} on ${productName}.`;
  const encodedUrl = encodeURIComponent(pickUrl);
  const encodedText = encodeURIComponent(shareText);
  const encodedTextWithUrl = encodeURIComponent(`${shareText} ${pickUrl}`);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pickUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: show the URL in a prompt so user can copy manually.
      window.prompt("Copy this link:", pickUrl);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({
        title: `${productName} — ${statusLabel}`,
        text: shareText,
        url: pickUrl
      });
      onClose();
    } catch (err) {
      // Silent abort (user cancelled) — keep the modal open.
      const isAbort =
        err instanceof Error &&
        (err.name === "AbortError" || /abort/i.test(err.message));
      if (!isAbort) {
        console.warn("[share-pick] navigator.share failed", err);
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Share this offer"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: BRAND_YELLOW }}
        >
          Share
        </p>
        <h2 className="mt-1 text-lg font-extrabold leading-tight text-neutral-900">
          {productName}
        </h2>
        <p className="mt-1 text-[13px] text-neutral-500">
          {merchantName} &middot; {statusLabel}
        </p>

        {bannerUrl && (
          <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bannerUrl}
              alt={productName}
              className="block aspect-[2/1] w-full object-cover"
            />
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <ChannelButton
            label="WhatsApp"
            href={`https://wa.me/?text=${encodedTextWithUrl}`}
            color={WHATSAPP_GREEN}
            icon={<IconWhatsApp />}
          />
          <ChannelButton
            label="Facebook"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
            color={FACEBOOK_BLUE}
            icon={<IconFacebook />}
          />
          <ChannelButton
            label="X"
            href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
            color={X_BLACK}
            icon={<IconX />}
          />
          <button
            type="button"
            onClick={copyLink}
            className="flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white text-[13px] font-extrabold text-neutral-800 transition active:scale-[0.97]"
            aria-label="Copy link"
          >
            <IconLink />
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        {canNativeShare && (
          <button
            type="button"
            onClick={nativeShare}
            className="mt-3 flex h-11 min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-[13px] font-extrabold transition active:scale-[0.97]"
            style={{ background: BRAND_YELLOW, color: "#0A0A0A" }}
          >
            <ShareGlyph />
            More options…
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 inline-flex h-11 w-full items-center justify-center text-[13px] font-semibold text-neutral-500 transition hover:text-neutral-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function ChannelButton({
  label,
  href,
  color,
  icon
}: {
  label: string;
  href: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-xl text-[13px] font-extrabold text-white transition active:scale-[0.97]"
      style={{ background: color }}
    >
      {icon}
      {label}
    </a>
  );
}

function ShareGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.52 3.48A11.78 11.78 0 0 0 12.06 0C5.5 0 .15 5.34.13 11.9a11.84 11.84 0 0 0 1.6 5.95L0 24l6.34-1.66a11.86 11.86 0 0 0 5.72 1.46h.01c6.55 0 11.9-5.34 11.92-11.9a11.79 11.79 0 0 0-3.47-8.42ZM12.07 21.78h-.01a9.85 9.85 0 0 1-5.02-1.38l-.36-.21-3.76.98 1-3.66-.23-.38a9.83 9.83 0 0 1-1.51-5.24c0-5.44 4.43-9.87 9.89-9.87a9.82 9.82 0 0 1 6.98 2.89 9.78 9.78 0 0 1 2.89 6.98c0 5.45-4.43 9.89-9.87 9.89Z" />
    </svg>
  );
}

function IconFacebook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95Z" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}

export default SharePickButton;
