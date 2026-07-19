// LiveProjectsFeed — vertical auto-scrolling marquee showing all new
// projects across the platform. Fires from /sitebook (the app landing).
// Shows project TITLE + CITY + BUDGET (if set) — never the address
// (privacy model: exact address is only visible to assigned trades).
//
// Uses the existing `.activity-marquee` keyframe defined in globals.css
// (translateY 0 → -50% over 45s) with the row list duplicated 2x so the
// loop is seamless — when the first copy slides off the top, the
// duplicate copy is already in view. Pauses on hover.
//
// Server component. Parent page's revalidate controls freshness.
// Evidence-or-silence: when < 3 real projects exist, we render a
// "be first" placeholder rather than fabricating rows.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MapPin, Zap } from "lucide-react";

const BRAND_YELLOW = "#FFB300";

type FeedRow = {
  id:             string;
  title:          string;
  city:           string | null;
  budget_min:     number | null;
  budget_max:     number | null;
  created_at:     string;
};

async function loadRecentProjects(limit = 24): Promise<FeedRow[]> {
  const res = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id, title, address_city, budget_min_gbp, budget_max_gbp, created_at")
    .in("status", ["active", "in-progress", "complete"])
    .order("created_at", { ascending: false })
    .limit(limit);
  type Raw = {
    id:              string;
    title:           string;
    address_city:    string | null;
    budget_min_gbp:  number | null;
    budget_max_gbp:  number | null;
    created_at:      string;
  };
  return ((res.data as Raw[]) ?? []).map((r) => ({
    id:         r.id,
    title:      r.title,
    city:       r.address_city,
    budget_min: r.budget_min_gbp,
    budget_max: r.budget_max_gbp,
    created_at: r.created_at
  }));
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  const wks = Math.floor(days / 7);
  return `${wks}w ago`;
}

function formatBudget(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 1000 ? `£${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `£${n}`;
  if (min && max && min !== max) return `${fmt(min)}–${fmt(max)}`;
  return fmt((max || min) as number);
}

export async function LiveProjectsFeed({
  height = "clamp(220px, 40vh, 380px)",
  title  = "Live · new projects across the UK"
}: {
  height?: string;
  title?:  string;
} = {}) {
  const rows = await loadRecentProjects(24);

  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: "#22C55E" }}
          >
            <span
              aria-hidden
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
              style={{ backgroundColor: "#22C55E" }}
            />
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            {title}
          </span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
          {rows.length ? `${rows.length} live` : ""}
        </span>
      </header>

      {rows.length >= 3 ? (
        <div
          className="relative overflow-hidden"
          style={{
            height,
            maskImage:
              "linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)"
          }}
        >
          {/* activity-marquee: translateY 0 → -50% over 45s. Rows are
              duplicated so when the first copy exits the top, the
              duplicate is already in view for a seamless loop. */}
          <ul className="activity-marquee">
            {[...rows, ...rows].map((r, i) => {
              const budget = formatBudget(r.budget_min, r.budget_max);
              return (
                <li
                  key={`${r.id}-${i}`}
                  className="border-b"
                  style={{ borderColor: "rgba(0,0,0,0.05)" }}
                >
                  <div className="flex items-start gap-2 px-3 py-2.5">
                    <span
                      aria-hidden
                      className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: BRAND_YELLOW }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-black text-neutral-900">
                        {r.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-neutral-500">
                        <MapPin size={9} strokeWidth={2.5}/>
                        <span className="font-bold">{r.city || "UK"}</span>
                        {budget && (
                          <>
                            <span className="text-neutral-300">·</span>
                            <span
                              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-neutral-900"
                              style={{ backgroundColor: "rgba(255,179,0,0.15)" }}
                            >
                              <Zap size={8} strokeWidth={2.5}/>
                              {budget}
                            </span>
                          </>
                        )}
                        <span className="text-neutral-300">·</span>
                        <span>{timeAgo(r.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        // Empty state — evidence-or-silence rule. Don't fabricate rows.
        <div className="px-4 py-6 text-center">
          <p className="text-[12.5px] font-black text-neutral-900">
            Be the first to post
          </p>
          <p className="mt-1 text-[11px] text-neutral-600">
            New projects appear here in real time. City visible — addresses stay private to assigned trades.
          </p>
        </div>
      )}

      {/* Footer strip — reinforces the privacy model */}
      <div
        className="border-t px-3 py-1.5 text-center text-[9.5px] font-bold uppercase tracking-wider text-neutral-400"
        style={{ borderColor: "rgba(0,0,0,0.06)" }}
      >
        City + budget shown · addresses stay private
      </div>
    </div>
  );
}
