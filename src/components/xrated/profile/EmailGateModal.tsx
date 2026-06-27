"use client";

// Email-capture overlay for gated downloads. Yellow ring-4 modal that
// mirrors the ViewCardModal pattern (backdrop blur, Esc + click-outside
// to close, locked body scroll). Honeypot field `company_website` —
// when a bot fills it the API silently swallows the lead.

import { useEffect, useState } from "react";
import type { HammerexXratedDownload } from "@/lib/supabase";

export function EmailGateModal({
  download,
  onClose
}: {
  download: HammerexXratedDownload;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  // Honeypot — kept in state so the bot's autofill works, but the
  // legitimate user never sees the field.
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErr("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErr("That doesn't look like a valid email.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trade-off/downloads/track-download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          download_id: download.id,
          customer_email: trimmedEmail,
          customer_name: name.trim() || undefined,
          company_website: companyWebsite
        })
      });
      const json = await res.json();
      if (!json.ok || !json.signed_url) {
        setErr(json.error ?? "Couldn't start download.");
        return;
      }
      window.open(json.signed_url, "_blank", "noopener,noreferrer");
      onClose();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Get ${download.name}`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-4 ring-[#FFB300]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-sm transition hover:bg-black"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <form onSubmit={submit} className="flex flex-col gap-4 p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em]" style={{ color: "#FFB300" }}>
              Downloads
            </p>
            <h2 className="mt-1 text-lg font-extrabold leading-tight text-neutral-900 sm:text-xl">
              Get {download.name}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
              Enter your email to download. We&rsquo;ll only contact you if you ask us to.
            </p>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
              Email *
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              maxLength={200}
              placeholder="you@example.com"
              className="block h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[13px] text-neutral-900 outline-none focus:border-[#FFB300]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
              Name (optional)
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              maxLength={120}
              placeholder="Your name"
              className="block h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[13px] text-neutral-900 outline-none focus:border-[#FFB300]"
            />
          </label>

          {/* Honeypot — visually hidden, off-screen, tabbed past with
              tabIndex=-1. Bots that crawl the DOM and autofill every
              field will trip this; real users never see it. */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: 0 }}>
            <label>
              Company website
              <input
                type="text"
                name="company_website"
                tabIndex={-1}
                autoComplete="off"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
              />
            </label>
          </div>

          {err && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">
              {err}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-extrabold uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.98] disabled:opacity-60"
            style={{ background: "#FFB300" }}
          >
            {busy ? "Starting…" : "Get download"}
          </button>

          <p className="text-center text-[13px] text-neutral-500">
            We&rsquo;ll never share your email.
          </p>
        </form>
      </div>
    </div>
  );
}
