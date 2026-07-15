"use client";

// Canteen Admin Card — sits at the top of the right column on the
// canteen detail page. Doubles as free advertising for the host and
// as the canteen's member roll: admin profile up top, then a compact
// members row that expands to a landscape-card list on tap.
//
// "View full profile" fires the `onOpenProfileFocus` callback which
// swaps the main feed column into CanteenProfileFocus (wide surface,
// two-col info grid, reviews carousel, portfolio grid). The old flip-
// in-place pattern was retired — 320px was never enough space.

import { useState } from "react";
import Link from "next/link";
import {
  MessageCircle,
  ChevronRight,
  ChevronDown,
  Users,
  Star
} from "lucide-react";
import type { CanteenMember } from "@/lib/canteens";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";
import { VerifiedContactButton } from "@/components/xrated/VerifiedContactButton";

const AVATAR_ROW_LIMIT = 8;

export function CanteenAdminCard({
  admin,
  members,
  totalMemberCount,
  onOpenProfileFocus
}: {
  admin: CanteenMember;
  members: CanteenMember[];
  totalMemberCount: number;
  /** Called when the buyer taps "View full profile". Parent
   *  (CanteenPageShell) sets its `profileFocusOpen` state, which swaps
   *  the main feed column to CanteenProfileFocus. */
  onOpenProfileFocus: () => void;
}) {
  const [membersOpen, setMembersOpen] = useState(false);
  const nonAdminMembers = members.filter((m) => m.slug !== admin.slug);
  const orderedMembers = [admin, ...nonAdminMembers];
  const avatarPreview = orderedMembers.slice(0, AVATAR_ROW_LIMIT);
  const overflowCount = Math.max(0, totalMemberCount - avatarPreview.length);

  return (
    <div className="mb-4">
      <div
        className="overflow-hidden rounded-xl border shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
            {/* Admin profile — dark banner, avatar, name/trade/city.
                Rating chip sits on the right of the black strip so the
                trust signal is the first thing scanned when the card
                enters the viewport (was previously buried below the
                buttons). */}
            <div
              className="relative h-12"
              style={{ background: `linear-gradient(160deg, ${BRAND_BLACK} 0%, #2a1a0a 100%)` }}
            >
              <div
                className="absolute -bottom-6 left-3 h-14 w-14 overflow-hidden rounded-full border-4 border-white shadow-md"
                style={{
                  backgroundImage: admin.avatarUrl ? `url('${admin.avatarUrl}')` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: !admin.avatarUrl ? BRAND_YELLOW : undefined
                }}
              >
                {!admin.avatarUrl && (
                  <div className="flex h-full w-full items-center justify-center text-[16px] font-black" style={{ color: BRAND_BLACK }}>
                    {admin.displayName.charAt(0)}
                  </div>
                )}
              </div>

              {/* Reviews strip on the dark banner — one-tap to the
                  full reviews page. Absolute-positioned top-right so
                  it doesn't compete with the avatar bump. */}
              {admin.reviews && admin.reviews.count > 0 && (
                <Link
                  href={`/trade/${admin.slug}/reviews`}
                  className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm transition hover:-translate-y-1/2 hover:scale-[1.03] active:scale-[0.97]"
                  style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                  aria-label={`${admin.reviews.avg} out of 5 · ${admin.reviews.count} reviews`}
                >
                  <Star size={11} fill={BRAND_BLACK} color={BRAND_BLACK} strokeWidth={0}/>
                  {admin.reviews.avg}
                  <span className="opacity-70">· {admin.reviews.count}</span>
                </Link>
              )}
            </div>

            <div className="bg-white px-3 pb-3 pt-8">
              <div className="text-[14px] font-black leading-tight text-neutral-900">
                {admin.displayName}
              </div>
              <div className="mt-0.5 text-[11px] font-bold text-neutral-600">
                {admin.tradeLabel} · {admin.city}
              </div>
              <p className="mt-2 text-[11.5px] leading-snug text-neutral-600">
                {admin.bioShort}
              </p>

              <div className="mt-3 flex flex-col gap-1.5">
                {admin.whatsapp && (
                  <VerifiedContactButton
                    merchantSlug={admin.slug}
                    merchantDisplayName={admin.displayName}
                    merchantFirstName={admin.displayName.split(/\s+/)[0] ?? admin.displayName}
                    merchantWhatsapp={admin.whatsapp}
                    tradeLabel={admin.tradeLabel}
                    city={admin.city}
                    source="canteen-hero"
                    sourceLabel={`${admin.displayName.split(/\s+/)[0] ?? admin.displayName}'s canteen admin card on Thenetworkers.app`}
                    canteenSlug={admin.slug}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full text-[11px] font-black uppercase tracking-wider text-white shadow-sm"
                    style={{ backgroundColor: BRAND_GREEN_DARK }}
                  >
                    <MessageCircle size={12} strokeWidth={2.5} />
                    Message on WhatsApp
                  </VerifiedContactButton>
                )}
                <button
                  onClick={onOpenProfileFocus}
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-neutral-200 bg-white text-[11px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50"
                >
                  View full profile
                  <ChevronRight size={12} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Members — collapsed row + expand toggle */}
            <div style={{ borderTop: "1px solid rgba(139,69,19,0.12)" }}>
              <button
                onClick={() => setMembersOpen((v) => !v)}
                className="flex w-full items-center gap-2 bg-white px-3 py-2 text-left transition hover:bg-neutral-50"
                aria-expanded={membersOpen}
              >
                <Users size={12} className="text-neutral-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                  In the canteen
                </span>
                <span className="text-[11px] font-black text-neutral-800">· {totalMemberCount}</span>
                <ChevronDown
                  size={14}
                  className="ml-auto text-neutral-500 transition-transform"
                  style={{ transform: membersOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>

              <div className="flex flex-wrap items-center gap-1 bg-white px-3 pb-3">
                {avatarPreview.map((m) => (
                  <div
                    key={m.slug}
                    className="h-7 w-7 flex-shrink-0 rounded-full border-2 shadow-sm"
                    style={{
                      borderColor: m.role === "admin" ? BRAND_YELLOW : "#FFFFFF",
                      backgroundImage: m.avatarUrl ? `url('${m.avatarUrl}')` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundColor: !m.avatarUrl ? BRAND_YELLOW : undefined
                    }}
                    title={`${m.displayName} — ${m.tradeLabel}`}
                  >
                    {!m.avatarUrl && (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-black" style={{ color: BRAND_BLACK }}>
                        {m.displayName.charAt(0)}
                      </div>
                    )}
                  </div>
                ))}
                {overflowCount > 0 && (
                  <div
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-white text-[9px] font-black text-neutral-700"
                    style={{ backgroundColor: "rgba(139,69,19,0.10)" }}
                  >
                    +{overflowCount}
                  </div>
                )}
              </div>

              {membersOpen && (
                <div className="border-t bg-neutral-50 px-3 py-2" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                  <ul className="flex flex-col gap-2">
                    {orderedMembers.map((m) => (
                      <li key={m.slug}>
                        <MemberLandscapeCard member={m} isHost={m.slug === admin.slug} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
    </div>
  );
}


// ─── Members landscape card ──────────────────────────────

function MemberLandscapeCard({
  member,
  isHost
}: {
  member: CanteenMember;
  isHost: boolean;
}) {
  const isPaid = !!member.whatsapp;
  return (
    <div
      className="flex items-center gap-2.5 rounded-lg border bg-white p-2 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.12)" }}
    >
      <Link
        href={`/trade/${member.slug}`}
        className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border-2 shadow-sm"
        style={{
          borderColor: member.role === "admin" ? BRAND_YELLOW : "#FFFFFF",
          backgroundImage: member.avatarUrl ? `url('${member.avatarUrl}')` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: !member.avatarUrl ? BRAND_YELLOW : undefined
        }}
      >
        {!member.avatarUrl && (
          <div className="flex h-full w-full items-center justify-center text-[13px] font-black" style={{ color: BRAND_BLACK }}>
            {member.displayName.charAt(0)}
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/trade/${member.slug}`}
            className="truncate text-[12px] font-black text-neutral-900 hover:underline"
          >
            {member.displayName}
          </Link>
          {isHost && (
            <span
              className="rounded-sm px-1 text-[8px] font-black uppercase tracking-wider"
              style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
            >
              Host
            </span>
          )}
        </div>
        <div className="truncate text-[10px] font-bold text-neutral-500">
          {member.tradeLabel} · {member.city}
        </div>
      </div>

      {isPaid && member.whatsapp ? (
        <VerifiedContactButton
          merchantSlug={member.slug}
          merchantDisplayName={member.displayName}
          merchantFirstName={member.displayName.split(/\s+/)[0] ?? member.displayName}
          merchantWhatsapp={member.whatsapp}
          tradeLabel={member.tradeLabel}
          city={member.city}
          source="canteen-hero"
          sourceLabel={`${member.displayName.split(/\s+/)[0] ?? member.displayName}'s member profile on Thenetworkers.app`}
          canteenSlug={member.slug}
          ariaLabel={`WhatsApp ${member.displayName}`}
          className="inline-flex h-8 flex-shrink-0 items-center gap-1 rounded-full px-3 text-[10px] font-black uppercase tracking-wider text-white shadow-sm"
          style={{ backgroundColor: BRAND_GREEN_DARK }}
        >
          <MessageCircle size={11} strokeWidth={2.5} />
          WhatsApp
        </VerifiedContactButton>
      ) : (
        <Link
          href={`/trade/${member.slug}`}
          className="inline-flex h-8 flex-shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white px-2 text-neutral-500 hover:text-neutral-900"
          title={`View ${member.displayName}'s profile`}
        >
          <ChevronRight size={13} strokeWidth={2.5} />
        </Link>
      )}
    </div>
  );
}
