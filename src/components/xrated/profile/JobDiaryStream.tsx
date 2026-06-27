// Public profile — full Job Diary update stream for a single project.
//
// Server component. Newest update first. Each card shows the status
// chip, posted-relative timestamp, an image grid (1-4 responsive
// columns), and the note.
//
// Used by /<slug>/job-diary/[projectId]/page.tsx.

import {
  supabase,
  type HammerexXratedProjectUpdate
} from "@/lib/supabase";
import { StatusChip } from "./StatusChip";

async function loadUpdates(projectId: string): Promise<HammerexXratedProjectUpdate[]> {
  const res = await supabase
    .from("hammerex_xrated_project_updates")
    .select("*")
    .eq("project_id", projectId)
    .order("posted_at", { ascending: false });
  return (res.data ?? []) as HammerexXratedProjectUpdate[];
}

function formatPosted(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export async function JobDiaryStream({ projectId }: { projectId: string }) {
  const updates = await loadUpdates(projectId);
  if (updates.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-[13px] text-neutral-500">
        No updates yet. Check back soon &mdash; the tradesperson will post as
        the job moves on.
      </p>
    );
  }
  return (
    <ol className="space-y-4">
      {updates.map((u) => (
        <li
          key={u.id}
          className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-3">
            <StatusChip status={u.status_chip} />
            <span className="text-[13px] text-neutral-500">
              {formatPosted(u.posted_at)}
            </span>
          </div>
          {u.image_urls.length > 0 && (
            <ImageGrid urls={u.image_urls} />
          )}
          {u.note && (
            <p className="whitespace-pre-line px-4 py-3 text-[13px] leading-relaxed text-neutral-800 sm:text-sm">
              {u.note}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function ImageGrid({ urls }: { urls: string[] }) {
  const cols = urls.length === 1 ? "grid-cols-1" : "grid-cols-2";
  return (
    <ul className={`grid ${cols} gap-px bg-neutral-100`}>
      {urls.slice(0, 4).map((u, i) => (
        <li key={i} className="relative aspect-square bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={u}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </li>
      ))}
    </ul>
  );
}
