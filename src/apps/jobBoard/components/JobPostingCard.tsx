// Job posting card — used on the /tc/job-board list.
// Compact preview, one-tap through to detail + quote.

import Link from "next/link";
import { MapPin, Clock, Users, PoundSterling, ArrowRight } from "lucide-react";
import { FavouriteButton } from "@/apps/favourites/components/FavouriteButton";
import { DISCIPLINE_LABELS, type JobPosting, type JobUrgency } from "../data/jobPostings";

type Props = {
  posting: JobPosting;
};

function urgencyPill(u: JobUrgency) {
  switch (u) {
    case "urgent":         return { label: "Urgent",         bg: "#FEE2E2", fg: "#B91C1C" };
    case "within-week":    return { label: "Within a week",   bg: "#FEF3C7", fg: "#B45309" };
    case "within-month":   return { label: "Within a month",  bg: "#DBEAFE", fg: "#1E40AF" };
    case "flexible":       return { label: "Flexible timing", bg: "#F5F0E4", fg: "#525252" };
  }
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  if (mins < 60 * 24 * 7) return `${Math.floor(mins / (60 * 24))}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function JobPostingCard({ posting }: Props) {
  const u = urgencyPill(posting.urgency);
  return (
    <Link
      href={`/tc/job-board/${posting.slug}`}
      className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md md:flex-row md:items-start"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
            style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
          >
            {DISCIPLINE_LABELS[posting.discipline]}
          </span>
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
            style={{ backgroundColor: u.bg, color: u.fg }}
          >
            <Clock size={9} className="mr-1"/>
            {u.label}
          </span>
          <span className="text-[10.5px] text-neutral-500">{timeAgo(posting.postedAtIso)}</span>
        </div>
        <div className="mt-2 text-[14px] font-black text-neutral-900">{posting.title}</div>
        <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-neutral-600">
          {posting.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-neutral-600">
          <span className="inline-flex items-center gap-1">
            <MapPin size={10}/> {posting.customerLocation}
          </span>
          {posting.budgetRangeGbp && (
            <span className="inline-flex items-center gap-1">
              <PoundSterling size={10}/>
              <strong className="text-neutral-800">
                £{posting.budgetRangeGbp[0].toLocaleString()}–£{posting.budgetRangeGbp[1].toLocaleString()}
              </strong>
              budget
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users size={10}/>
            <strong className="text-neutral-800">{posting.quotes.length}</strong> quote{posting.quotes.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2 self-center">
        <FavouriteButton kind="job-posting" targetSlug={posting.slug} variant="icon"/>
        <ArrowRight size={14} className="text-neutral-400"/>
      </div>
    </Link>
  );
}
