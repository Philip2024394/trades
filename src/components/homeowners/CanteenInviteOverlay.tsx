"use client";

// CanteenInviteOverlay — floating "Invite to project" CTA rendered on
// individual canteen pages when a homeowner is browsing in invite
// mode. Sits OVER the template rather than inside it so we don't have
// to fork every canteen template.
//
// Two placements per Philip 2026-07-18:
//   1. Floating breathing pill (desktop + tablet) — top-right,
//      below the canteen header. Small, calm, always visible.
//   2. Sticky bottom bar (mobile only) — full-width primary CTA
//      that stays in view while scrolling long canteen profiles.
//
// Motion — attention without noise:
//   • 2-second glow-pulse on mount (grabs eye once)
//   • Then rests with a 4-second "breathing" amber glow (~30%
//     opacity oscillation on the outer shadow — feels alive)
//   • Pauses on hover so the user can read + tap
//   • Respects `prefers-reduced-motion` (falls back to static glow)
//
// Copy is contextual:
//   • Single project on the homeowner: "Invite Watson Plumbing to
//     En-suite plumbing"
//   • Multiple projects: "Invite Watson Plumbing to your project"

import { useEffect, useState } from "react";
import { UserPlus, Zap } from "lucide-react";
import { InvitationModal, type InviteProject } from "./InvitationModal";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

export function CanteenInviteOverlay({
  tradeName,
  tradeSlug,
  projects,
  homeownerFirstName
}: {
  tradeName:           string;
  tradeSlug:           string;
  projects:            InviteProject[];
  homeownerFirstName?: string | null;
}) {
  const [modalOpen, setModalOpen]   = useState(false);

  // Detect prefers-reduced-motion — SSR-safe (defaults to animated,
  // switches off after mount if user has motion muted).
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener?.("change", listener);
    return () => mq.removeEventListener?.("change", listener);
  }, []);

  // Contextual copy — if the owner has exactly one active project, name it.
  const singleProject = projects.length === 1 ? projects[0] : null;
  const projectLabel  = singleProject
    ? singleProject.title
    : "your project";

  const buttonLabel = `Invite ${tradeName} to ${projectLabel}`;

  // Motion removed 2026-07-19 (Philip: clean subtle UI ages better than
  // flashy animations). The invite CTA is a solid pill — the yellow
  // border + sticky-footer position is attention enough. `reduceMotion`
  // kept in the code so future tasteful entrances (e.g. slide-in on
  // scroll) respect the user's preference.
  const motionClass = "tn-invite-static";
  void reduceMotion;

  return (
    <>
      {/* Sticky invite bar — shown at the BOTTOM of every viewport
          (desktop + tablet + mobile). Full-width on mobile; centred
          with a max-width on desktop so it doesn't dominate large
          screens. Stays in view while the canteen profile scrolls.
          No dismiss — homeowner is in invite mode on purpose. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border-2 bg-white p-3 shadow-2xl mx-3 mb-3 sm:mb-4 sm:p-3.5" style={{ borderColor: BRAND_YELLOW }}>
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-900"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            <UserPlus size={16} strokeWidth={2.5}/>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-black text-neutral-900">
              {buttonLabel}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[10.5px] font-bold text-neutral-500">
              <Zap size={10} strokeWidth={2.5}/>
              1 washer · WhatsApp invitation with link
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={"inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition hover:brightness-95 " + motionClass}
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            <UserPlus size={13} strokeWidth={2.5}/>
            <span className="hidden sm:inline">Invite to project</span>
            <span className="sm:hidden">Invite</span>
          </button>
        </div>
      </div>

      {/* Optional homeowner hello — sits inline on the top pill so the
          user knows this is their invite context (matches the amber
          banner on the directory). */}
      {homeownerFirstName && (
        <span className="sr-only">Invite mode active for {homeownerFirstName}</span>
      )}

      {modalOpen && (
        <InvitationModal
          tradeSlug={tradeSlug}
          tradeName={tradeName}
          projects={projects}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Motion CSS scoped to this component. Kept inline so the CTA
          renders correctly even if globals.css hasn't loaded yet. */}
      <style jsx global>{`
        @keyframes tn-invite-pulse-once {
          0%   { box-shadow: 0 0 0 0 rgba(255,179,0,0.55), 0 8px 24px -8px rgba(0,0,0,0.25); }
          70%  { box-shadow: 0 0 0 18px rgba(255,179,0,0), 0 8px 24px -8px rgba(0,0,0,0.25); }
          100% { box-shadow: 0 0 0 0 rgba(255,179,0,0), 0 8px 24px -8px rgba(0,0,0,0.25); }
        }
        @keyframes tn-invite-breathe {
          0%, 100% { box-shadow: 0 0 8px 1px rgba(255,179,0,0.25), 0 8px 24px -8px rgba(0,0,0,0.25); }
          50%      { box-shadow: 0 0 16px 3px rgba(255,179,0,0.55), 0 8px 24px -8px rgba(0,0,0,0.25); }
        }
        .tn-invite-pulse-once { animation: tn-invite-pulse-once 2s ease-out 1; }
        .tn-invite-breathe    { animation: tn-invite-pulse-once 2s ease-out 1, tn-invite-breathe 4s ease-in-out 2s infinite; }
        .tn-invite-breathe:hover, .tn-invite-pulse-once:hover { animation-play-state: paused; }
        .tn-invite-static     { box-shadow: 0 0 12px 2px rgba(255,179,0,0.45), 0 8px 24px -8px rgba(0,0,0,0.25); }
        @media (prefers-reduced-motion: reduce) {
          .tn-invite-pulse-once, .tn-invite-breathe { animation: none !important; }
        }
      `}</style>
    </>
  );
}
