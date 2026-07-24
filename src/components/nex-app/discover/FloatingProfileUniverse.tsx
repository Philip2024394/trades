"use client";

// FloatingProfileUniverse — the Discover canvas. Rounded-square
// profile CARDS drift softly downward with a slight horizontal sway
// and a fixed ±5° rotation. Cards float at three depth layers (small
// / medium / large) so the surface reads as a 3D layered scene, not
// a flat grid. Cards may overlap freely — depth + shadow do the
// separation work.
//
// Physics: single rAF loop shared by every card. Each card owns its
// own DOM ref and gets its transform mutated directly (no React
// re-render per tick). No collision detection — cards pass through
// each other by design.
//
// Interaction (unchanged from the old bubble universe):
//   · tap a card = select + freeze the whole canvas + open speech
//   · hold a card 5s = dissolve
//   · tap outside = deselect + resume drift
//
// Extra spice added per the redesign brief:
//   · random cards get a floating "Liked your photo" / "Viewing you"
//     / "Sent a like" / "New match" pip that fades in and out to
//     make the surface feel alive without distracting from the UI.

import { useEffect, useMemo, useRef, useState } from "react";
import { MOCK_PROFILES } from "@/lib/nex/discover/_mock_profiles";
import type { DiscoverProfile } from "@/lib/nex/discover/_types";
import { FloatingProfileCard, type CardController, type ActivityKind } from "./FloatingProfileCard";
import { ConnectionSpeechCard } from "./ConnectionSpeechCard";
import { ConnectDialog } from "./ConnectDialog";
import { CornerCategoryButton } from "./CornerCategoryButton";
import { User, Home, Flame } from "lucide-react";

const MAX_CARDS   = 12;
const MIN_SPEED   = 8;     // px/s downward (slow like Apple wallpapers)
const MAX_SPEED   = 20;
const SWAY_MIN    = 8;     // px sway amplitude
const SWAY_MAX    = 22;
const EDGE_MARGIN = 80;
const ACTIVITY_CHANCE = 0.35;   // chance a card carries an activity pip at any moment
const ACTIVITY_ROTATE_MS = 4200; // how often we rotate activity assignments

type CardMode = "normal" | "dragging" | "flung";

type CardState = {
  id:          string;
  profile:     DiscoverProfile;
  size:        number;             // width = height
  depth:       0 | 1 | 2;          // 0 far · 2 close
  rotation:    number;             // degrees, ±5, fixed per card
  x:           number;             // top-left (with sway applied)
  y:           number;
  baseX:       number;             // reference for sway
  swayPhase:   number;
  swayAmp:     number;
  swayPeriod:  number;             // seconds per cycle
  vx:          number;             // horizontal velocity (used in "flung" mode)
  vy:          number;             // vertical velocity
  el:          HTMLDivElement | null;
  frozen:      boolean;
  dismissed:   boolean;
  activity?:   ActivityKind;
  // Interaction / drag state
  mode:        CardMode;
  dragOriginX: number;             // baseX at the moment drag started
  dragOriginY: number;             // y at the moment drag started
  dragOffsetX: number;
  dragOffsetY: number;
  spinRate:    number;             // deg/s — added when flung for spice
};

// Three filter categories — Male · Female · Ready Tonight. Home is
// a nav button (top-left) that returns to the platform home surface.
const CATEGORIES = [
  { id: "male",          label: "Male",          icon: User,
    match: (p: DiscoverProfile) => p.gender === "male" },
  { id: "female",        label: "Female",        icon: User,
    match: (p: DiscoverProfile) => p.gender === "female" },
  { id: "ready-tonight", label: "Ready Tonight", icon: Flame,
    match: (p: DiscoverProfile) => p.availability === "available_now" && p.online }
];

const ACTIVITIES: ActivityKind[] = ["liked", "viewing", "sent-like", "new-match"];

