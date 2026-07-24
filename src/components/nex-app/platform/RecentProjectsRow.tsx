"use client";

// RecentProjectsRow — horizontal-scroll card row of the user's recent
// projects across Brains + Studios per canonical mockup. Each card:
// preview image + project title + "Updated Xh ago" subtitle.
//
// V1: placeholder projects (Website / Kitchen Reno / Logo / Social).
// V2: pulls actual user activity from Business Brain + Studios.

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

const RECENT_PROJECTS = [
  {
    id:        "website-project",
    title:     "Website Project",
    updated:   "Updated 2h ago",
    imageUrl:  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&q=80"
  },
  {
    id:        "kitchen-reno",
    title:     "Kitchen Renovation",
    updated:   "Updated 5h ago",
    imageUrl:  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80"
  },
  {
    id:        "logo-design",
    title:     "Logo Design",
    updated:   "Updated 1d ago",
    imageUrl:  "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&q=80"
  },
  {
    id:        "social-campaign",
    title:     "Social Campaign",
    updated:   "Updated 1d ago",
    imageUrl:  "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&q=80"
  }
];

export function RecentProjectsRow() {
  const router = useRouter();
  return (
    <section className="mt-3">
      <header className="mx-5 mb-2 flex items-center justify-between">
        <h3 className="text-[15px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
          Recent Projects
        </h3>
        <button type="button"
                className="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold"
                style={{ color: "var(--nex-accent-500)" }}>
          View All <ArrowRight size={12} strokeWidth={2.25} />
        </button>
      </header>

      <div className="scrollbar-none flex gap-2.5 overflow-x-auto px-5 pb-1">
        {RECENT_PROJECTS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => router.push(`/nex-app/projects/${p.id}`)}
            className="flex flex-none flex-col overflow-hidden rounded-xl text-left transition-transform active:scale-[0.98]"
            style={{
              width: 108,
              boxShadow: "var(--nex-shadow-sm)",
              border: "1px solid var(--nex-neutral-200)",
              background: "var(--nex-neutral-0)"
            }}
            aria-label={p.title}
          >
            <div className="relative aspect-square w-full overflow-hidden"
                 style={{ background: "var(--nex-neutral-100)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imageUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="px-2 py-1.5">
              <div className="line-clamp-1 text-[11px] font-bold leading-tight"
                   style={{ color: "var(--nex-neutral-900)" }}>
                {p.title}
              </div>
              <div className="mt-0.5 text-[9.5px] leading-tight"
                   style={{ color: "var(--nex-neutral-500)" }}>
                {p.updated}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
