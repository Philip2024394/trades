"use client";

// ProfileQuickSheet — the bottom sheet that opens when a profile is
// tapped. Shows richer detail (bio, rating, languages) and the two
// primary actions per spec: Ask NEX to Connect + Save Profile.

import { X, BadgeCheck, Star, Bookmark, Sparkles } from "lucide-react";
import type { DiscoverProfile } from "@/lib/nex/discover/_types";

export function ProfileQuickSheet({
  profile, onClose, onConnect
}: {
  profile:   DiscoverProfile | null;
  onClose:   () => void;
  onConnect: (p: DiscoverProfile) => void;
}) {
  const open = profile !== null;
  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-50 transition-opacity"
        style={{
          background: "rgba(15, 17, 21, 0.4)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transitionDuration: "var(--nex-motion-medium)",
          transitionTimingFunction: "var(--nex-ease-signature)"
        }}
      />

      {/* Sheet */}
      <section
        role="dialog"
        aria-modal={open}
        aria-label={profile ? `${profile.first_name} — Discover profile` : "Discover profile"}
        className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-w-md"
        style={{
          background: "var(--nex-cream)",
          borderRadius: "24px 24px 0 0",
          transform: open ? "translateY(0%)" : "translateY(100%)",
          transitionProperty: "transform",
          transitionDuration: "var(--nex-motion-slow)",
          transitionTimingFunction: "var(--nex-ease-signature)",
          boxShadow: "var(--nex-shadow-xl)"
        }}
      >
        {profile && (
          <div className="px-5 pt-4 pb-6">
            {/* Grabber */}
            <div className="mx-auto mb-3 h-1 w-10 rounded-full"
                 style={{ background: "var(--nex-neutral-300)" }} aria-hidden />

            {/* Header row: avatar + identity + close */}
            <div className="flex items-start gap-3">
              <span className="grid h-16 w-16 flex-shrink-0 place-items-center overflow-hidden rounded-full"
                    style={{ background: "var(--nex-neutral-100)", border: "3px solid var(--nex-neutral-0)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={profile.photo_url} alt="" className="h-full w-full object-cover" />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[17px] font-black tracking-tight"
                        style={{ color: "var(--nex-neutral-900)" }}>
                    {profile.first_name}
                  </span>
                  {profile.verified && (
                    <BadgeCheck size={16} strokeWidth={2.25}
                                style={{ color: "var(--nex-accent-500)" }}
                                aria-label="Verified" />
                  )}
                </div>
                <div className="text-[12px]" style={{ color: "var(--nex-neutral-500)" }}>
                  {profile.city}{profile.age ? ` · ${profile.age}` : ""}
                </div>
                {profile.occupation && (
                  <div className="mt-0.5 text-[12px] font-semibold"
                       style={{ color: "var(--nex-neutral-700)" }}>
                    {profile.occupation}
                  </div>
                )}
                {profile.rating != null && (
                  <div className="mt-1 flex items-center gap-0.5" aria-label={`Rating: ${profile.rating} of 5`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={12}
                            strokeWidth={0}
                            fill={i < profile.rating! ? "var(--nex-accent-500)" : "var(--nex-neutral-200)"}
                            aria-hidden />
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={onClose} aria-label="Close"
                      className="grid h-8 w-8 place-items-center rounded-full"
                      style={{ background: "var(--nex-neutral-100)", color: "var(--nex-neutral-700)" }}>
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Languages + accepts */}
            {profile.languages && profile.languages.length > 0 && (
              <div className="mt-3 text-[11.5px]" style={{ color: "var(--nex-neutral-500)" }}>
                {profile.languages.join(" · ")}
              </div>
            )}

            {/* About */}
            {profile.bio && (
              <div className="mt-4">
                <div className="text-[10px] font-bold uppercase tracking-widest"
                     style={{ color: "var(--nex-neutral-500)" }}>
                  About
                </div>
                <p className="mt-1 text-[13px] leading-[1.5]"
                   style={{ color: "var(--nex-neutral-700)" }}>
                  &ldquo;{profile.bio}&rdquo;
                </p>
              </div>
            )}

            {/* Interests */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {profile.interests.map((tag) => (
                <span key={tag}
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ background: "var(--nex-accent-50)", color: "var(--nex-accent-700)" }}>
                  {tag}
                </span>
              ))}
            </div>

            {/* Divider */}
            <div className="mt-5 mb-4 h-px" style={{ background: "var(--nex-neutral-200)" }} />

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onConnect(profile)}
                className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-[13px] font-black transition-transform active:scale-[0.99]"
                style={{
                  background: "linear-gradient(135deg, var(--nex-accent-500) 0%, var(--nex-accent-600) 100%)",
                  color: "var(--nex-neutral-0)",
                  boxShadow: "var(--nex-shadow-sm)"
                }}
              >
                <Sparkles size={16} strokeWidth={2.25} />
                Ask NEX to Connect
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[12.5px] font-semibold"
                style={{
                  background: "var(--nex-neutral-0)",
                  color: "var(--nex-neutral-700)",
                  border: "1px solid var(--nex-neutral-300)"
                }}
              >
                <Bookmark size={14} strokeWidth={2} />
                Save Profile
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
