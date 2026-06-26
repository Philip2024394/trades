"use client";

// Public verified-work gallery rendered on a tradie's profile page.
//
// Per-card before / during / after stage toggle is a radio-style switch
// that just swaps the displayed `<img>` — no JS needed for the visual
// itself, but we keep "use client" because the toggle is local React
// state for clean accessibility.
//
// `verified=true` gets the green "Verified by Hammerex Trade Off" pill.
// We never surface a "pending review" label publicly — that's editor
// only. Defensive: returns null when projects is empty.

import { useState } from "react";
import type { HammerexTradeOffProject } from "@/lib/supabase";

type Stage = "before" | "during" | "after";

const STAGE_LABEL: Record<Stage, string> = {
  before: "Before",
  during: "During",
  after: "After"
};

function stagesAvailable(p: HammerexTradeOffProject): Stage[] {
  const out: Stage[] = [];
  if (p.before_url) out.push("before");
  if (p.during_url) out.push("during");
  if (p.after_url) out.push("after");
  return out;
}

function stageUrl(p: HammerexTradeOffProject, stage: Stage): string | null {
  if (stage === "before") return p.before_url;
  if (stage === "during") return p.during_url;
  return p.after_url;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  // The DB stores plain YYYY-MM-DD; render as "Jun 2026" for compactness.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function ProjectGalleryGrid({ projects }: { projects: HammerexTradeOffProject[] }) {
  if (!projects || projects.length === 0) return null;

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-extrabold leading-tight text-brand-text sm:text-2xl">
          Verified work
        </h2>
        <p className="mt-1 text-xs text-brand-muted">
          Real projects, real photos. Verified by Hammerex Trade Off.
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <li key={p.id}>
            <ProjectCard project={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProjectCard({ project }: { project: HammerexTradeOffProject }) {
  const stages = stagesAvailable(project);
  const initial: Stage = stages[0] ?? "after";
  const [stage, setStage] = useState<Stage>(initial);
  const url = stageUrl(project, stage);
  const dateLabel = formatDate(project.completed_at);
  const showToggles = stages.length > 1;

  return (
    <article className="overflow-hidden rounded-2xl border border-brand-line bg-brand-surface/40">
      <div className="relative aspect-[4/3] w-full bg-black">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`${project.title} — ${STAGE_LABEL[stage]}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-brand-muted">
            No photo
          </div>
        )}
        {project.verified && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand-success/90 px-2.5 py-1 text-[11px] font-bold text-black shadow-sm">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Verified by Hammerex Trade Off
          </span>
        )}
        {showToggles && (
          <div
            role="tablist"
            aria-label={`${project.title} project stages`}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-white/15 bg-black/70 p-1 backdrop-blur"
          >
            {stages.map((s) => {
              const active = s === stage;
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStage(s)}
                  className={`h-8 rounded-full px-3 text-[11px] font-bold uppercase tracking-wide transition ${
                    active
                      ? "bg-brand-accent text-black"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  {STAGE_LABEL[s]}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <h3 className="text-xs font-bold text-brand-text">{project.title}</h3>
        {(project.location_city || dateLabel) && (
          <p className="text-[11px] text-brand-muted">
            {[project.location_city, dateLabel].filter(Boolean).join(" · ")}
          </p>
        )}
        {project.description && (
          <p className="text-xs leading-relaxed text-brand-muted">{project.description}</p>
        )}
      </div>
    </article>
  );
}
