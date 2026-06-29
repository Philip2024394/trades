"use client";

// Xrated Trades — "Meet the team" grid.
//
// Renders only when the listing carries 2+ team members. Solo tradies
// never see this section. Boss (member[0]) is always pinned in slot 0
// with the yellow Boss tag. When the total roster is greater than the
// visible grid (5+ members), the three non-boss slots auto-rotate.
//
// Rotation orchestration is OWNED BY THE PARENT so that the set of
// visible members is always distinct — no two slots ever show the same
// person, even transiently. Every STAGGER_MS one slot at a time swaps
// out for the next pool member that isn't currently visible. Each slot
// then runs a local 300ms cross-fade when its member changes. Hover or
// focus pauses rotation; `prefers-reduced-motion` freezes it entirely.

import { useEffect, useRef, useState } from "react";
import type { HammerexTradeOffListing } from "@/lib/supabase";

type TeamMember = NonNullable<HammerexTradeOffListing["team_members"]>[number];

const MAX_MEMBERS = 10;
const VISIBLE_SLOTS = 4;
const ROTATING_SLOTS = VISIBLE_SLOTS - 1;
const STAGGER_MS = 1700;
const FADE_MS = 300;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function TeamGrid({ listing }: { listing: HammerexTradeOffListing }) {
  const all = (listing.team_members ?? []).slice(0, MAX_MEMBERS);
  if (all.length < 2) return null;

  const boss = all[0];
  const pool = all.slice(1);
  const shouldRotate = pool.length > ROTATING_SLOTS;

  return (
    <section className="w-full px-4 pt-8 sm:px-6">
      <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
        Meet the team
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        The foundation of our daily operations.
      </p>

      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <li>
          <TeamCard member={boss} isBoss />
        </li>
        {shouldRotate ? (
          <RotatingSlots pool={pool} />
        ) : (
          pool.slice(0, ROTATING_SLOTS).map((m, i) => (
            <li key={`${m.name}-${i}`}>
              <TeamCard member={m} />
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function RotatingSlots({ pool }: { pool: TeamMember[] }) {
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  // Initial visible indices: 0..ROTATING_SLOTS-1, capped at pool size.
  const [visibleIndices, setVisibleIndices] = useState<number[]>(() =>
    Array.from({ length: ROTATING_SLOTS }, (_, i) => i % pool.length)
  );
  const pointerRef = useRef<number>(ROTATING_SLOTS % pool.length);
  const tickRef = useRef<number>(0);

  useEffect(() => {
    if (reducedMotion || paused) return;
    if (pool.length <= ROTATING_SLOTS) return;
    const interval = setInterval(() => {
      setVisibleIndices((prev) => {
        const targetSlot = tickRef.current % ROTATING_SLOTS;
        tickRef.current += 1;
        // Find next pool index that isn't already shown anywhere.
        const taken = new Set(prev);
        let next = pointerRef.current;
        let safety = 0;
        while (taken.has(next) && safety < pool.length) {
          next = (next + 1) % pool.length;
          safety += 1;
        }
        pointerRef.current = (next + 1) % pool.length;
        const out = [...prev];
        out[targetSlot] = next;
        return out;
      });
    }, STAGGER_MS);
    return () => clearInterval(interval);
  }, [paused, reducedMotion, pool.length]);

  const onPause = () => setPaused(true);
  const onResume = () => setPaused(false);

  return (
    <>
      {visibleIndices.map((idx, slotIndex) => {
        const member = pool[idx];
        return (
          <li key={`slot-${slotIndex}`}>
            <SlotWithFade
              member={member}
              signature={member?.name ?? String(idx)}
              onPause={onPause}
              onResume={onResume}
            />
          </li>
        );
      })}
    </>
  );
}

function SlotWithFade({
  member,
  signature,
  onPause,
  onResume
}: {
  member: TeamMember;
  signature: string;
  onPause: () => void;
  onResume: () => void;
}) {
  const [displayed, setDisplayed] = useState<TeamMember>(member);
  const [displayedSig, setDisplayedSig] = useState<string>(signature);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (signature === displayedSig) return;
    setFading(true);
    const t = setTimeout(() => {
      setDisplayed(member);
      setDisplayedSig(signature);
      setFading(false);
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [signature, displayedSig, member]);

  return (
    <div
      className="h-full transition-opacity"
      style={{
        opacity: fading ? 0 : 1,
        transitionDuration: `${FADE_MS}ms`
      }}
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocus={onPause}
      onBlur={onResume}
    >
      <TeamCard member={displayed} />
    </div>
  );
}

function TeamCard({
  member,
  isBoss = false
}: {
  member: TeamMember;
  isBoss?: boolean;
}) {
  const firstName = member.name.split(/\s+/)[0] || member.name;
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-white"
          style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.10)" }}
        >
          {member.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={member.avatar_url}
              alt={member.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center text-base font-extrabold"
              style={{ background: "#FFB300", color: "#0A0A0A" }}
            >
              {initials(member.name)}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-extrabold text-neutral-900">
              {firstName}
            </p>
            {isBoss && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900"
                style={{ background: "#FFB300" }}
              >
                Boss
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">{member.role}</p>
          {typeof member.years_experience === "number" &&
            member.years_experience > 0 && (
              <p className="mt-1 text-xs font-bold text-[#FFB300]">
                {member.years_experience}+ yrs experience
              </p>
            )}
        </div>
      </div>

      {member.skills && member.skills.length > 0 && (
        <ul className="flex flex-col gap-1">
          {member.skills.slice(0, 3).map((s) => (
            <li
              key={s}
              className="flex items-center gap-2 text-xs font-semibold text-neutral-700"
            >
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "#FFB300" }}
              />
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
