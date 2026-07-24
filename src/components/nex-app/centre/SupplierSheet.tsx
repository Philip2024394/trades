"use client";

// SupplierSheet — full-height dark bottom-sheet profile matching the
// NEX Centre premium theme. Big hero image, glass action panel, tag
// pills, primary CTA is WhatsApp deep-link (claimed) or Claim
// (unclaimed). All copy respects the no-commission promise.

import { useEffect } from "react";
import { CheckCircle2, Clock, MapPin, Sparkles, Star, X, Phone, Share2, Mail } from "lucide-react";
import { T } from "./NexCentreShell";
import type { Supplier } from "@/lib/nex/centre/_types";

export function SupplierSheet({
  supplier: s, onClose
}: {
  supplier: Supplier | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!s) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s, onClose]);

  if (!s) return null;
  const claimed = s.state === "claimed";

  const waHref = s.whatsapp_e164
    ? `https://wa.me/${s.whatsapp_e164.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `Hi ${s.name} — I found you on NEX Centre. Are you available for a quick chat?`
      )}`
    : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${s.name} profile`}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{
        background: "rgba(2, 2, 6, 0.72)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)"
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl"
        style={{
          background: "rgba(14, 14, 22, 0.96)",
          backdropFilter: "blur(32px) saturate(180%)",
          WebkitBackdropFilter: "blur(32px) saturate(180%)",
          borderTop: `1px solid ${T.border}`,
          maxHeight: "94vh",
          boxShadow: "0 -20px 60px -18px rgba(251,191,36,0.30)",
          color: T.text
        }}
      >
        {/* Hero */}
        <div className="relative h-56 w-full overflow-hidden" style={{ background: T.surfaceSolid }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.photo_url}
            alt=""
            className="h-full w-full object-cover"
            style={{ filter: claimed ? "none" : "grayscale(0.5)" }}
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(6,6,14,0.15) 0%, rgba(14,14,22,0.35) 55%, rgba(14,14,22,0.96) 100%)" }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full"
            style={{
              background: "rgba(6,6,14,0.72)",
              backdropFilter: "blur(6px)",
              color: T.text,
              border: `1px solid ${T.border}`
            }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-8">
          {/* Identity */}
          <div className="-mt-14 flex items-end gap-3">
            {s.logo_url ? (
              <span
                className="grid h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl"
                style={{
                  background: T.surfaceSolid,
                  border: `2px solid ${T.surfaceSolid}`,
                  boxShadow: "0 12px 30px -12px rgba(0,0,0,0.6)"
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.logo_url} alt="" className="h-full w-full object-cover" />
              </span>
            ) : (
              <span
                className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-2xl text-[#141416]"
                style={{ background: T.accentGrad }}
              >
                <span className="text-[22px] font-black">{s.name.charAt(0)}</span>
              </span>
            )}
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-[21px] font-black tracking-tight" style={{ color: T.text }}>
                  {s.name}
                </h2>
                {s.verified && <CheckCircle2 size={16} strokeWidth={2.25} style={{ color: T.accent }} />}
              </div>
              <div className="mt-0.5 text-[12.5px]" style={{ color: T.textMuted }}>
                {s.category}
              </div>
            </div>
          </div>

          {/* Meta chips */}
          <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
            <Chip icon={<MapPin size={11} strokeWidth={1.75} />}>{s.location}</Chip>
            {claimed && s.hours_today && <Chip icon={<Clock size={11} strokeWidth={1.75} />}>{s.hours_today}</Chip>}
            {claimed && typeof s.rating === "number" && (
              <Chip icon={<Star size={11} strokeWidth={0} fill="currentColor" style={{ color: T.accent }} />}>
                {s.rating.toFixed(1)} · {s.reviews_count?.toLocaleString("en-GB")} reviews
              </Chip>
            )}
            {claimed && s.response_text && (
              <Chip icon={<Sparkles size={11} strokeWidth={1.75} style={{ color: T.accent }} />}>
                {s.response_text}
              </Chip>
            )}
          </div>

          {/* Headline */}
          {claimed && s.headline && (
            <p className="mt-5 text-[13.5px] leading-[1.55]" style={{ color: T.textMuted }}>
              {s.headline}
            </p>
          )}

          {/* Tags */}
          {claimed && s.tags && s.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {s.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    background: T.accentSoft,
                    color: T.accent,
                    border: `1px solid ${T.borderWarm}`
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Primary CTA */}
          <div className="mt-6">
            {claimed && waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[13px] font-black text-white transition-transform active:scale-[0.99]"
                style={{
                  background: T.whatsapp,
                  boxShadow: "0 14px 34px -8px rgba(37,211,102,0.55)"
                }}
              >
                <WhatsAppGlyph size={17} />
                Message on WhatsApp
              </a>
            ) : (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[13px] font-black text-[#141416] transition-transform active:scale-[0.99]"
                style={{
                  background: T.accentGrad,
                  boxShadow: "0 14px 34px -8px rgba(251,191,36,0.55)"
                }}
              >
                <Mail size={16} strokeWidth={2.25} />
                Claim this Business
              </button>
            )}
          </div>

          {/* Secondary actions */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <SecondaryAction icon={Phone}  label="Call" />
            <SecondaryAction icon={MapPin} label="Directions" />
            <SecondaryAction icon={Share2} label="Share" />
          </div>

          {/* Unclaimed footnote */}
          {!claimed && (
            <div
              className="mt-5 rounded-2xl px-4 py-3 text-[11.5px] leading-[1.55]"
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                color: T.textMuted
              }}
            >
              This business is registered at Companies House
              {s.companies_house_no && ` (no. ${s.companies_house_no})`}
              {" "}but hasn&apos;t joined NEX yet. Claim it in 30 seconds to add
              your WhatsApp, opening hours and products.
            </div>
          )}

          {/* Trust footer */}
          <p className="mt-5 px-1 text-center text-[10.5px]" style={{ color: T.textFaint }}>
            NEX doesn&apos;t take commission on any conversation you start here.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Small primitives ───────────────────────────────────────────────

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
      style={{
        background: T.surface,
        color: T.textMuted,
        border: `1px solid ${T.border}`
      }}
    >
      {icon}
      {children}
    </span>
  );
}

function SecondaryAction({ icon: Icon, label }: { icon: typeof MapPin; label: string }) {
  return (
    <button
      type="button"
      className="flex flex-col items-center gap-1 rounded-xl py-2.5 transition-transform active:scale-[0.97]"
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        color: T.text
      }}
    >
      <Icon size={16} strokeWidth={1.9} />
      <span className="text-[10.5px] font-bold">{label}</span>
    </button>
  );
}

function WhatsAppGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.297-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
    </svg>
  );
}
