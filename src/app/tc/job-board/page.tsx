// /tc/job-board — Trade Board.
//
// Verified trades browse open customer job postings, filter by
// discipline + region, and submit quotes. Customers arrive here via
// their /tc/post-job flow; trades arrive via the header link.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, Search, Filter, Plus } from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { JobPostingCard } from "@/apps/jobBoard/components/JobPostingCard";
import {
  DISCIPLINE_LABELS,
  openJobPostings,
  type JobDiscipline
} from "@/apps/jobBoard/data/jobPostings";

const DISCIPLINE_OPTIONS: Array<JobDiscipline | "all"> = [
  "all",
  "plastering",
  "electrical",
  "plumbing",
  "carpentry",
  "roofing",
  "tiling",
  "kitchen-fit",
  "bathroom-fit",
  "general"
];

export default function JobBoardPage() {
  const [discipline, setDiscipline] = useState<JobDiscipline | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const base = openJobPostings();
    return base.filter((p) => {
      if (discipline !== "all" && p.discipline !== discipline) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.customerLocation.toLowerCase().includes(q)
      );
    });
  }, [discipline, query]);

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-6 md:py-8">
        <header className="mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              Trade Center · Job Board
            </div>
            <h1 className="mt-1 flex items-center gap-2 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
              <Briefcase size={24}/>
              Open jobs from customers
            </h1>
            <p className="mt-1 text-[12px] leading-snug text-neutral-600 md:text-[13px]">
              Customers posted these directly. Submit a quote to any that fit — Trade Center
              never re-ranks by margin.
            </p>
          </div>
          <Link
            href="/tc/post-job"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[12px] font-black uppercase tracking-wider text-white shadow-sm"
            style={{ backgroundColor: "#166534" }}
          >
            <Plus size={13}/>
            Post a job (customer)
          </Link>
        </header>

        {/* Filters */}
        <section
          className="mb-5 flex flex-col gap-3 rounded-xl border bg-white p-3 shadow-sm md:flex-row md:items-center"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <label
            className="flex min-h-[44px] flex-1 items-center gap-2 rounded-md border bg-neutral-50 px-3"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <Search size={13} className="text-neutral-500"/>
            <input
              type="text"
              placeholder="Search jobs by keyword or location"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-neutral-400"
            />
          </label>
          <label
            className="flex min-h-[44px] items-center gap-2 rounded-md border bg-neutral-50 px-3 md:min-w-[200px]"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <Filter size={12} className="text-neutral-500"/>
            <select
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value as typeof discipline)}
              className="flex-1 bg-transparent text-[12.5px] outline-none"
            >
              {DISCIPLINE_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d === "all" ? "All disciplines" : DISCIPLINE_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
            {filtered.length} open
          </div>
        </section>

        {/* Cards */}
        {filtered.length === 0 ? (
          <div
            className="rounded-xl border-2 border-dashed p-10 text-center"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          >
            <div className="text-[13px] font-black text-neutral-900">
              No open jobs match your filter
            </div>
            <p className="mx-auto mt-1 max-w-md text-[11.5px] text-neutral-600">
              Try a different discipline. New jobs come through daily.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((p) => (
              <li key={p.id}>
                <JobPostingCard posting={p}/>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-center text-[10.5px] text-neutral-500">
          Quotes on every job appear in submission order. Trade Center never adds our own
          trades to the top and never boosts a quote based on merchant margin.
        </p>
      </main>
    </div>
  );
}
