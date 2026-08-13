"use client";

// Continue · list view · Philip 2026-08-02.
//
// Per Philip 2026-08-02: don't lead with "Projects." Lead with what the
// user is trying to accomplish. Header reads "Continue" so users think
// "I want to finish something" rather than "I want to manage projects."
// Each row leads with the project title (or purpose if set) so the goal
// is what the eye reaches first, with status + relative time as anchors.
//
// Renders "Nothing to continue yet" empty state that explains the
// concept and links back to Trade Centre. Terminal projects (completed
// / reviewed) live in a separate section below the open list.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, MessageCircle, Store } from "lucide-react";
import {
  formatRelativeTime,
  listProjects,
  PROJECTS_UPDATED_EVENT,
} from "@/lib/nex/projects/customer-store";
import { PROJECT_STATUS_LABEL, isOpenStatus, type Project } from "@/lib/nex/projects/types";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await listProjects();
        if (!cancelled) setProjects(next);
      } catch (err) {
        console.error("[nex-projects][list]", err);
      }
    };
    void refresh();
    const handler = () => { void refresh(); };
    window.addEventListener(PROJECTS_UPDATED_EVENT, handler);
    window.addEventListener("focus", handler);
    return () => {
      cancelled = true;
      window.removeEventListener(PROJECTS_UPDATED_EVENT, handler);
      window.removeEventListener("focus", handler);
    };
  }, []);

  const open = projects.filter((p) => isOpenStatus(p.status));
  const closed = projects.filter((p) => !isOpenStatus(p.status));

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/5 bg-white/90 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full p-1.5 text-black/60 hover:bg-black/5"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-col leading-tight">
          <h1 className="text-base font-semibold text-black">Continue</h1>
          {mounted && open.length > 0 && (
            <span className="text-[11px] text-black/50">
              {open.length === 1
                ? "1 active project"
                : `${open.length} active projects`}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5">
        {!mounted ? (
          <ProjectsSkeleton />
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {open.length > 0 && (
              <section>
                <ul className="space-y-2">
                  {open.map((p) => (
                    <ProjectRow key={p.id} project={p} />
                  ))}
                </ul>
              </section>
            )}

            {closed.length > 0 && (
              <section className={open.length > 0 ? "mt-6" : ""}>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-black/50">
                  Completed ({closed.length})
                </div>
                <ul className="space-y-2">
                  {closed.map((p) => (
                    <ProjectRow key={p.id} project={p} muted />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ProjectRow({ project, muted }: { project: Project; muted?: boolean }) {
  // Philip 2026-08-02 · goal-forward row format. Title leads (what the
  // user is trying to accomplish) · status underneath (where it stands
  // right now). Merchant + relative time collapse into a small caption.
  // Purpose (if set and different from title) shown as a subtle subtitle
  // so the reader sees the goal, not just the label.
  const purposeDiffersFromTitle =
    project.purpose && project.purpose.trim() !== project.title.trim();
  return (
    <li>
      <Link
        href={`/nex-app/projects/${project.id}`}
        className={`block rounded-2xl border border-black/5 bg-white p-3 shadow-sm transition hover:shadow-md ${muted ? "opacity-70" : ""}`}
      >
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700">
            {project.merchant_avatar_url ? (
              <img
                src={project.merchant_avatar_url}
                alt=""
                className="h-11 w-11 rounded-xl object-cover"
              />
            ) : (
              <Store className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-[15px] font-semibold text-black">
                {project.title}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-black/30" />
            </div>
            <div className="mt-1">
              <StatusChip status={project.status} />
            </div>
            {purposeDiffersFromTitle && (
              <div className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-black/70">
                {project.purpose}
              </div>
            )}
            <div className="mt-1.5 text-[11px] text-black/50">
              {project.merchant_name} · {formatRelativeTime(project.updated_at)}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

function StatusChip({ status }: { status: Project["status"] }) {
  const tone = statusTone(status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}
    >
      {PROJECT_STATUS_LABEL[status]}
    </span>
  );
}

function statusTone(status: Project["status"]): string {
  switch (status) {
    case "planning":              return "bg-neutral-100 text-neutral-700";
    case "waiting_for_quotation": return "bg-amber-100 text-amber-800";
    case "quotation_received":    return "bg-blue-100 text-blue-800";
    case "agreed":                return "bg-emerald-100 text-emerald-800";
    case "in_progress":           return "bg-indigo-100 text-indigo-800";
    case "completed":             return "bg-neutral-200 text-neutral-700";
    case "reviewed":              return "bg-neutral-200 text-neutral-500";
  }
}

function EmptyState() {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-black/10 bg-white px-6 py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-100 text-orange-700">
        <MessageCircle className="h-6 w-6" strokeWidth={2.2} />
      </div>
      <div className="text-sm font-semibold text-black">
        Nothing to continue yet
      </div>
      <p className="max-w-xs text-[12px] leading-relaxed text-black/60">
        Every project you start with a trade lives here — so you always
        know what's still open, who's waiting on whom, and what to do next.
      </p>
      <Link
        href="/nex-app/centre"
        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-600"
      >
        Browse Trade Centre
      </Link>
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-24 animate-pulse rounded-2xl border border-black/5 bg-white"
        />
      ))}
    </ul>
  );
}
