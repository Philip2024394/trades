// NotebookCategoriesStrip — auto-drift category rail above the search
// toolbar. Modelled on the Xrated ShopCategoriesStrip pattern.
//
// Category taxonomy mirrors the Stuart Kingsley building-merchant
// profile's shop_categories set (see src/lib/cache/profiles.json).
// Same 19 slugs · same labels · same image assets — so what users see
// in the notebook lines up 1:1 with what they see on a builders'
// merchant profile.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

type NotebookCategory = {
  slug: string;
  label: string;
  imageUrl: string;
};

// Sourced 1:1 from src/lib/cache/profiles.json →
// demo-stuart-kingsley-building-merchant-hull.shop_categories.
export const BUILDER_MERCHANT_CATEGORIES: ReadonlyArray<NotebookCategory> = [
  { slug: "roofing",             label: "Roofing",              imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccx-removebg-preview.png?updatedAt=1782869134708" },
  { slug: "timber",              label: "Timber",               imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxc-removebg-preview.png?updatedAt=1782869213510" },
  { slug: "windows_and_doors",   label: "Windows & Doors",      imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxc-removebg-preview.png?updatedAt=1782869283688" },
  { slug: "plumbing",            label: "Plumbing",             imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxc-removebg-preview.png?updatedAt=1782869343863" },
  { slug: "electric",            label: "Electric",             imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccc-removebg-preview.png?updatedAt=1782869423624" },
  { slug: "insulation",          label: "Insulation",           imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxcccc-removebg-preview.png?updatedAt=1782869490226" },
  { slug: "plastering_drywall",  label: "Plastering & Drywall", imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxx-removebg-preview.png?updatedAt=1782869570724" },
  { slug: "flooring",            label: "Flooring",             imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxx-removebg-preview.png?updatedAt=1782869642042" },
  { slug: "painting",            label: "Painting",             imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxddd-removebg-preview.png?updatedAt=1782869782971" },
  { slug: "landscaping_fencing", label: "Landscaping & Fencing",imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddd-removebg-preview.png?updatedAt=1782869852804" },
  { slug: "paving",              label: "Paving",               imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxddddd-removebg-preview.png?updatedAt=1782869919885" },
  { slug: "bricks_and_blocks",   label: "Bricks & Blocks",      imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddddffsd-removebg-preview.png?updatedAt=1782869999673" },
  { slug: "sand_gravel",         label: "Sand & Gravel",        imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddddffsdd-removebg-preview.png?updatedAt=1782870079992" },
  { slug: "scaffolding",         label: "Scaffolding",          imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddddffsddds-removebg-preview.png?updatedAt=1782870149460" },
  { slug: "hand_tools",          label: "Hand Tools",           imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddddffsdddsd-removebg-preview.png?updatedAt=1782870209553" },
  { slug: "nuts_bolts_screws",   label: "Nuts, Bolts & Screws", imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddddffsdddsdsdds-removebg-preview.png?updatedAt=1782870305781" },
  { slug: "piping",              label: "Piping",               imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddddffsdddsdsddsds-removebg-preview.png?updatedAt=1782870381460" },
  { slug: "garden",              label: "Garden",               imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddddffsdddsdsddsdssdd-removebg-preview.png?updatedAt=1782870448214" },
  { slug: "workwear",            label: "Workwear",             imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledccccxxcxcxccccxxxxdddddffsdddsdsddsdssdddsd-removebg-preview.png?updatedAt=1782870530588" },

  // Second batch — added 2026-07-11 to close the gap identified against
  // a full UK builders' merchant catalog.
  { slug: "power_tools",         label: "Power Tools",          imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitleddsdaaaaaaaa-removebg-preview.png" },
  { slug: "heating",             label: "Heating",              imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledsdaaaaaaaaa-removebg-preview.png" },
  { slug: "bathroom_sanitary",   label: "Bathrooms & Sanitary", imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledfffddss-removebg-preview.png" },
  { slug: "kitchens_worktops",   label: "Kitchens & Worktops",  imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledddb-removebg-preview.png" },
  { slug: "ironmongery",         label: "Ironmongery",          imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledfdssv-removebg-preview.png" },
  { slug: "ppe_safety",          label: "PPE & Safety",         imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitleddsdaaaaa-removebg-preview.png" },
  { slug: "cement_mortar",       label: "Cement & Mortar",      imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledzxc-removebg-preview.png" },
  { slug: "lighting",             label: "Lighting",             imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledzxcdasd-removebg-preview.png" },
  { slug: "ladders_access",       label: "Ladders & Access",     imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledzx-removebg-preview.png" },
  { slug: "sealants_adhesives",   label: "Sealants & Adhesives", imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledddaaa-removebg-preview.png" },
  { slug: "machinery_plant_hire", label: "Machinery & Plant Hire", imageUrl: "https://ik.imagekit.io/9mrgsv2rp/Untitledsdaaav-removebg-preview.png" },
  { slug: "rainwater_drainage",   label: "Rainwater & Drainage",   imageUrl: "https://ik.imagekit.io/9mrgsv2rp/UntitledZczXC-removebg-preview.png" }
];

type Props = {
  /** Notebook item categorySlugs — used for the per-tile count badge. */
  itemCategories: string[];
};

export function NotebookCategoriesStrip({ itemCategories }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const activeCat = params?.get("cat") ?? "all";
  const [paused, setPaused] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const resumeTimer = useRef<number | null>(null);

  // Any interaction (touch, hover, focus, arrow-click, tile-tap) freezes
  // the drift for 5 seconds so the user can read + select. After 5s
  // of no further activity, the carousel resumes on its own.
  function nudgePause() {
    setPaused(true);
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setPaused(false), 5000);
  }

  function scrollByAmount(px: number) {
    nudgePause();
    scrollerRef.current?.scrollBy({ left: px, behavior: "smooth" });
  }

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of itemCategories) m[s] = (m[s] ?? 0) + 1;
    return m;
  }, [itemCategories]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    function onInteraction() {
      setPaused(true);
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
      resumeTimer.current = window.setTimeout(() => setPaused(false), 5000);
    }
    // Any of these interactions pauses for 5s. No "leave" listener —
    // the timer alone controls resume, per the spec: any touch/hover
    // stops for 5s, and if nothing else happens the strip resumes.
    el.addEventListener("pointerenter", onInteraction);
    el.addEventListener("pointermove",  onInteraction);
    el.addEventListener("touchstart",   onInteraction, { passive: true });
    el.addEventListener("touchmove",    onInteraction, { passive: true });
    el.addEventListener("focusin",      onInteraction);
    return () => {
      el.removeEventListener("pointerenter", onInteraction);
      el.removeEventListener("pointermove",  onInteraction);
      el.removeEventListener("touchstart",   onInteraction);
      el.removeEventListener("touchmove",    onInteraction);
      el.removeEventListener("focusin",      onInteraction);
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    };
  }, []);

  function goTo(catSlug: string) {
    nudgePause();
    const next = new URLSearchParams(params?.toString() ?? "");
    if (catSlug === "all") next.delete("cat");
    else next.set("cat", catSlug);
    router.push(`?${next.toString()}`, { scroll: false });
  }

  const tiles = BUILDER_MERCHANT_CATEGORIES.map((cat) => (
    <CategoryTile
      key={cat.slug}
      label={cat.label}
      imageUrl={cat.imageUrl}
      active={activeCat === cat.slug}
      count={counts[cat.slug] ?? 0}
      onClick={() => goTo(cat.slug)}
    />
  ));
  const doubled = [
    ...tiles,
    ...tiles.map((t, i) => (
      <div key={`clone-${i}`} aria-hidden="true">
        {t}
      </div>
    ))
  ];
  const durationSec = Math.max(20, Math.min(80, tiles.length * 2.6));

  return (
    <nav
      aria-label="Filter notebook by trade category"
      className="relative overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.12)" }}
    >
      <style>{`
        @keyframes tc-cats-drift {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tc-cats-track { animation: none !important; }
        }
      `}</style>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10"
        style={{ background: "linear-gradient(to right, #FFFFFF, transparent)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10"
        style={{ background: "linear-gradient(to left, #FFFFFF, transparent)" }}
      />

      {/* Manual controls — pause + directional steppers */}
      <button
        type="button"
        onClick={() => scrollByAmount(-260)}
        aria-label="Scroll categories left"
        className="absolute left-1 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-white/95 shadow-md hover:bg-white"
        style={{ borderColor: "rgba(139,69,19,0.18)" }}
      >
        <ChevronLeft size={14} className="text-neutral-700"/>
      </button>
      <button
        type="button"
        onClick={() => scrollByAmount(260)}
        aria-label="Scroll categories right"
        className="absolute right-1 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-white/95 shadow-md hover:bg-white"
        style={{ borderColor: "rgba(139,69,19,0.18)" }}
      >
        <ChevronRight size={14} className="text-neutral-700"/>
      </button>
      <div
        ref={scrollerRef}
        className="w-full overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-x"
        }}
      >
        <div
          className="tc-cats-track flex w-max gap-3 py-3 sm:gap-4"
          style={{
            paddingLeft: "16px",
            paddingRight: "48px",
            animation: `tc-cats-drift ${durationSec}s linear infinite`,
            animationPlayState: paused ? "paused" : "running"
          }}
        >
          {doubled}
        </div>
      </div>
    </nav>
  );
}

function CategoryTile({
  label,
  emoji,
  imageUrl,
  active,
  count,
  onClick
}: {
  label: string;
  emoji?: string;
  imageUrl?: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-[84px] shrink-0 flex-col items-center gap-1.5 sm:w-[100px]"
      aria-pressed={active}
    >
      <span
        className="relative grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-2xl border-2 bg-neutral-50 transition sm:h-[84px] sm:w-[84px]"
        style={{ borderColor: active ? "#0A0A0A" : "rgba(139,69,19,0.15)" }}
        aria-hidden="true"
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            className="h-[56px] w-[56px] object-contain sm:h-[68px] sm:w-[68px]"
            draggable={false}
          />
        ) : (
          <span className="text-[26px] sm:text-[30px]" aria-hidden>
            {emoji}
          </span>
        )}
        {count > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[9px] font-black leading-none shadow-sm ring-2 ring-white"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      <span
        className="w-full truncate text-center text-[11px] font-black leading-tight sm:text-[12px]"
        style={{ color: active ? "#0A0A0A" : "#525252" }}
      >
        {label}
      </span>
    </button>
  );
}
