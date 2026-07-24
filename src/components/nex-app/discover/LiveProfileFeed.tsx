"use client";

// LiveProfileFeed — the alive discovery feed. Every ~4s one profile
// rotates out and another rotates in with a fade + slight rise
// animation. Feels alive, not chaotic — gentle motion, premium.
//
// V1 renders a 2-column grid of ProfileCards from mock data,
// filtered by segment + search query. The rotation is client-side
// only; V2 will feed real profiles from the discovery service.

import { useEffect, useMemo, useState } from "react";
import { MOCK_PROFILES } from "@/lib/nex/discover/_mock_profiles";
import type { DiscoverProfile, DiscoverSegment } from "@/lib/nex/discover/_types";
import { ProfileCard } from "./ProfileCard";

const VISIBLE_COUNT = 6;                // 2 cols × 3 rows on mobile
const ROTATE_INTERVAL_MS = 4200;

export function LiveProfileFeed({
  segment, query, onSelect
}: {
  segment:  DiscoverSegment;
  query:    string;
  onSelect: (p: DiscoverProfile) => void;
}) {
  // Pool of profiles matching the current segment + query
  const pool = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_PROFILES.filter((p) => {
      if (p.segment !== segment) return false;
      if (!q) return true;
      return (
        p.first_name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        (p.occupation ?? "").toLowerCase().includes(q) ||
        p.interests.some((i) => i.toLowerCase().includes(q))
      );
    });
  }, [segment, query]);

  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [rotatingSlot, setRotatingSlot] = useState<number | null>(null);

  // Seed visible list whenever pool changes
  useEffect(() => {
    setVisibleIds(pool.slice(0, VISIBLE_COUNT).map((p) => p.id));
    setRotatingSlot(null);
  }, [pool]);

  // Rotate one slot every interval — only if pool > visible
  useEffect(() => {
    if (pool.length <= VISIBLE_COUNT) return;
    const id = setInterval(() => {
      setVisibleIds((current) => {
        const slot = Math.floor(Math.random() * current.length);
        setRotatingSlot(slot);
        // Pick a profile that's NOT currently visible
        const notVisible = pool.filter((p) => !current.includes(p.id));
        if (notVisible.length === 0) return current;
        const incoming = notVisible[Math.floor(Math.random() * notVisible.length)];
        const next = [...current];
        // Delay the actual swap so the fade-out animation has time
        window.setTimeout(() => {
          setVisibleIds((c) => {
            const swap = [...c];
            swap[slot] = incoming.id;
            return swap;
          });
          window.setTimeout(() => setRotatingSlot(null), 260);
        }, 260);
        return next;
      });
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pool]);

  const visibleProfiles = visibleIds
    .map((id) => pool.find((p) => p.id === id))
    .filter((p): p is DiscoverProfile => p != null);

  if (visibleProfiles.length === 0) {
    return (
      <div className="mt-6 px-6 text-center">
        <p className="text-[13px]" style={{ color: "var(--nex-neutral-500)" }}>
          No matches yet. Try a different search or switch segment.
        </p>
      </div>
    );
  }

  return (
    <section className="mt-4 px-4">
      <div className="grid grid-cols-2 gap-3">
        {visibleProfiles.map((p, i) => (
          <div
            key={`${p.id}-${i}`}
            className="nex-fade-slot"
            style={{
              opacity: rotatingSlot === i ? 0 : 1,
              transform: rotatingSlot === i ? "translateY(6px)" : "translateY(0)"
            }}
          >
            <ProfileCard profile={p} onSelect={onSelect} />
          </div>
        ))}
      </div>
    </section>
  );
}
