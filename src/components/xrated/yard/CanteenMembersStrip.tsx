"use client";

// Members strip — round avatars showing who's in the canteen. Click any
// avatar to open a mini profile with their trade info, business bio,
// WhatsApp button, and a list of other canteens they belong to (so
// cross-canteen discovery is one tap away).

import { useState } from "react";
import Link from "next/link";
import { X, MessageCircle, MapPin, Briefcase, Users, ChevronRight } from "lucide-react";
import type { CanteenMember, Canteen } from "@/lib/canteens";
import { MOCK_CANTEENS } from "@/lib/canteens";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

const AVATAR_STACK_LIMIT = 12;

export function CanteenMembersStrip({
  members,
  totalCount
}: {
  members: CanteenMember[];
  totalCount: number;
}) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const openMember = members.find((m) => m.slug === openSlug) ?? null;
  const shown = members.slice(0, AVATAR_STACK_LIMIT);
  const overflow = Math.max(0, totalCount - shown.length);

  return (
    <>
      <div
        className="mb-4 rounded-xl border bg-white p-3 shadow-sm sm:p-4"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-neutral-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              In the canteen
            </span>
            <span className="text-[11px] font-black text-neutral-800">· {totalCount}</span>
          </div>
          <button className="text-[10px] font-black uppercase tracking-wider text-neutral-500 transition hover:text-neutral-800">
            See all
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {shown.map((m) => (
            <button
              key={m.slug}
              onClick={() => setOpenSlug(m.slug)}
              className="group relative flex flex-col items-center"
              title={`${m.displayName} — ${m.tradeLabel}`}
            >
              <div
                className="h-10 w-10 overflow-hidden rounded-full border-2 shadow-sm transition group-hover:scale-105 sm:h-11 sm:w-11"
                style={{
                  borderColor: m.role === "admin" ? BRAND_YELLOW : "#FFFFFF",
                  backgroundImage: m.avatarUrl ? `url('${m.avatarUrl}')` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: !m.avatarUrl ? BRAND_YELLOW : undefined
                }}
              >
                {!m.avatarUrl && (
                  <div className="flex h-full w-full items-center justify-center text-[13px] font-black" style={{ color: BRAND_BLACK }}>
                    {m.displayName.charAt(0)}
                  </div>
                )}
              </div>
              {m.role === "admin" && (
                <span
                  className="absolute -bottom-1 rounded-sm px-1 text-[7px] font-black uppercase tracking-wider shadow-md"
                  style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                >
                  Admin
                </span>
              )}
            </button>
          ))}
          {overflow > 0 && (
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white text-[10px] font-black text-neutral-700 sm:h-11 sm:w-11"
              style={{ backgroundColor: "rgba(139,69,19,0.10)" }}
            >
              +{overflow}
            </button>
          )}
        </div>
      </div>

      {openMember && (
        <MemberMiniProfile member={openMember} onClose={() => setOpenSlug(null)} />
      )}
    </>
  );
}

function MemberMiniProfile({
  member,
  onClose
}: {
  member: CanteenMember;
  onClose: () => void;
}) {
  const otherCanteens: Canteen[] = MOCK_CANTEENS.filter((c) =>
    member.memberOfCanteenSlugs.includes(c.slug)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-neutral-300" />
        </div>
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-neutral-100"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Cream banner + avatar cut-through */}
        <div
          className="relative h-24"
          style={{
            background: `linear-gradient(180deg, ${BRAND_BLACK} 0%, #2a1a0a 100%)`
          }}
        >
          <div
            className="absolute -bottom-8 left-5 h-20 w-20 overflow-hidden rounded-full border-4 border-white shadow-lg"
            style={{
              backgroundImage: member.avatarUrl ? `url('${member.avatarUrl}')` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundColor: !member.avatarUrl ? BRAND_YELLOW : undefined
            }}
          >
            {!member.avatarUrl && (
              <div className="flex h-full w-full items-center justify-center text-[24px] font-black" style={{ color: BRAND_BLACK }}>
                {member.displayName.charAt(0)}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 pt-10">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[18px] font-black leading-tight text-neutral-900">
                {member.displayName}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-600">
                <span className="inline-flex items-center gap-1">
                  <Briefcase size={11} className="text-neutral-400" />
                  {member.tradeLabel}
                </span>
                <span className="text-neutral-300">·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin size={11} className="text-neutral-400" />
                  {member.city}
                </span>
              </div>
            </div>
            {member.role !== "member" && (
              <span
                className="rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
              >
                {member.role}
              </span>
            )}
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-neutral-700">
            {member.bioShort}
          </p>

          {/* Action row — WhatsApp CTA if available, otherwise profile link */}
          <div className="mt-4 flex flex-wrap gap-2">
            {member.whatsapp && (
              <a
                href={`https://wa.me/${member.whatsapp}`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-white shadow-md"
                style={{ backgroundColor: BRAND_GREEN_DARK }}
              >
                <MessageCircle size={12} strokeWidth={2.5} />
                WhatsApp
              </a>
            )}
            <Link
              href={`/trade/${member.slug}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 text-[12px] font-black uppercase tracking-wider text-neutral-700"
            >
              See full profile
              <ChevronRight size={12} strokeWidth={2.5} />
            </Link>
          </div>

          {/* Other canteens they're in */}
          {otherCanteens.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Also in
              </div>
              <div className="space-y-2">
                {otherCanteens.map((c) => (
                  <Link
                    key={c.id}
                    href={`/trade-off/yard/canteens/${c.slug}`}
                    className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5 transition hover:border-yellow-400 hover:bg-yellow-50"
                  >
                    <span
                      className="rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                      style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                    >
                      {c.tradeLabel}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-black text-neutral-900">{c.name}</div>
                      <div className="text-[10px] text-neutral-500">
                        {c.memberCount} members · {c.postsLast30d} posts / 30d
                      </div>
                    </div>
                    <ChevronRight size={13} className="text-neutral-400" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
