"use client";

// Hero "Card" CTA — opens a Share dialog (same design as
// ProductShareButton) titled "Share {displayName}'s card". Buyers send
// the trade's profile URL to friends via WhatsApp, Facebook, X,
// LinkedIn, Email, or copy the link. Saving to contacts (vCard
// download) is offered alongside so the buyer can both share and store.
//
// Phone is exposed via the saved vCard's TEL line only when the trade
// has `phone_calls_enabled` on — WhatsApp-only listings get a vCard
// with no callable number.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  displayName: string;
  tradeLabel: string;
  phone: string | null;
  email: string;
  whatsapp: string;
  phoneCallsEnabled: boolean;
  /** Optional banner art shown across the top of the preview card.
   *  Mirrors the look of the original profile-page business card. */
  bannerUrl?: string | null;
  /** Profile URL for the QR code + share links. Defaults to the
   *  current page URL when omitted (suitable for the profile-hero
   *  caller; the template-gallery caller passes the demo URL). */
  profileUrl?: string;
};

export function BusinessCardButton({
  displayName,
  tradeLabel,
  phone,
  email,
  whatsapp,
  phoneCallsEnabled,
  bannerUrl = null,
  profileUrl
}: Props) {
  // Two-step modal:
  //   'preview' — shows the business card visual with a yellow-rim
  //               frame and Share/Close action buttons.
  //   'share'   — shows the existing platform-by-platform share grid.
  // Clicking the Card button always opens to 'preview' first, per
  // user direction. "Share" advances to the share grid; "Close"
  // dismisses the whole modal.
  const [view, setView] = useState<"closed" | "preview" | "share">("closed");
  const open = view !== "closed";
  const setOpen = (next: boolean) => setView(next ? "preview" : "closed");
  const [copied, setCopied] = useState(false);
  // Mounted gate so createPortal() only fires on the client.
  // Without this, the first SSR pass would try to read `document` and
  // throw. The flag flips true after hydration, at which point the
  // modal portal is allowed to attach to <body>.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const shareUrl =
    profileUrl ?? (typeof window !== "undefined" ? window.location.href : "");
  // QR code via api.qrserver.com — free, no API key, 99.9% uptime.
  // Scanned by phone camera to land directly on the profile.
  const qrSrc = shareUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=4&data=${encodeURIComponent(shareUrl)}`
    : null;
  const shareTitle = `${displayName} — ${tradeLabel}`;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(shareTitle);
  const encodedBody = encodeURIComponent(`${shareTitle} - ${shareUrl}`);

  const links = {
    whatsapp: `https://wa.me/?text=${encodedBody}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`
  };

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this URL:", shareUrl);
    }
  }

  // Instagram has no public URL-share endpoint. On mobile we route
  // through the native Web Share API — Instagram appears as an option
  // in the OS share sheet when the app is installed. On desktop we
  // fall back to copying the link so the visitor can paste into IG.
  async function onShareInstagram() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: shareTitle, url: shareUrl });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    await onCopy();
  }

  const waDigits = whatsapp.replace(/[^0-9]/g, "");
  const downloadVCard = () => {
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${escapeVCard(displayName)}`,
      `TITLE:${escapeVCard(tradeLabel)}`,
      `EMAIL;TYPE=INTERNET:${escapeVCard(email)}`
    ];
    if (phoneCallsEnabled && phone) {
      lines.push(`TEL;TYPE=CELL:${phone.replace(/[^0-9+]/g, "")}`);
    }
    if (waDigits) lines.push(`TEL;TYPE=WhatsApp:+${waDigits}`);
    if (shareUrl) lines.push(`URL:${shareUrl}`);
    lines.push("END:VCARD");
    const blob = new Blob([lines.join("\r\n")], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(displayName)}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 text-xs font-bold shadow-lg backdrop-blur-sm transition active:scale-[0.97] sm:text-sm"
        style={{ borderColor: "var(--trade-accent, #FFB300)", color: "var(--trade-accent, #FFB300)", background: "rgba(0,0,0,0.35)" }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <circle cx="9" cy="11" r="2" />
          <path d="M14 9h5" />
          <path d="M14 13h5" />
          <path d="M5 17c0-1.7 1.8-3 4-3s4 1.3 4 3" />
        </svg>
        Card
      </button>

      {mounted && open && createPortal(
        <>
      {view === "preview" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${displayName}'s business card`}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[300] grid place-items-center bg-black/60 p-4 backdrop-blur"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm overflow-hidden rounded-2xl border-4 bg-white shadow-2xl"
            style={{ borderColor: "var(--trade-accent, #FFB300)" }}
          >
            {/* The card itself — full-bleed banner image with the QR
                code overlaid bottom-right and the name / trade label
                drop-shadowed over the gradient at the bottom of the
                image. Matches the original design exactly. */}
            {/* Real business cards are landscape (≈1.75:1). 16:9 is the
                closest Tailwind native ratio and reads as a card, not
                a square photo. */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-900">
              {bannerUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={bannerUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0) 75%)"
                }}
              />
              {/* Name + trade + contact details — bottom-LEFT of the
                  image. pr-28 leaves room for the QR panel on the right. */}
              <div className="absolute inset-x-0 bottom-0 p-4 pr-28">
                <p
                  className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
                  style={{ color: "var(--trade-accent, #FFB300)" }}
                >
                  {tradeLabel}
                </p>
                <p className="mt-1 text-[16px] font-extrabold leading-tight text-white drop-shadow-md">
                  {displayName}
                </p>
                <ul className="mt-2 grid grid-cols-1 gap-0.5 text-[11px] font-bold text-white/95 drop-shadow-md">
                  {phoneCallsEnabled && phone && (
                    <li className="break-all">{phone}</li>
                  )}
                  {whatsapp && <li className="break-all">{whatsapp}</li>}
                  {email && <li className="break-all">{email}</li>}
                </ul>
              </div>
              {/* QR code — bottom-RIGHT of the image, yellow rim, white
                  background panel so the code stays legible regardless
                  of the banner art behind it. */}
              {qrSrc && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrSrc}
                  alt="Scan to open profile"
                  width={96}
                  height={96}
                  className="absolute bottom-3 right-3 h-24 w-24 rounded-lg border-2 bg-white p-1 shadow-lg"
                  style={{ borderColor: "var(--trade-accent, #FFB300)" }}
                />
              )}
            </div>

            {/* Two-button row under the image — Close + Share split
                50/50 fill the row, no whitespace gap on the sides. */}
            <div className="flex items-stretch gap-2 bg-white p-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border-2 border-neutral-200 bg-white text-[13px] font-extrabold uppercase tracking-wider text-neutral-700 transition hover:border-neutral-400"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setView("share")}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 shadow-lg transition active:scale-[0.97]"
                style={{ background: "var(--trade-accent, #FFB300)" }}
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {view === "share" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Share ${displayName}'s card`}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[300] grid place-items-center bg-black/60 p-4 backdrop-blur"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border-4 bg-white p-5 shadow-2xl"
            style={{ borderColor: "var(--trade-accent, #FFB300)" }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-neutral-900">
                Share {displayName}&rsquo;s card
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900"
              >
                ×
              </button>
            </div>

            <ul className="grid grid-cols-1 gap-2">
              <li>
                <ShareRow
                  href={links.whatsapp}
                  label="Share on WhatsApp"
                  chipColor="#25D366"
                  icon={<WaIcon />}
                />
              </li>
              <li>
                <ShareRow
                  href={links.facebook}
                  label="Share on Facebook"
                  chipColor="#1877F2"
                  icon={<FbIcon />}
                />
              </li>
              <li>
                <ShareRow
                  href={links.x}
                  label="Share on X"
                  chipColor="#000000"
                  icon={<XIcon />}
                />
              </li>
              <li>
                <ShareRow
                  href={links.linkedin}
                  label="Share on LinkedIn"
                  chipColor="#0A66C2"
                  icon={<LiIcon />}
                />
              </li>
              <li>
                <button
                  type="button"
                  onClick={onShareInstagram}
                  className="flex h-11 w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-bold text-neutral-900 transition hover:border-neutral-400"
                >
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white"
                    style={{
                      background:
                        "linear-gradient(45deg,#FEDA77 0%,#F58529 25%,#DD2A7B 60%,#8134AF 90%)"
                    }}
                  >
                    <IgIcon />
                  </span>
                  Share to Instagram
                </button>
              </li>
              <li>
                <ShareRow
                  href={links.email}
                  label="Share by Email"
                  chipColor="#525252"
                  icon={<MailIcon />}
                />
              </li>
              <li>
                <button
                  type="button"
                  onClick={onCopy}
                  className="flex h-11 w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-bold text-neutral-900 transition hover:border-neutral-400"
                >
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-900"
                    style={{ background: "var(--trade-accent, #FFB300)" }}
                  >
                    <LinkIcon />
                  </span>
                  {copied ? "Link copied" : "Copy link"}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={downloadVCard}
                  className="flex h-11 w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-bold text-neutral-900 transition hover:border-neutral-400"
                >
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-900"
                    style={{ background: "var(--trade-accent, #FFB300)" }}
                  >
                    <SaveIcon />
                  </span>
                  Save to contacts
                </button>
              </li>
            </ul>

            {/* Yellow Close button at the bottom — mirrors the preview
                view so the user always sees the same close affordance. */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 shadow-lg transition active:scale-[0.97]"
              style={{ background: "var(--trade-accent, #FFB300)" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
        </>,
        document.body
      )}
    </>
  );
}

function IgIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function ShareRow({
  href,
  label,
  chipColor,
  icon
}: {
  href: string;
  label: string;
  chipColor: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-11 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-bold text-neutral-900 transition hover:border-neutral-400"
    >
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white"
        style={{ background: chipColor }}
      >
        {icon}
      </span>
      {label}
    </a>
  );
}

function WaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1c-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.8-.4-1.6-1-2.2-1.7-.6-.7-.9-1.4-1-1.8-.1-.3 0-.5.1-.6l.4-.5.3-.4c.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4 0 1.4 1 2.8 1.2 3 .2.2 2 3.1 4.9 4.3 1.4.6 2.1.6 2.8.5.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.1-.5-.3M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z" />
    </svg>
  );
}
function FbIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 22v-9h3l.5-3.5h-3.5V7c0-1 .3-1.7 1.8-1.7h1.8V2.2c-.3 0-1.4-.2-2.7-.2-2.7 0-4.5 1.6-4.5 4.6v2.9H7v3.5h2.9V22h3.6z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.503 11.24h-6.65l-5.214-6.815L4.99 21.75H1.68l7.73-8.835L1.254 2.25h6.817l4.713 6.231 5.46-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
    </svg>
  );
}
function LiIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.61 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.99 0 1.78-.77 1.78-1.72V1.72C24 .77 23.21 0 22.22 0z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 6 10 7 10-7" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}
function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "contact"
  );
}

function escapeVCard(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
