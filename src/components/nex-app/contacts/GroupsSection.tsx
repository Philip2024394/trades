"use client";

// Groups — visual group tiles. Landscape rows with a rounded-square
// image on the left, name + member count on the right. Type chip
// carries its own signature colour. Favourite badge for pinned
// groups (surfaces at the top via parent shell sort).

import { Users, Star, ArrowRight } from "lucide-react";
import { DARK } from "./ContactsShell";
import type { ContactGroup } from "@/lib/nex/contacts/_types";

const GROUP_ACCENT: Record<ContactGroup["type"], string> = {
  friends:   "#06B6D4",   // cyan
  family:    "#EC4899",   // magenta
  business:  "#FBBF24",   // amber (matches NEX accent)
  community: "#10B981",   // emerald
  project:   "#A855F7"    // violet
};

export function GroupsSection({ groups }: { groups: ContactGroup[] }) {
  return (
    <section className="mt-7">
      <header className="mx-5 mb-3 flex items-baseline justify-between">
        <h2 className="text-[11px] font-black uppercase tracking-[0.24em]"
            style={{ color: DARK.textMuted }}>
          Groups
        </h2>
        <span className="text-[11px]" style={{ color: DARK.textFaint }}>
          {groups.length}
        </span>
      </header>
      <div className="mx-4 flex flex-col gap-2.5">
        {groups.length === 0 && (
          <div className="rounded-2xl px-4 py-8 text-center text-[12px]"
               style={{
                 background: DARK.surface,
                 backdropFilter: "blur(12px)",
                 WebkitBackdropFilter: "blur(12px)",
                 border: `1px solid ${DARK.border}`,
                 color: DARK.textFaint
               }}>
            No groups yet — create one with the button below.
          </div>
        )}
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className="relative flex items-center gap-3 rounded-2xl p-2.5 text-left transition-transform active:scale-[0.99]"
            style={{
              background: DARK.surface,
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: `1px solid ${DARK.border}`,
              boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px -18px rgba(0,0,0,0.7)"
            }}
            aria-label={g.name}
          >
            {g.favourite && (
              <span
                aria-label="Favourite"
                className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full text-[#141416]"
                style={{
                  background: DARK.accentGrad,
                  boxShadow: "0 4px 12px -3px rgba(251, 191, 36, 0.6)"
                }}
              >
                <Star size={10} strokeWidth={2.5} fill="currentColor" />
              </span>
            )}

            <span
              className="relative grid h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl"
              style={{ background: DARK.surfaceSolid, border: `1px solid ${DARK.border}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.photo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
                  style={{
                    background: GROUP_ACCENT[g.type],
                    boxShadow: `0 4px 12px -4px ${GROUP_ACCENT[g.type]}66`
                  }}
                >
                  {g.type}
                </span>
              </div>
              <div className="mt-1 truncate pr-6 text-[14px] font-bold leading-tight"
                   style={{ color: DARK.text }}>
                {g.name}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[11px]"
                   style={{ color: DARK.textMuted }}>
                <Users size={11} strokeWidth={1.75} />
                {g.member_count.toLocaleString("en-GB")} members
              </div>
            </div>

            <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full"
                  style={{ color: DARK.textMuted }}>
              <ArrowRight size={14} strokeWidth={2} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
