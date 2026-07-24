"use client";

// ProfileCard — one card in the LiveProfileFeed grid. Photo top,
// identity + occupation + online dot + verified badge below, interest
// chips at the bottom.

import { BadgeCheck } from "lucide-react";
import type { DiscoverProfile } from "@/lib/nex/discover/_types";

export function ProfileCard({
  profile, onSelect
}: {
  profile:  DiscoverProfile;
  onSelect: (p: DiscoverProfile) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(profile)}
      className="group flex flex-col overflow-hidden rounded-2xl text-left transition-transform active:scale-[0.98]"
      style={{
        background: "var(--nex-neutral-0)",
        border: "1px solid var(--nex-neutral-200)",
        boxShadow: "var(--nex-shadow-sm)"
      }}
      aria-label={`${profile.first_name} — ${profile.occupation ?? profile.city}`}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden"
           style={{ background: "var(--nex-neutral-100)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profile.photo_url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {/* Online dot */}
        {profile.online && (
          <span
            aria-label="Online"
            className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full"
            style={{ background: "rgba(255,255,255,0.9)" }}
          >
            <span className="h-2 w-2 rounded-full"
                  style={{ background: "var(--nex-success-500)" }} />
          </span>
        )}
      </div>
      <div className="px-2.5 py-2">
        <div className="flex items-center gap-1">
          <span className="truncate text-[13px] font-bold"
                style={{ color: "var(--nex-neutral-900)" }}>
            {profile.first_name}
          </span>
          {profile.verified && (
            <BadgeCheck size={13} strokeWidth={2.25}
                        style={{ color: "var(--nex-accent-500)", flexShrink: 0 }}
                        aria-label="Verified" />
          )}
        </div>
        <div className="text-[10.5px] leading-tight"
             style={{ color: "var(--nex-neutral-500)" }}>
          {profile.city}
        </div>
        {profile.occupation && (
          <div className="mt-0.5 line-clamp-1 text-[10.5px] font-medium leading-tight"
               style={{ color: "var(--nex-neutral-700)" }}>
            {profile.occupation}
          </div>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {profile.interests.slice(0, 3).map((tag) => (
            <span key={tag}
                  className="rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold"
                  style={{ background: "var(--nex-accent-50)", color: "var(--nex-accent-700)" }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