export function FloatingProfileUniverse() {
  const canvasRef      = useRef<HTMLDivElement>(null);
  const cardsRef       = useRef<CardState[]>([]);
  const controllersRef = useRef<Map<string, CardController>>(new Map());
  const rafRef         = useRef<number | null>(null);
  const lastTsRef      = useRef<number>(0);
  const startTsRef     = useRef<number>(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pressedId,  setPressedId]  = useState<string | null>(null);
  const [openConnect, setOpenConnect] = useState<DiscoverProfile | null>(null);
  const [category,   setCategory]   = useState<string>("male");
  const [dismissedProfileIds, setDismissedProfileIds] = useState<Set<string>>(new Set());
  const [rerenderTick, setRerenderTick] = useState(0);

  const activeMatcher = useMemo(() => {
    return CATEGORIES.find((c) => c.id === category)?.match ?? (() => true);
  }, [category]);

  const pool = useMemo(() => {
    return MOCK_PROFILES.filter((p) => activeMatcher(p) && !dismissedProfileIds.has(p.id));
  }, [activeMatcher, dismissedProfileIds]);

  // ── Spawn helpers ──────────────────────────────────────────────
  function nextSlotId(): string {
    return `slot-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }
  function pickProfile(current: CardState[]): DiscoverProfile | null {
    const used = new Set(current.map((c) => c.profile.id));
    const available = pool.filter((p) => !used.has(p.id));
    if (available.length === 0) {
      return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
    }
    return available[Math.floor(Math.random() * available.length)];
  }
  function randomDepth(): 0 | 1 | 2 {
    const r = Math.random();
    if (r < 0.35) return 0;                 // 35% far
    if (r < 0.75) return 1;                 // 40% mid
    return 2;                               // 25% close
  }
  function sizeForDepth(d: 0 | 1 | 2): number {
    if (d === 0) return 88  + Math.random() * 10;
    if (d === 1) return 118 + Math.random() * 12;
    return 148 + Math.random() * 18;
  }
  function spawnCard(currentCards: CardState[], canvasW: number, canvasH: number, entryFromTop = true): CardState | null {
    const profile = pickProfile(currentCards);
    if (!profile) return null;
    const depth   = randomDepth();
    const size    = sizeForDepth(depth);

    // Choose the emptiest X — sample 10 candidate positions, pick the
    // one furthest from all existing card centres. Prevents crowding
    // when the pool is small; still organic when the pool is dense.
    const maxX = Math.max(1, canvasW - size);
    let bestX  = Math.random() * maxX;
    let bestMinDist = -1;
    for (let i = 0; i < 10; i++) {
      const cand = Math.random() * maxX;
      const candCenterX = cand + size / 2;
      let minDist = Infinity;
      for (const other of currentCards) {
        if (other.dismissed) continue;
        const otherCenterX = other.baseX + other.size / 2;
        const d = Math.abs(candCenterX - otherCenterX);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestX = cand;
      }
    }
    const baseX = bestX;

    // Y — stagger initial spawn vertically too, so cards don't all
    // sit at the same row when the surface first paints.
    const y = entryFromTop
      ? -size - Math.random() * 60
      : Math.random() * (canvasH - size);
    const vy      = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
    const rotation = (Math.random() * 10) - 5;                                // -5° to +5°
    const swayPhase  = Math.random() * Math.PI * 2;
    const swayAmp    = SWAY_MIN + Math.random() * (SWAY_MAX - SWAY_MIN);
    const swayPeriod = 5 + Math.random() * 4;                                 // 5–9s
    return {
      id: nextSlotId(),
      profile, size, depth, rotation,
      x: baseX,
      y,
      baseX, swayPhase, swayAmp, swayPeriod,
      vx: 0,
      vy,
      el: null,
      frozen: false,
      dismissed: false,
      activity: Math.random() < ACTIVITY_CHANCE
        ? ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)]
        : undefined,
      mode: "normal",
      dragOriginX: baseX,
      dragOriginY: y,
      dragOffsetX: 0,
      dragOffsetY: 0,
      spinRate: 0
    };
  }

  // ── Init + category change ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const target: CardState[] = [];
    for (let i = 0; i < MAX_CARDS; i++) {
      const c = spawnCard(target, rect.width, rect.height, false);
      if (!c) break;
      target.push(c);
    }
    cardsRef.current = target;
    setRerenderTick((t) => t + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const target: CardState[] = [];
    for (let i = 0; i < MAX_CARDS; i++) {
      const c = spawnCard(target, rect.width, rect.height, false);
      if (!c) break;
      target.push(c);
    }
    cardsRef.current = target;
    setSelectedId(null);
    setRerenderTick((t) => t + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  useEffect(() => {
    cardsRef.current = cardsRef.current.filter((c) => !dismissedProfileIds.has(c.profile.id));
    setRerenderTick((t) => t + 1);
  }, [dismissedProfileIds]);

  // ── rAF loop — drift + sway ────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tick = (ts: number) => {
      if (startTsRef.current === 0) startTsRef.current = ts;
      const rect = canvas.getBoundingClientRect();
      const dt = lastTsRef.current === 0 ? 1 / 60 : Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;
      const t = (ts - startTsRef.current) / 1000;
      const cards = cardsRef.current;

      for (const c of cards) {
        if (c.dismissed) continue;

        if (c.mode === "dragging") {
          // Position controlled directly by user's finger
          c.x = c.dragOriginX + c.dragOffsetX;
          c.y = c.dragOriginY + c.dragOffsetY;
          continue;
        }

        if (c.mode === "flung") {
          // Free ballistic — velocity carries the card off-screen, no sway
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          continue;
        }

        // Normal drift + sway (skip if universe is frozen)
        if (c.frozen) continue;
        c.y += c.vy * dt;
        c.x = c.baseX + Math.sin(t * (2 * Math.PI / c.swayPeriod) + c.swayPhase) * c.swayAmp;
      }

      // Soft repulsion — cards nudge each other apart when they
      // overlap too much. Skipped for dragging / flung cards.
      for (let i = 0; i < cards.length; i++) {
        const a = cards[i];
        if (a.frozen || a.dismissed || a.mode !== "normal") continue;
        for (let j = i + 1; j < cards.length; j++) {
          const b = cards[j];
          if (b.frozen || b.dismissed || b.mode !== "normal") continue;
          if (Math.abs(a.depth - b.depth) > 1) continue;
          const ax = a.x + a.size / 2;
          const ay = a.y + a.size / 2;
          const bx = b.x + b.size / 2;
          const by = b.y + b.size / 2;
          const dx = bx - ax;
          const dy = by - ay;
          const dist = Math.hypot(dx, dy);
          const minGap = (a.size + b.size) * 0.55;
          if (dist > 0 && dist < minGap) {
            const overlap = minGap - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            const push = overlap * dt * 4;
            a.baseX -= nx * push;
            b.baseX += nx * push;
            a.y     -= ny * push;
            b.y     += ny * push;
            a.baseX = Math.max(0, Math.min(rect.width - a.size, a.baseX));
            b.baseX = Math.max(0, Math.min(rect.width - b.size, b.baseX));
          }
        }
      }

      // Respawn cards that drifted off the bottom OR flew off any edge
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        if (c.dismissed) continue;
        const off =
          c.y > rect.height + EDGE_MARGIN ||
          c.x + c.size < -EDGE_MARGIN ||
          c.x > rect.width + EDGE_MARGIN ||
          (c.mode === "flung" && c.y + c.size < -EDGE_MARGIN);
        if (off) {
          const fresh = spawnCard(cards.filter((x) => x !== c), rect.width, rect.height, true);
          if (fresh) cards[i] = fresh;
        }
      }

      // Push transforms to the DOM
      for (const c of cards) {
        if (!c.el) continue;
        c.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [rerenderTick]);

  // ── Rotate activity assignments so pips feel alive ─────────────
  useEffect(() => {
    const id = window.setInterval(() => {
      const cards = cardsRef.current;
      if (cards.length === 0) return;
      // Clear old pips, then reassign randomly
      for (const c of cards) {
        c.activity = Math.random() < ACTIVITY_CHANCE
          ? ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)]
          : undefined;
      }
      setRerenderTick((t) => t + 1);
    }, ACTIVITY_ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  // ── Freeze the whole canvas while a card is held or selected ──
  useEffect(() => {
    const universeFrozen = selectedId != null || pressedId != null;
    for (const c of cardsRef.current) {
      c.frozen = universeFrozen;
    }
  }, [selectedId, pressedId]);

  function selectCard(slotId: string) {
    setSelectedId((prev) => (prev === slotId ? prev : slotId));
  }
  function deselect() { setSelectedId(null); }

  function handlePressStart(slotId: string) { setPressedId(slotId); }
  function handlePressEnd(slotId: string, wasQuickTap: boolean) {
    setPressedId((current) => (current === slotId ? null : current));
    if (wasQuickTap) selectCard(slotId);
  }

  // ── Drag + fling ──────────────────────────────────────────────
  function handleDragStart(slotId: string) {
    const c = cardsRef.current.find((x) => x.id === slotId);
    if (!c) return;
    // Freeze all other cards while this one is being dragged
    for (const other of cardsRef.current) other.frozen = other !== c;
    c.mode = "dragging";
    c.dragOriginX   = c.x;
    c.dragOriginY   = c.y;
    c.dragOffsetX   = 0;
    c.dragOffsetY   = 0;
    setPressedId(slotId);
  }
  function handleDrag(slotId: string, dx: number, dy: number) {
    const c = cardsRef.current.find((x) => x.id === slotId);
    if (!c || c.mode !== "dragging") return;
    c.dragOffsetX = dx;
    c.dragOffsetY = dy;
  }
  function handleFling(slotId: string, vx: number, vy: number) {
    const c = cardsRef.current.find((x) => x.id === slotId);
    if (!c) return;
    // Enforce a minimum fling velocity so a slow release still flies out
    const mag = Math.hypot(vx, vy);
    const MIN_FLING = 620;
    let fvx = vx, fvy = vy;
    if (mag < MIN_FLING) {
      // Boost in the direction of drag offset (or a small random push if truly stationary)
      const dir = Math.hypot(c.dragOffsetX, c.dragOffsetY);
      if (dir > 0.001) {
        fvx = (c.dragOffsetX / dir) * MIN_FLING;
        fvy = (c.dragOffsetY / dir) * MIN_FLING;
      } else {
        const a = Math.random() * Math.PI * 2;
        fvx = Math.cos(a) * MIN_FLING;
        fvy = Math.sin(a) * MIN_FLING;
      }
    }
    c.mode = "flung";
    c.vx = fvx;
    c.vy = fvy;
    // Unfreeze the rest of the universe
    for (const other of cardsRef.current) if (other !== c) other.frozen = false;
    setPressedId((cur) => (cur === slotId ? null : cur));
  }

  function dismiss(slotId: string) {
    const c = cardsRef.current.find((x) => x.id === slotId);
    if (!c) return;
    c.dismissed = true;
    window.setTimeout(() => {
      setDismissedProfileIds((set) => {
        const next = new Set(set);
        next.add(c.profile.id);
        return next;
      });
      if (selectedId === slotId) setSelectedId(null);
    }, 520);
  }

  function askNexToConnect(profile: DiscoverProfile) {
    setOpenConnect(profile);
  }

  const selected = cardsRef.current.find((c) => c.id === selectedId) ?? null;
  const selectedProfile = selected?.profile ?? null;

  return (
    <div
      ref={canvasRef}
      className="relative flex-1 overflow-hidden"
      style={{ background: "transparent", minHeight: 0, height: "100%" }}
      onClick={(e) => { if (e.target === canvasRef.current) deselect(); }}
    >
      {/* Four corner buttons */}
      <CornerCategoryButton
        position="top-left"
        active={false}
        onClick={() => { window.location.href = "/nex-app"; }}
        icon={Home}
        label="Home"
      />
      <CornerCategoryButton
        position="top-right"
        active={category === "female"}
        onClick={() => setCategory("female")}
        icon={User}
        label="Female"
      />
      <CornerCategoryButton
        position="bottom-left"
        active={category === "male"}
        onClick={() => setCategory("male")}
        icon={User}
        label="Male"
      />
      <CornerCategoryButton
        position="bottom-right"
        active={category === "ready-tonight"}
        onClick={() => setCategory("ready-tonight")}
        icon={Flame}
        label="Ready Tonight"
      />

      {/* Cards */}
      {cardsRef.current.map((c) => (
        <FloatingProfileCard
          key={c.id}
          slotId={c.id}
          profile={c.profile}
          size={c.size}
          rotation={c.rotation}
          depth={c.depth}
          activity={c.activity}
          selected={c.id === selectedId}
          dismissing={c.dismissed}
          onPressStart={() => handlePressStart(c.id)}
          onPressEnd={(wasQuick) => handlePressEnd(c.id, wasQuick)}
          onDismiss={() => dismiss(c.id)}
          onDragStart={() => handleDragStart(c.id)}
          onDrag={(dx, dy) => handleDrag(c.id, dx, dy)}
          onFling={(vx, vy) => handleFling(c.id, vx, vy)}
          onMount={(el, ctrl) => {
            const cs = cardsRef.current.find((x) => x.id === c.id);
            if (cs) cs.el = el;
            controllersRef.current.set(c.id, ctrl);
            if (cs && el) el.style.transform = `translate3d(${cs.x}px, ${cs.y}px, 0)`;
          }}
          onUnmount={() => controllersRef.current.delete(c.id)}
        />
      ))}

      {/* Connection speech card — anchored to selected card's centre */}
      {selected && selectedProfile && (
        <ConnectionSpeechCard
          profile={selectedProfile}
          bubbleX={selected.x + selected.size / 2}
          bubbleY={selected.y + selected.size / 2}
          bubbleRadius={selected.size / 2}
          canvasWidth={canvasRef.current?.getBoundingClientRect().width ?? 0}
          canvasHeight={canvasRef.current?.getBoundingClientRect().height ?? 0}
          onConnect={() => askNexToConnect(selectedProfile)}
          onClose={deselect}
        />
      )}

      {/* Bottom-centre JOIN button */}
      <a
        href="/nex-app/discover/join"
        className="absolute z-40 flex items-center gap-1.5 rounded-full px-5 py-2 text-[11.5px] font-black uppercase tracking-widest transition-transform active:scale-95"
        style={{
          bottom: 22,
          left: "50%",
          transform: "translateX(-50%)",
          background: "linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)",
          color: "#1A1A17",
          boxShadow: "var(--nex-shadow-md)"
        }}
      >
        Join
      </a>

      <ConnectDialog profile={openConnect} onClose={() => setOpenConnect(null)} />
    </div>
  );
}
