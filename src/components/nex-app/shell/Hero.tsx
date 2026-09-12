"use client";

// Hero — Discover-state hero per canonical Staircase mockup.
//
// Uses the real Nex-worker hero asset. Character on the right, cream
// space on the left. NEX brand mark + trade subtitle sit at the top,
// headline text + Ask NEX bar sit stacked below on the cream-safe
// left portion.

import Image from "next/image";
import { Bell, MoreVertical, User } from "lucide-react";
import { useRef, useState } from "react";
import { useConversationState } from "../state/ConversationStateProvider";
import { AskNexBar } from "./AskNexBar";
// NEX Phase 3 · P0 · Control Center wired into hero header
import { ControlCenterPanel } from "./ControlCenterPanel";
// NEX Phase D · §5 · Profile is a distinct surface from Control Center
import { ProfilePanel } from "./ProfilePanel";

export function Hero() {
  const { config } = useConversationState();
  const [controlCenterOpen, setControlCenterOpen] = useState(false);
  const controlCenterEntryRef = useRef<HTMLButtonElement | null>(null);
  // Phase D · Profile identity · separate from Control Center per §5
  const [profileOpen, setProfileOpen] = useState(false);
  const profileEntryRef = useRef<HTMLButtonElement | null>(null);

  const heroImage =
    config.trade_slug === "staircase"
      ? "/staircase-images/hero-nex-worker.png"
      : null;

  const tradeLabel =
    config.trade_slug === "staircase"
      ? "Staircases"
      : config.trade_slug.charAt(0).toUpperCase() + config.trade_slug.slice(1);

  return (
    <section
      className="relative mt-1 min-h-[320px] px-5 pb-3"
      style={{ background: "var(--nex-cream)" }}
    >
      {heroImage && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{
            top: 0,
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 65%, transparent 100%)",
            maskImage:
              "linear-gradient(to bottom, black 0%, black 65%, transparent 100%)"
          }}
        >
          <Image
            src={heroImage}
            alt="Nex — your construction intelligence"
            fill
            priority
            sizes="(max-width: 640px) 100vw, 448px"
            className="object-cover object-right-top"
            style={{ transform: "scale(1.13)", transformOrigin: "right top" }}
          />
        </div>
      )}

      {/* Top row — NEX brand + STAIRCASES subtitle on left · bell on right */}
      <div className="relative z-10 flex items-start justify-between pt-2">
        <div className="flex flex-col">
          <div className="h-11 w-[128px] overflow-hidden" aria-label="NEX">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/staircase-images/nex-logo.png"
              alt="NEX"
              className="h-full w-full"
              style={{ objectFit: "cover", objectPosition: "center" }}
            />
          </div>
          <span
            className="mt-1 text-[12px] font-semibold uppercase"
            style={{ color: "var(--nex-neutral-700)", letterSpacing: "0.32em" }}
          >
            {tradeLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Notifications"
            className="grid h-9 w-9 place-items-center rounded-full transition-colors"
            style={{ color: "var(--nex-neutral-700)" }}
          >
            <Bell size={20} strokeWidth={1.75} />
          </button>
          {/* Phase D §5 · Profile identity · SEPARATE from Control Center */}
          <button
            ref={profileEntryRef}
            type="button"
            aria-label="Open Profile"
            aria-haspopup="dialog"
            aria-expanded={profileOpen}
            aria-controls="nex-profile-hero"
            data-profile-entry="hero"
            data-testid="nex-hero-profile-entry"
            onClick={() => setProfileOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-full transition-colors"
            style={{ color: "var(--nex-neutral-700)" }}
          >
            <User size={20} strokeWidth={1.75} />
          </button>
          <button
            ref={controlCenterEntryRef}
            type="button"
            aria-label="Open Control Center"
            aria-haspopup="dialog"
            aria-expanded={controlCenterOpen}
            aria-controls="nex-control-center-hero"
            data-control-center-entry="hero"
            data-testid="nex-hero-control-center-entry"
            onClick={() => setControlCenterOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-full transition-colors"
            style={{ color: "var(--nex-neutral-700)" }}
          >
            <MoreVertical size={20} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <ControlCenterPanel
        isOpen={controlCenterOpen}
        onClose={() => setControlCenterOpen(false)}
        panelId="nex-control-center-hero"
        returnFocusRef={controlCenterEntryRef}
      />
      <ProfilePanel
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        panelId="nex-profile-hero"
        returnFocusRef={profileEntryRef}
      />

      {/* Headline + Ask NEX bar — width capped to match the paragraph
          text so nothing collides with the character on the right. */}
      <div className="relative z-10 mt-4 flex max-w-[62%] flex-col">
        <h1
          className="text-[26px] font-black leading-[1.08] tracking-tight"
          style={{ color: "var(--nex-neutral-900)" }}
        >
          Design. Plan. Build.
        </h1>
        <h2
          className="text-[26px] font-black leading-[1.08] tracking-tight"
          style={{ color: "var(--nex-accent-500)" }}
        >
          All in One Place.
        </h2>
        <p
          className="mt-3 text-[12px] leading-[1.5]"
          style={{ color: "var(--nex-neutral-500)" }}
        >
          Everything you need to design, plan,<br />
          calculate and build the perfect {config.trade_slug}.
        </p>
        <div className="mt-3">
          <AskNexBar noOuterMargin />
        </div>
      </div>
    </section>
  );
}
