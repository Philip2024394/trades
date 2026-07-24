"use client";

// SupplierCard — dark glass cards matching the NEX Centre premium
// theme. Two variants:
//   · grid → tall image-forward card for horizontal-scroll rails
//   · list → landscape row with photo left, meta right
// Claimed suppliers get the WhatsApp green CTA + rating pill.
// Unclaimed suppliers show public Companies-House-only data + a
// "Claim this business" CTA and a subtle "Not yet on NEX" pill.

import { CheckCircle2, Clock, MapPin, Sparkles, Star } from "lucide-react";
import { T } from "./NexCentreShell";
import type { Supplier } from "@/lib/nex/centre/_types";

export function SupplierCard({
  supplier: s,
  onOpen,
  variant = "list"
}: {
  supplier: Supplier;
  onOpen: () => void;
  variant?: "list" | "grid";
}) {
  const claimed = s.state === "claimed";
  return variant === "grid"
    ? <GridCard supplier={s} claimed={claimed} onOpen={onOpen} />
    : <ListCard supplier={s} claimed={claimed} onOpen={onOpen} />;
}

// ── Grid variant · used in horizontal rails ────────────────────────

function GridCard({
  supplier: s, claimed, onOpen
}: { supplier: Supplier; claimed: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex flex-col overflow-hidden rounded-2xl text-left transition-transform active:scale-[0.98]"
      style={{
        width: 220,
        background: T.surface,
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        border: `1px solid ${T.border}`,
        boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 40px -22px rgba(0,0,0,0.7)"
      }}
      aria-label={s.name}
    >
      <div className="relative h-32 w-full overflow-hidden" style={{ background: T.surfaceSolid }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={s.photo_url}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          loading="lazy"
          style={{ filter: claimed ? "none" : "grayscale(0.55) brightness(0.85)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(6,6,14,0) 55%, rgba(6,6,14,0.75) 100%)" }}
        />
        {!claimed && (
          <span
            className="absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest"
            style={{
              background: "rgba(6,6,14,0.7)",
              backdropFilter: "blur(6px)",
              color: T.textMuted,
              border: `1px solid ${T.border}`
            }}
          >
            Not on NEX
          </span>
        )}
        {claimed && typeof s.rating === "number" && (
          <span
            className="absolute right-2.5 top-2.5 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-black text-white"
            style={{ background: "rgba(6,6,14,0.65)", backdropFilter: "blur(6px)" }}
          >
            <Star size={9} strokeWidth={0} fill={T.accent} style={{ color: T.accent }} />
            {s.rating.toFixed(1)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-3 pt-2.5 pb-3">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1 truncate text-[13.5px] font-bold" style={{ color: T.text }}>
            {s.name}
          </div>
          {s.verified && <CheckCircle2 size={12} strokeWidth={2.25} style={{ color: T.accent, flexShrink: 0 }} />}
        </div>
        <div className="mt-0.5 truncate text-[10.5px]" style={{ color: T.textMuted }}>
          {s.category}
        </div>

        <div className="mt-2 flex items-center gap-2 text-[10px]"
             style={{ color: T.textFaint }}>
          <span className="flex items-center gap-1 truncate">
            <MapPin size={9} strokeWidth={1.75} />
            {s.location}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          {claimed && s.response_text ? (
            <span className="flex items-center gap-1 text-[10px]" style={{ color: T.textMuted }}>
              <Sparkles size={9} strokeWidth={2} style={{ color: T.accent }} />
              {s.response_text.replace("Usually replies ", "")}
            </span>
          ) : (
            <span className="text-[10px]" style={{ color: T.textFaint }}>
              Companies House verified
            </span>
          )}
          <span
            className="rounded-full px-2 py-0.5 text-[9.5px] font-black"
            style={
              claimed
                ? { background: T.whatsapp, color: "#FFFFFF" }
                : { background: T.accentSoft, color: T.accent, border: `1px solid ${T.borderWarm}` }
            }
          >
            {claimed ? "Message" : "Claim"}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── List variant · used in the vertical results list ──────────────

function ListCard({
  supplier: s, claimed, onOpen
}: { supplier: Supplier; claimed: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex overflow-hidden rounded-2xl text-left transition-transform active:scale-[0.99]"
      style={{
        background: T.surface,
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        border: `1px solid ${T.border}`,
        boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 16px 32px -22px rgba(0,0,0,0.7)"
      }}
      aria-label={s.name}
    >
      <div className="relative h-auto w-28 flex-shrink-0 overflow-hidden"
           style={{ background: T.surfaceSolid, minHeight: 116 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={s.photo_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          loading="lazy"
          style={{ filter: claimed ? "none" : "grayscale(0.55) brightness(0.85)" }}
        />
        {!claimed && (
          <span
            className="absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest"
            style={{
              background: "rgba(6,6,14,0.72)",
              backdropFilter: "blur(6px)",
              color: T.textMuted
            }}
          >
            Not on NEX
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 p-3.5">
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <div className="truncate text-[14px] font-bold" style={{ color: T.text }}>
                {s.name}
              </div>
              {s.verified && <CheckCircle2 size={12} strokeWidth={2.25} style={{ color: T.accent, flexShrink: 0 }} />}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: T.textMuted }}>
              {s.category}
            </div>
          </div>
          {claimed && typeof s.rating === "number" && (
            <span
              className="flex flex-shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-black"
              style={{ background: T.accentSoft, color: T.accent, border: `1px solid ${T.borderWarm}` }}
            >
              <Star size={9} strokeWidth={0} fill="currentColor" />
              {s.rating.toFixed(1)}
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-3 text-[10.5px]" style={{ color: T.textFaint }}>
          <span className="flex items-center gap-1 truncate">
            <MapPin size={10} strokeWidth={1.75} />
            {s.location}
          </span>
          {claimed && s.response_text && (
            <span className="flex items-center gap-1 truncate">
              <Clock size={10} strokeWidth={1.75} />
              {s.response_text.replace("Usually replies ", "")}
            </span>
          )}
        </div>

        {claimed && s.tags && s.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {s.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: T.textMuted,
                  border: `1px solid ${T.border}`
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2.5">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-black"
            style={
              claimed
                ? { background: T.whatsapp, color: "#FFFFFF", boxShadow: "0 4px 12px -3px rgba(37,211,102,0.55)" }
                : { background: "transparent", color: T.accent, border: `1px solid ${T.borderWarm}` }
            }
          >
            {claimed ? "Message on WhatsApp" : "Claim this business"}
          </span>
        </div>
      </div>
    </button>
  );
}
