"use client";

// ConnectionSpeechCard — small floating card that appears attached to
// a selected bubble. Feels like a speech bubble emerging from the
// avatar. Positioned dynamically based on the bubble's location so it
// doesn't clip the viewport edges.
//
// Phase Social · Philip 2026-09-07 · upgraded to the Social Card:
//   · shows voluntarily-declared business_info when present (§12)
//   · shows meeting_preference chips when present (§13)
//   · Save button (private · §14 · wires social-store.saveProfile)
//   · Invite button (§15 · triggers onConnect → parent opens InviteMeetPanel)
// Nothing removed · legacy onConnect/onClose contract preserved.

import { useEffect, useState } from "react";
import { Send, X, BadgeCheck, Bookmark, BookmarkCheck } from "lucide-react";
import type { DiscoverProfile } from "@/lib/nex/discover/_types";
import {
  findMeetingPreference,
  normaliseMeetingPreferences,
} from "@/lib/nex/social/meeting-preferences";
import { isSaved, saveProfile, unsaveProfile, type SocialProfileRef } from "@/lib/nex/social/social-store";

const CARD_WIDTH = 240;
const CARD_APPROX_HEIGHT = 260;

export function ConnectionSpeechCard({
  profile,
  bubbleX,
  bubbleY,
  bubbleRadius,
  canvasWidth,
  canvasHeight,
  onConnect,
  onClose
}: {
  profile:       DiscoverProfile;
  bubbleX:       number;
  bubbleY:       number;
  bubbleRadius:  number;
  canvasWidth:   number;
  canvasHeight:  number;
  onConnect:     () => void;
  onClose:       () => void;
}) {
  // Decide side (right if space, else left) + vertical clamp
  const preferRight = bubbleX + bubbleRadius + CARD_WIDTH + 20 < canvasWidth;
  const left = preferRight
    ? bubbleX + bubbleRadius + 14
    : bubbleX - bubbleRadius - CARD_WIDTH - 14;
  const rawTop = bubbleY - CARD_APPROX_HEIGHT / 2;
  const top = Math.max(12, Math.min(canvasHeight - CARD_APPROX_HEIGHT - 12, rawTop));

  // Phase Social · Save state (private · §14 · never notifies).
  // Read once on mount + refresh on toggles so the icon reflects storage.
  const [saved, setSaved] = useState(false);
  useEffect(() => { setSaved(isSaved(profile.id)); }, [profile.id]);
  const toggleSave = () => {
    const ref: SocialProfileRef = {
      id: profile.id,
      first_name: profile.first_name,
      city: profile.city ?? null,
      photo_url: profile.photo_url ?? null,
      business_info: profile.business_info ?? null,
    };
    if (saved) { unsaveProfile(profile.id); setSaved(false); }
    else       { saveProfile(ref);            setSaved(true);  }
  };

  // Phase Social · derive meeting preferences from the profile (§13).
  // Absent = we render no chips · never fabricated.
  const meetingPrefs = normaliseMeetingPreferences(profile.meeting_preferences)
    .map((id) => findMeetingPreference(id))
    .filter((m): m is NonNullable<typeof m> => m !== null);

  return (
    <>
      {/* Invisible backdrop — a tap outside the card deselects */}
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 z-20"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Connect with ${profile.first_name}`}
        className="absolute z-30 flex flex-col overflow-hidden rounded-2xl nex-speech-card"
        style={{
          left,
          top,
          width: CARD_WIDTH,
          background: "var(--nex-neutral-0)",
          border: "1px solid var(--nex-neutral-200)",
          boxShadow: "var(--nex-shadow-xl)"
        }}
      >
        {/* Speech bubble tail — pointing at the bubble */}
        <span
          aria-hidden
          className="absolute h-3 w-3 rotate-45"
          style={{
            background: "var(--nex-neutral-0)",
            border: "1px solid var(--nex-neutral-200)",
            top: Math.max(16, Math.min(CARD_APPROX_HEIGHT - 24, bubbleY - top - 6)),
            left: preferRight ? -6 : "auto",
            right: preferRight ? "auto" : -6,
            borderRight: preferRight ? "none" : undefined,
            borderTop:   preferRight ? "none" : undefined,
            borderLeft:  preferRight ? undefined : "none",
            borderBottom: preferRight ? undefined : "none"
          }}
        />

        {/* Header */}
        <div className="flex items-start gap-2 px-3 pt-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="truncate text-[13px] font-black" style={{ color: "var(--nex-neutral-900)" }}>
                {profile.first_name}
              </span>
              {profile.verified && (
                <BadgeCheck size={12} strokeWidth={2.25}
                            style={{ color: "var(--nex-accent-500)", flexShrink: 0 }}
                            aria-label="Verified" />
              )}
            </div>
            {profile.occupation && (
              <div className="truncate text-[10.5px] font-medium leading-tight"
                   style={{ color: "var(--nex-neutral-700)" }}>
                {profile.occupation}
              </div>
            )}
            {/* Phase Social §12 · business_info displayed ONLY when the
                user has voluntarily provided it · never fabricated. */}
            {profile.business_info && (
              <div
                className="truncate text-[10px] leading-tight mt-0.5"
                data-testid="nex-social-card-business"
                style={{ color: "var(--nex-accent-700)", fontWeight: 600 }}
              >
                {profile.business_info}
              </div>
            )}
            <div className="text-[10px] leading-tight" style={{ color: "var(--nex-neutral-500)" }}>
              {profile.city}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
                  className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full"
                  style={{ background: "var(--nex-neutral-100)", color: "var(--nex-neutral-500)" }}>
            <X size={12} strokeWidth={2.25} />
          </button>
        </div>

        {profile.bio && (
          <div className="px-3 pt-2">
            <p className="line-clamp-3 text-[11px] leading-[1.4]"
               style={{ color: "var(--nex-neutral-700)" }}>
              &ldquo;{profile.bio}&rdquo;
            </p>
          </div>
        )}

        {profile.interests.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 px-3">
            {profile.interests.slice(0, 3).map((tag) => (
              <span key={tag}
                    className="rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold"
                    style={{ background: "var(--nex-accent-50)", color: "var(--nex-accent-700)" }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Phase Social §13 · "Interested in meeting for" chip row · only
            renders when the profile has meeting_preferences. Distinct
            from `interests` (which is what the person likes) — this is
            what they'll agree to for a FIRST meeting. */}
        {meetingPrefs.length > 0 && (
          <div className="px-3 pt-2" data-testid="nex-social-card-meeting-prefs">
            <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "var(--nex-neutral-500)", fontWeight: 700 }}>
              Interested in meeting for
            </div>
            <div className="flex flex-wrap gap-1">
              {meetingPrefs.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: "var(--nex-neutral-100)", color: "var(--nex-neutral-700)" }}
                  data-testid={`nex-social-card-meeting-pref-${m.id}`}
                >
                  <span aria-hidden>{m.emoji}</span>
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Phase Social · Save + Invite side by side. Save is silent
            (§14) · Invite triggers parent-owned InviteMeetPanel via the
            legacy onConnect callback (renamed conceptually · signature
            preserved for backwards compat). */}
        <div className="mt-3 grid grid-cols-[auto_1fr]">
          <button
            type="button"
            onClick={toggleSave}
            aria-pressed={saved}
            aria-label={saved ? "Unsave profile" : "Save profile"}
            data-testid="nex-social-card-save"
            className="flex items-center justify-center px-3 text-[11.5px] font-bold transition-colors"
            style={{
              background: saved ? "var(--nex-accent-50)" : "var(--nex-neutral-100)",
              color: saved ? "var(--nex-accent-700)" : "var(--nex-neutral-700)",
              borderRight: "1px solid var(--nex-neutral-200)",
              gap: 4,
            }}
          >
            {saved ? <BookmarkCheck size={14} strokeWidth={2.25} /> : <Bookmark size={14} strokeWidth={2.25} />}
            {saved ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={onConnect}
            data-testid="nex-social-card-invite"
            className="flex items-center justify-center gap-1.5 py-2.5 text-[11.5px] font-black transition-transform active:scale-[0.99]"
            style={{
              background: "linear-gradient(135deg, var(--nex-accent-500) 0%, var(--nex-accent-600) 100%)",
              color: "var(--nex-neutral-0)"
            }}
          >
            <Send size={13} strokeWidth={2.25} />
            Invite to Meet
          </button>
        </div>
      </div>
    </>
  );
}
