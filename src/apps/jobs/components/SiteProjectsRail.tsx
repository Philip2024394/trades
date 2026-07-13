// SiteProjectsRail — left-edge tab + drawer for jobs (renamed to Site Projects).
// Mirror of NotebookRail + TradeCounterRail pattern.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  X,
  ChevronRight,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  ArrowRight,
  MapPin
} from "lucide-react";
import { JOB_FIXTURES } from "@/apps/jobs/data/jobs";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";

const STATUS_TABS: Array<{ key: "all" | "in-progress" | "quoted" | "complete"; label: string }> = [
  { key: "all",         label: "All" },
  { key: "in-progress", label: "In progress" },
  { key: "quoted",      label: "Quoted" },
  { key: "complete",    label: "Complete" }
];

function statusColour(status: string): string {
  switch (status) {
    case "in-progress": return "#F59E0B";
    case "quoted":      return "#0A0A0A";
    case "complete":    return "#166534";
    default:            return "#525252";
  }
}

export function SiteProjectsRail() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"all" | "in-progress" | "quoted" | "complete">("all");
  const [query, setQuery] = useState("");
  const trade = currentViewerTrade();
  const router = useRouter();

  useEffect(() => {
    function onOpen() { setOpen(true); }
    window.addEventListener("tc:open-site-projects", onOpen);
    return () => window.removeEventListener("tc:open-site-projects", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const jobs = JOB_FIXTURES
    .filter((j) => j.ownerTradeSlug === trade.slug)
    .filter((j) => (status === "all" ? true : j.status === status))
    .filter((j) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        j.title.toLowerCase().includes(q) ||
        j.customerName.toLowerCase().includes(q) ||
        j.addressShort.toLowerCase().includes(q)
      );
    });

  return (
    <>
      <aside
        className="fixed left-0 z-20 -translate-y-1/2"
        style={{ top: "56%" }}
        aria-label="Site Projects access"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="group flex items-center gap-1 rounded-r-2xl border py-3 pl-1.5 pr-2 shadow-lg backdrop-blur transition-transform hover:translate-x-0.5"
          style={{
            backgroundColor: "#0A0A0A",
            color: "#FFB300",
            borderColor: "rgba(255,179,0,0.3)"
          }}
          title="Open Site Projects"
        >
          <ChevronRight size={12} className="opacity-60 group-hover:opacity-100"/>
          <div className="flex flex-col items-center gap-2">
            <Briefcase size={16} strokeWidth={2.2}/>
            <div
              className="rotate-180 text-[9px] font-black uppercase tracking-[0.14em]"
              style={{ writingMode: "vertical-rl", color: "#FFB300" }}
            >
              Site Projects
            </div>
          </div>
        </button>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Site Projects"
        >
          <aside className="relative z-10 flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white shadow-2xl">
            <header
              className="flex items-center justify-between border-b p-4"
              style={{ backgroundColor: "#0A0A0A", color: "#FFFFFF", borderColor: "rgba(255,179,0,0.3)" }}
            >
              <div className="flex items-center gap-2">
                <Briefcase size={18} style={{ color: "#FFB300" }}/>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: "#FFB300" }}>
                    TC · Site Projects
                  </div>
                  <div className="text-[13px] font-black">Your jobs on the go</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
                aria-label="Close"
              >
                <X size={16}/>
              </button>
            </header>

            <section className="flex flex-col gap-3 border-b p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
              <div
                className="inline-flex items-center gap-1 rounded-full border bg-neutral-50 p-1"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                {STATUS_TABS.map((t) => {
                  const active = t.key === status;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setStatus(t.key)}
                      className="inline-flex min-h-[32px] flex-1 items-center justify-center rounded-full px-2 text-[10.5px] font-black uppercase tracking-wider"
                      style={{
                        backgroundColor: active ? "#0A0A0A" : "transparent",
                        color: active ? "#FFB300" : "#525252"
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <label
                className="flex min-h-[40px] items-center gap-2 rounded-md border bg-neutral-50 px-3"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <Search size={12} className="text-neutral-500"/>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search projects…"
                  className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-neutral-400"
                />
              </label>
            </section>

            <div className="flex-1 overflow-y-auto p-3">
              <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-neutral-500">
                <span>Your projects</span>
                <span>{jobs.length}</span>
              </div>
              {jobs.length === 0 ? (
                <div
                  className="rounded-lg border-2 border-dashed p-6 text-center text-[10.5px] text-neutral-500"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                >
                  No projects match this filter.
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {jobs.map((j) => (
                    <li key={j.id}>
                      <Link
                        href={`/tc/jobs/${j.slug}`}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-2 rounded-lg border bg-white p-2.5 shadow-sm hover:shadow-md"
                        style={{ borderColor: "rgba(139,69,19,0.15)" }}
                      >
                        <div
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-black uppercase"
                          style={{ backgroundColor: statusColour(j.status), color: j.status === "quoted" ? "#FFB300" : "#FFFFFF" }}
                        >
                          {j.status === "complete" ? <CheckCircle2 size={12}/> : <Clock size={12}/>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-[11.5px] font-black leading-tight text-neutral-900">
                            {j.title}
                          </div>
                          <div className="mt-0.5 text-[10px] text-neutral-500">
                            {j.customerName} · £{j.quoteGbp.toLocaleString()}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-[9.5px] text-neutral-500">
                            <MapPin size={8}/>
                            {j.addressShort}
                          </div>
                        </div>
                        <ArrowRight size={12} className="mt-1 flex-shrink-0 text-neutral-400"/>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t p-3" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
              <button
                type="button"
                onClick={() => { router.push("/tc/jobs"); setOpen(false); }}
                className="inline-flex min-h-[40px] items-center justify-center rounded-full border bg-white text-[10.5px] font-black uppercase tracking-wider text-neutral-800 shadow-sm"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                View all
              </button>
              <Link
                href="/tc/jobs"
                onClick={() => setOpen(false)}
                className="flex min-h-[40px] items-center justify-center gap-1 rounded-full text-[10.5px] font-black uppercase tracking-wider shadow-sm"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                <Plus size={12}/>
                New project
              </Link>
            </div>
          </aside>

          <button
            type="button"
            aria-label="Close"
            className="flex-1 bg-black/40"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}
