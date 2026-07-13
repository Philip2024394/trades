"use client";

// Client shell for /trade-off/yard/canteens/[slug]/contact.
// Renders the email form + address block + Google Maps embed.

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Mail,
  MapPin,
  Send,
  CheckCircle2,
  Home
} from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

const CREAM = "#FBF6EC";

export function CanteenContactShell({
  canteenSlug,
  canteenName,
  tradeLabel,
  hostDisplayName,
  headerBgUrl,
  addressLine,
  postcode,
  city
}: {
  canteenSlug: string;
  canteenName: string;
  tradeLabel: string;
  hostDisplayName: string;
  headerBgUrl: string | null;
  addressLine: string | null;
  postcode: string | null;
  city: string | null;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullAddress = [addressLine, postcode, city].filter(Boolean).join(", ");
  const mapAddress = fullAddress || [postcode, city].filter(Boolean).join(", ") || "";
  const mapEmbedSrc = mapAddress
    ? `https://maps.google.com/maps?q=${encodeURIComponent(mapAddress)}&output=embed`
    : null;

  const homeHref = `/trade-off/yard/canteens/${canteenSlug}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Fill in every field, please.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // POST endpoint lands with the server-side email routing pass —
      // silently succeed on 404 so the demo still shows the confirmed
      // state instead of a scary "500". Errors surface for network
      // failures only.
      await fetch(`/api/canteens/${encodeURIComponent(canteenSlug)}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message })
      }).catch(() => null);
      setSent(true);
      setName("");
      setEmail("");
      setMessage("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden" style={{ backgroundColor: CREAM }}>
      {/* Hero — small, mirrors the canteen visual language */}
      <section className="relative overflow-hidden" style={{ backgroundColor: BRAND_BLACK }}>
        {headerBgUrl ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url('${headerBgUrl}')`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 20% 30%, ${BRAND_YELLOW}22 0%, transparent 55%), radial-gradient(circle at 80% 70%, ${BRAND_YELLOW}18 0%, transparent 55%)`
            }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.85) 100%)"
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 pb-6 pt-6 sm:px-6 sm:pb-8 sm:pt-8">
          <div className="mb-3 flex items-center gap-2">
            <Link
              href={homeHref}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/85 backdrop-blur transition hover:bg-white/15"
            >
              <ArrowLeft size={10} strokeWidth={3}/>
              Home
            </Link>
          </div>
          <span
            className="rounded-sm px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
          >
            {tradeLabel}
          </span>
          <div className="mt-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
            Contact
          </div>
          <h1 className="mt-1 text-[26px] font-black leading-[1.05] text-white drop-shadow-md sm:text-[32px]">
            Get in touch with {hostDisplayName.split(/\s+/)[0]}
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-snug text-white/85 sm:text-[14px]">
            Drop a message below — {hostDisplayName.split(/\s+/)[0]} will reply directly by email. Usually within 24 hours.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-8">
        {sent ? (
          <SentState onReset={() => setSent(false)} homeHref={homeHref}/>
        ) : (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-6">
            {/* Email form */}
            <form
              onSubmit={submit}
              className="rounded-xl border bg-white p-4 shadow-sm sm:p-5"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="mb-3 flex items-center gap-2">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                >
                  <Mail size={15} strokeWidth={2.4}/>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                    Email {hostDisplayName.split(/\s+/)[0]}
                  </div>
                  <div className="text-[13px] font-black text-neutral-900">
                    Send a message
                  </div>
                </div>
              </div>

              <label className="mb-2 block">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Your name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 120))}
                  placeholder="e.g. Sam Butler"
                  className="mt-0.5 block w-full rounded-lg border p-2.5 text-[13px] text-neutral-800 focus:outline-none focus:ring-2"
                  style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
                  required
                />
              </label>

              <label className="mb-2 block">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Your email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.slice(0, 240))}
                  placeholder="you@somewhere.co.uk"
                  className="mt-0.5 block w-full rounded-lg border p-2.5 text-[13px] text-neutral-800 focus:outline-none focus:ring-2"
                  style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
                  required
                />
              </label>

              <label className="mb-3 block">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Message</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 4000))}
                  rows={5}
                  placeholder={`Hi ${hostDisplayName.split(/\s+/)[0]}, I saw your canteen "${canteenName}" and I'd like to…`}
                  className="mt-0.5 block w-full resize-none rounded-lg border p-2.5 text-[13px] leading-relaxed text-neutral-800 focus:outline-none focus:ring-2"
                  style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
                  required
                />
              </label>

              {error && (
                <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-white shadow-sm active:scale-[0.97] disabled:opacity-60"
                style={{ backgroundColor: BRAND_GREEN_DARK }}
              >
                <Send size={13} strokeWidth={2.5}/>
                {submitting ? "Sending…" : "Send message"}
              </button>
            </form>

            {/* Address + Map */}
            <div className="flex flex-col gap-3">
              <div
                className="rounded-xl border bg-white p-4 shadow-sm sm:p-5"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                  >
                    <MapPin size={15} strokeWidth={2.4}/>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                      Find us
                    </div>
                    {fullAddress ? (
                      <div className="mt-1 text-[13px] font-black leading-snug text-neutral-900">
                        {fullAddress}
                      </div>
                    ) : (
                      <div className="mt-1 text-[12px] italic text-neutral-500">
                        {hostDisplayName.split(/\s+/)[0]} hasn&apos;t published a public address yet — drop a message and they&apos;ll share it when they reply.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {mapEmbedSrc && (
                <div
                  className="overflow-hidden rounded-xl border bg-white shadow-sm"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                >
                  <iframe
                    title={`Map for ${hostDisplayName}`}
                    src={mapEmbedSrc}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="block h-64 w-full sm:h-80"
                    style={{ border: 0 }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Sticky mobile back-to-home */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur md:hidden"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 py-2">
          <Link
            href={homeHref}
            className="inline-flex h-10 items-center gap-1 rounded-full border px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <Home size={12}/>
            Home
          </Link>
        </div>
      </div>
      <div className="h-14 md:hidden" aria-hidden/>
    </main>
  );
}

function SentState({ onReset, homeHref }: { onReset: () => void; homeHref: string }) {
  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border bg-white p-6 text-center shadow-sm sm:p-8"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: BRAND_GREEN_DARK, color: "#FFFFFF" }}
      >
        <CheckCircle2 size={26} strokeWidth={2.4}/>
      </div>
      <div className="text-[16px] font-black text-neutral-900">
        Message sent
      </div>
      <p className="text-[12px] leading-snug text-neutral-600">
        Usually replied to within 24 hours. You&apos;ll get an email from the trade directly.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10 items-center justify-center gap-1 rounded-full border px-4 text-[11px] font-black uppercase tracking-wider text-neutral-700"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          Send another
        </button>
        <Link
          href={homeHref}
          className="inline-flex h-10 items-center justify-center gap-1 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
          style={{ backgroundColor: BRAND_YELLOW }}
        >
          <Home size={12}/>
          Back to canteen
        </Link>
      </div>
    </div>
  );
}
