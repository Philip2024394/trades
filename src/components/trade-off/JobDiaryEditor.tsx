"use client";

// JobDiaryEditor — Job Diary CRUD for the dashboard.
//
// One panel, four flows:
//   1. Project list (default).
//   2. Start project modal — title / location / cover / estimated
//      duration + 3 privacy checkboxes (all required to enable Save).
//   3. Post update modal — project picker, status chip, up to 4
//      images (client-side compressed before upload), 280-char note,
//      "Share to my socials" intent.
//   4. Close project modal — final summary (3-500 chars), optional
//      final cover photo.
//
// Reopen is a single-button action on closed cards (no modal).
//
// Image uploads:
//   * Compress client-side with createImageBitmap + canvas (max 1600px
//     longest edge, JPEG quality 0.72).
//   * Then POST the compressed Blob to /api/trade-off/project-updates/upload.
//   * Server returns { url, size_bytes }.

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  HammerexXratedProject,
  HammerexXratedProjectUpdate
} from "@/lib/supabase";
import { JobDiaryStatusPicker } from "./JobDiaryStatusPicker";
import { STATUS_LABELS, type StatusChipKey } from "@/components/xrated/profile/StatusChip";

const MAX_LIVE_PROJECTS = 20;
const WARN_AT_PROJECTS = 17;
const MAX_UPDATES_PER_PROJECT = 30;
const MAX_IMAGES_PER_UPDATE = 4;
const NOTE_MAX = 280;
const SUMMARY_MAX = 500;
const ACCEPT_IMAGE_EXTS = ".jpg,.jpeg,.png,.webp,.heic,.heif";

type DurationKey = "1wk" | "2wk" | "3-4wk" | "1-2mo" | "3-6mo" | "custom";

const DURATION_OPTIONS: { key: DurationKey; label: string; days: number | null }[] = [
  { key: "1wk", label: "1 week", days: 7 },
  { key: "2wk", label: "2 weeks", days: 14 },
  { key: "3-4wk", label: "3-4 weeks", days: 25 },
  { key: "1-2mo", label: "1-2 months", days: 45 },
  { key: "3-6mo", label: "3-6 months", days: 120 },
  { key: "custom", label: "Custom", days: null }
];

type Mode =
  | { kind: "list" }
  | { kind: "start" }
  | { kind: "post"; defaultProjectId?: string }
  | { kind: "close"; defaultProjectId?: string };

async function compressImage(file: File): Promise<Blob> {
  // HEIC/HEIF won't decode in many browsers — fall through to raw bytes.
  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1600;
    const w = bitmap.width;
    const h = bitmap.height;
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    const targetW = Math.round(w * scale);
    const targetH = Math.round(h * scale);
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.72)
    );
    bitmap.close?.();
    if (!blob) return file;
    return blob;
  } catch {
    return file;
  }
}

async function uploadImage(
  slug: string,
  editToken: string,
  file: File
): Promise<{ ok: true; url: string; size_bytes: number } | { ok: false; error: string }> {
  let blob: Blob = file;
  let filename = file.name;
  if (
    /\.(jpe?g|png|webp)$/i.test(file.name)
  ) {
    blob = await compressImage(file);
    // Always rename to .jpg since canvas re-encodes to JPEG.
    filename = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  }
  const fd = new FormData();
  fd.append("file", new File([blob], filename, { type: blob.type || "image/jpeg" }));
  fd.append("slug", slug);
  fd.append("edit_token", editToken);
  const res = await fetch("/api/trade-off/project-updates/upload", {
    method: "POST",
    body: fd
  });
  const j = await res.json();
  if (!j.ok || !j.url) return { ok: false, error: j.error ?? "Upload failed." };
  return { ok: true, url: j.url, size_bytes: j.size_bytes };
}

function formatRelativeDays(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function dayOf(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

export function JobDiaryEditor({
  slug,
  editToken,
  initialProjects,
  initialUpdateCounts
}: {
  slug: string;
  editToken: string;
  initialProjects: HammerexXratedProject[];
  initialUpdateCounts: Record<string, number>;
}) {
  const [projects, setProjects] = useState<HammerexXratedProject[]>(initialProjects);
  const [updateCounts, setUpdateCounts] =
    useState<Record<string, number>>(initialUpdateCounts);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const liveProjects = useMemo(
    () => projects.filter((p) => p.status === "live"),
    [projects]
  );
  const completedProjects = useMemo(
    () => projects.filter((p) => p.status === "completed"),
    [projects]
  );
  const archivedProjects = useMemo(
    () => projects.filter((p) => p.status === "archived"),
    [projects]
  );
  const liveCount = liveProjects.length;
  const atCap = liveCount >= MAX_LIVE_PROJECTS;
  const nearCap = liveCount >= WARN_AT_PROJECTS && liveCount < MAX_LIVE_PROJECTS;

  async function reopenProject(p: HammerexXratedProject) {
    setErr(null);
    setMsg(null);
    if (atCap) {
      setErr(`Live cap (${MAX_LIVE_PROJECTS}) — close one first.`);
      return;
    }
    try {
      const res = await fetch("/api/trade-off/projects/reopen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: editToken, project_id: p.id })
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.error ?? "Reopen failed.");
        return;
      }
      const saved = j.project as HammerexXratedProject;
      setProjects((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      setMsg(`"${saved.title}" is live again.`);
    } catch {
      setErr("Network error.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Your projects</h2>
          <p className="mt-1 text-[13px] text-brand-muted">
            {liveCount} live &middot; {completedProjects.length} completed
            &middot; {archivedProjects.length} archived &middot; cap{" "}
            {MAX_LIVE_PROJECTS}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setErr(null);
              setMsg(null);
              setMode({ kind: "post" });
            }}
            disabled={liveProjects.length === 0}
            className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-surface px-4 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Post update
          </button>
          <button
            type="button"
            onClick={() => {
              setErr(null);
              setMsg(null);
              setMode({ kind: "start" });
            }}
            disabled={atCap}
            className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Start project
          </button>
        </div>
      </div>

      {nearCap && (
        <p className="rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-[13px] font-semibold text-brand-accent">
          You&rsquo;re close to the {MAX_LIVE_PROJECTS}-project cap (
          {liveCount}/{MAX_LIVE_PROJECTS}). Close finished jobs to free
          slots.
        </p>
      )}
      {atCap && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-300">
          Cap reached ({MAX_LIVE_PROJECTS}/{MAX_LIVE_PROJECTS}). Close a
          project before starting another.
        </p>
      )}

      {err && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
          {err}
        </p>
      )}
      {msg && (
        <p className="rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-xs font-semibold text-brand-accent">
          {msg}
        </p>
      )}

      <ProjectList
        projects={projects}
        updateCounts={updateCounts}
        onPostUpdate={(p) => setMode({ kind: "post", defaultProjectId: p.id })}
        onCloseProject={(p) =>
          setMode({ kind: "close", defaultProjectId: p.id })
        }
        onReopenProject={reopenProject}
      />

      {mode.kind === "start" && (
        <StartProjectModal
          slug={slug}
          editToken={editToken}
          onCancel={() => setMode({ kind: "list" })}
          onSaved={(p) => {
            setProjects((prev) => [p, ...prev]);
            setMode({ kind: "list" });
            setMsg(`Project "${p.title}" started.`);
          }}
        />
      )}

      {mode.kind === "post" && (
        <PostUpdateModal
          slug={slug}
          editToken={editToken}
          projects={liveProjects}
          defaultProjectId={mode.defaultProjectId}
          updateCounts={updateCounts}
          onCancel={() => setMode({ kind: "list" })}
          onSaved={({ update, project, sharedPlatforms }) => {
            setUpdateCounts((prev) => ({
              ...prev,
              [update.project_id]: (prev[update.project_id] ?? 0) + 1
            }));
            setMode({ kind: "list" });
            setMsg(
              sharedPlatforms.length > 0
                ? `Update posted and shared (${sharedPlatforms.join(", ")}).`
                : `Update posted on "${project.title}".`
            );
          }}
        />
      )}

      {mode.kind === "close" && (
        <CloseProjectModal
          slug={slug}
          editToken={editToken}
          projects={liveProjects}
          defaultProjectId={mode.defaultProjectId}
          onCancel={() => setMode({ kind: "list" })}
          onSaved={(p) => {
            setProjects((prev) => prev.map((x) => (x.id === p.id ? p : x)));
            setMode({ kind: "list" });
            setMsg(`Project "${p.title}" closed.`);
          }}
        />
      )}
    </div>
  );
}

// ─── Project list ─────────────────────────────────────────────────────

function ProjectList({
  projects,
  updateCounts,
  onPostUpdate,
  onCloseProject,
  onReopenProject
}: {
  projects: HammerexXratedProject[];
  updateCounts: Record<string, number>;
  onPostUpdate: (p: HammerexXratedProject) => void;
  onCloseProject: (p: HammerexXratedProject) => void;
  onReopenProject: (p: HammerexXratedProject) => void;
}) {
  if (projects.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-brand-line bg-brand-bg px-4 py-6 text-center text-[13px] text-brand-muted">
        No projects yet. Tap &ldquo;+ Start project&rdquo; to log your first
        job.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {projects.map((p) => {
        const count = updateCounts[p.id] ?? 0;
        return (
          <li
            key={p.id}
            className="flex flex-wrap items-start gap-3 rounded-lg border border-brand-line bg-brand-bg p-3"
          >
            <div
              className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-brand-line bg-brand-surface"
              aria-hidden="true"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.cover_image_url}
                alt={p.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-brand-text">
                {p.title}
              </p>
              <p className="text-[13px] text-brand-muted">
                {p.location_label} &middot;{" "}
                {p.status === "live"
                  ? `day ${dayOf(p.started_at)}`
                  : p.status === "completed"
                    ? "completed"
                    : "archived"}{" "}
                &middot; {count}/{MAX_UPDATES_PER_PROJECT} updates
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                p.status === "live"
                  ? "border-brand-accent/60 bg-brand-accent/10 text-brand-accent"
                  : p.status === "completed"
                    ? "border-green-500/40 bg-green-500/10 text-green-300"
                    : "border-brand-line bg-brand-surface text-brand-muted"
              }`}
            >
              {p.status}
            </span>
            <div className="flex w-full gap-2 sm:w-auto">
              {p.status === "live" && (
                <>
                  <button
                    type="button"
                    onClick={() => onPostUpdate(p)}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-brand-accent px-3 text-xs font-bold text-black transition hover:opacity-90 sm:flex-none"
                  >
                    Post update
                  </button>
                  <button
                    type="button"
                    onClick={() => onCloseProject(p)}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent sm:flex-none"
                  >
                    Close
                  </button>
                </>
              )}
              {p.status === "completed" && (
                <button
                  type="button"
                  onClick={() => onReopenProject(p)}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent sm:flex-none"
                >
                  Reopen
                </button>
              )}
              {p.status === "archived" && (
                <span className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-muted">
                  Hidden (admin review)
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Start project modal ──────────────────────────────────────────────

function StartProjectModal({
  slug,
  editToken,
  onCancel,
  onSaved
}: {
  slug: string;
  editToken: string;
  onCancel: () => void;
  onSaved: (project: HammerexXratedProject) => void;
}) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [duration, setDuration] = useState<DurationKey>("2wk");
  const [customDate, setCustomDate] = useState("");
  const [noFaces, setNoFaces] = useState(false);
  const [noAddresses, setNoAddresses] = useState(false);
  const [customerAgreed, setCustomerAgreed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSave =
    title.trim().length >= 3 &&
    location.trim().length >= 2 &&
    coverUrl.length > 0 &&
    noFaces &&
    noAddresses &&
    customerAgreed &&
    !uploading &&
    !saving;

  function estimatedCompleteAt(): string | null {
    if (duration === "custom") {
      if (!customDate) return null;
      const d = new Date(customDate);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString();
    }
    const opt = DURATION_OPTIONS.find((o) => o.key === duration);
    if (!opt?.days) return null;
    const d = new Date();
    d.setDate(d.getDate() + opt.days);
    return d.toISOString();
  }

  async function handleCoverUpload(file: File) {
    setErr(null);
    setUploading(true);
    try {
      const r = await uploadImage(slug, editToken, file);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setCoverUrl(r.url);
    } catch {
      setErr("Upload failed — check your connection.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!canSave) return;
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/trade-off/projects/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          project: {
            title: title.trim().slice(0, 80),
            location_label: location.trim().slice(0, 60),
            cover_image_url: coverUrl,
            estimated_complete_at: estimatedCompleteAt(),
            privacy_confirmed: true,
            sort_order: 0
          }
        })
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.error ?? "Could not start the project.");
        return;
      }
      onSaved(j.project as HammerexXratedProject);
    } catch {
      setErr("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Start a project" onCancel={onCancel}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
            Project title *
          </span>
          <input
            type="text"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Loft conversion, Camden"
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
            Location *
          </span>
          <input
            type="text"
            value={location}
            maxLength={60}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Neighbourhood or town — never a full address."
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
          />
          <p className="mt-1 text-[10px] uppercase tracking-widest text-brand-muted">
            Neighbourhood only. Do not write the house number.
          </p>
        </label>

        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-muted">
            Estimated duration
          </p>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setDuration(o.key)}
                className="inline-flex h-11 items-center rounded-full border-2 px-3 text-[13px] font-bold transition"
                style={{
                  borderColor:
                    duration === o.key ? "#FFB300" : "rgba(255,255,255,0.1)",
                  background:
                    duration === o.key ? "rgba(255,179,0,0.12)" : "transparent",
                  color: duration === o.key ? "#FFB300" : "#A3A3A3"
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          {duration === "custom" && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="mt-2 block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
            />
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-muted">
            Cover photo *
          </p>
          {coverUrl ? (
            <div className="flex items-center gap-3 rounded-md border border-brand-line bg-brand-bg p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl}
                alt="Cover preview"
                className="h-16 w-16 shrink-0 rounded-md object-cover"
              />
              <button
                type="button"
                onClick={() => setCoverUrl("")}
                className="inline-flex h-11 items-center rounded-md border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
              >
                Replace
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex h-11 items-center rounded-md border border-brand-line bg-brand-surface px-4 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-60"
            >
              {uploading ? "Uploading…" : "Upload cover"}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_IMAGE_EXTS}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleCoverUpload(f);
            }}
          />
        </div>

        <div className="rounded-md border border-brand-accent/40 bg-brand-accent/5 p-4">
          <p className="text-[13px] font-extrabold text-brand-accent">
            Privacy checklist
          </p>
          <p className="mt-1 text-[13px] text-brand-muted">
            All three must be true before you can save this project.
          </p>
          <div className="mt-3 space-y-2">
            <PrivacyCheck
              checked={noFaces}
              onChange={setNoFaces}
              label="No customer faces in any photo"
            />
            <PrivacyCheck
              checked={noAddresses}
              onChange={setNoAddresses}
              label="No house numbers, no door signage, no postcodes visible"
            />
            <PrivacyCheck
              checked={customerAgreed}
              onChange={setCustomerAgreed}
              label="The customer agreed to me posting updates from this job"
            />
          </div>
        </div>

        {err && (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
            {err}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-5 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Start project"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-bg px-4 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function PrivacyCheck({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-brand-line bg-brand-surface p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-brand-accent"
      />
      <span className="text-[13px] text-brand-text">{label}</span>
    </label>
  );
}

// ─── Post update modal ────────────────────────────────────────────────

type PostUpdateResult = {
  update: HammerexXratedProjectUpdate;
  project: HammerexXratedProject;
  sharedPlatforms: string[];
};

function PostUpdateModal({
  slug,
  editToken,
  projects,
  defaultProjectId,
  updateCounts,
  onCancel,
  onSaved
}: {
  slug: string;
  editToken: string;
  projects: HammerexXratedProject[];
  defaultProjectId?: string;
  updateCounts: Record<string, number>;
  onCancel: () => void;
  onSaved: (r: PostUpdateResult) => void;
}) {
  const [projectId, setProjectId] = useState<string>(
    defaultProjectId ?? projects[0]?.id ?? ""
  );
  const [status, setStatus] = useState<StatusChipKey | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [shareIntent, setShareIntent] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const project = projects.find((p) => p.id === projectId);
  const usedCount = projectId ? updateCounts[projectId] ?? 0 : 0;
  const projectFull = usedCount >= MAX_UPDATES_PER_PROJECT;
  const canSave =
    !!project &&
    !!status &&
    !uploading &&
    !saving &&
    !projectFull &&
    (note.trim().length > 0 || images.length > 0);

  async function addImage(file: File) {
    if (images.length >= MAX_IMAGES_PER_UPDATE) {
      setErr(`Maximum ${MAX_IMAGES_PER_UPDATE} images per update.`);
      return;
    }
    setErr(null);
    setUploading(true);
    try {
      const r = await uploadImage(slug, editToken, file);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setImages((prev) => [...prev, r.url]);
    } catch {
      setErr("Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!canSave || !project || !status) return;
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/trade-off/project-updates/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          update: {
            project_id: projectId,
            status_chip: status,
            image_urls: images,
            note: note.trim().slice(0, NOTE_MAX),
            shared_platforms: []
          }
        })
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.error ?? "Post failed.");
        return;
      }
      const update = j.update as HammerexXratedProjectUpdate;

      // Web Share intent — fire-and-forget. If the API returns, we
      // patch shared_platforms.
      let shared: string[] = [];
      if (shareIntent && typeof navigator !== "undefined" && navigator.share) {
        try {
          const shareUrl = `${window.location.origin}/${slug}/job-diary/${project.id}`;
          await navigator.share({
            title: project.title,
            text: note.trim() || `Update on ${project.title}`,
            url: shareUrl
          });
          shared = ["native_share"];
        } catch {
          // User cancelled or share rejected — nothing to do.
        }
      } else if (shareIntent) {
        try {
          const shareUrl = `${window.location.origin}/${slug}/job-diary/${project.id}`;
          await navigator.clipboard.writeText(shareUrl);
          shared = ["copy_link"];
        } catch {
          // Clipboard unavailable — silent fallback.
        }
      }

      if (shared.length > 0) {
        // Fire-and-forget patch.
        void fetch("/api/trade-off/project-updates/post", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug,
            edit_token: editToken,
            update_id: update.id,
            shared_platforms: shared
          })
        });
      }

      onSaved({ update, project, sharedPlatforms: shared });
    } catch {
      setErr("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (projects.length === 0) {
    return (
      <ModalShell title="Post an update" onCancel={onCancel}>
        <p className="rounded-md border border-dashed border-brand-line bg-brand-bg px-4 py-6 text-center text-[13px] text-brand-muted">
          No live projects yet. Start one before posting an update.
        </p>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Post an update" onCancel={onCancel}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
            Project
          </span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
          >
            {projects.map((p) => {
              const used = updateCounts[p.id] ?? 0;
              return (
                <option key={p.id} value={p.id}>
                  {p.title} ({used}/{MAX_UPDATES_PER_PROJECT})
                </option>
              );
            })}
          </select>
          {projectFull && (
            <p className="mt-1 text-[13px] font-semibold text-red-300">
              Project is full ({MAX_UPDATES_PER_PROJECT}/{MAX_UPDATES_PER_PROJECT}).
              Close it to archive — you can&rsquo;t post any more updates.
            </p>
          )}
        </label>

        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-muted">
            Status
          </p>
          <JobDiaryStatusPicker
            value={status}
            onChange={(next) => setStatus(next)}
          />
          {status && (
            <p className="mt-1 text-[13px] text-brand-muted">
              {STATUS_LABELS[status].description}
            </p>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-muted">
            Photos ({images.length}/{MAX_IMAGES_PER_UPDATE})
          </p>
          <div className="flex flex-wrap items-start gap-2">
            {images.map((u) => (
              <div
                key={u}
                className="relative h-20 w-20 overflow-hidden rounded-md border border-brand-line"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((x) => x !== u))}
                  className="absolute inset-x-0 bottom-0 inline-flex h-7 items-center justify-center bg-black/70 text-[10px] font-bold text-white"
                  aria-label="Remove photo"
                >
                  Remove
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES_PER_UPDATE && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex h-20 w-20 items-center justify-center rounded-md border-2 border-dashed border-brand-line bg-brand-surface text-[10px] font-bold uppercase tracking-widest text-brand-muted transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-60"
              >
                {uploading ? "…" : "+ Photo"}
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_IMAGE_EXTS}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void addImage(f);
            }}
          />
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
            Note ({note.length}/{NOTE_MAX})
          </span>
          <textarea
            value={note}
            maxLength={NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="One short line — what you did, what's next."
            className="block w-full rounded-md border border-brand-line bg-brand-surface px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-accent"
          />
        </label>

        <label className="flex items-start gap-3 rounded-md border border-brand-line bg-brand-surface p-3">
          <input
            type="checkbox"
            checked={shareIntent}
            onChange={(e) => setShareIntent(e.target.checked)}
            className="mt-0.5 h-5 w-5 accent-brand-accent"
          />
          <span className="text-[13px] text-brand-text">
            Share to my socials when I post (opens your phone&rsquo;s
            share sheet; falls back to copying the link)
          </span>
        </label>

        {err && (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
            {err}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-5 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Posting…" : "Post update"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-bg px-4 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Close project modal ──────────────────────────────────────────────

function CloseProjectModal({
  slug,
  editToken,
  projects,
  defaultProjectId,
  onCancel,
  onSaved
}: {
  slug: string;
  editToken: string;
  projects: HammerexXratedProject[];
  defaultProjectId?: string;
  onCancel: () => void;
  onSaved: (project: HammerexXratedProject) => void;
}) {
  const [projectId, setProjectId] = useState<string>(
    defaultProjectId ?? projects[0]?.id ?? ""
  );
  const [summary, setSummary] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSave =
    projectId.length > 0 &&
    summary.trim().length >= 3 &&
    !uploading &&
    !saving;

  async function handleCoverUpload(file: File) {
    setErr(null);
    setUploading(true);
    try {
      const r = await uploadImage(slug, editToken, file);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setCoverUrl(r.url);
    } catch {
      setErr("Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!canSave) return;
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/trade-off/projects/close", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          project_id: projectId,
          final_summary: summary.trim().slice(0, SUMMARY_MAX),
          cover_image_url: coverUrl
        })
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.error ?? "Close failed.");
        return;
      }
      onSaved(j.project as HammerexXratedProject);
    } catch {
      setErr("Network error.");
    } finally {
      setSaving(false);
    }
  }

  if (projects.length === 0) {
    return (
      <ModalShell title="Close a project" onCancel={onCancel}>
        <p className="rounded-md border border-dashed border-brand-line bg-brand-bg px-4 py-6 text-center text-[13px] text-brand-muted">
          No live projects to close.
        </p>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Close a project" onCancel={onCancel}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
            Project
          </span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
            Final wrap-up ({summary.length}/{SUMMARY_MAX})
          </span>
          <textarea
            value={summary}
            maxLength={SUMMARY_MAX}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            placeholder="One short paragraph — what was delivered, on what timeline."
            className="block w-full rounded-md border border-brand-line bg-brand-surface px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-accent"
          />
        </label>

        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-muted">
            Final cover photo (optional)
          </p>
          {coverUrl ? (
            <div className="flex items-center gap-3 rounded-md border border-brand-line bg-brand-bg p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl}
                alt="Final cover preview"
                className="h-16 w-16 shrink-0 rounded-md object-cover"
              />
              <button
                type="button"
                onClick={() => setCoverUrl("")}
                className="inline-flex h-11 items-center rounded-md border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex h-11 items-center rounded-md border border-brand-line bg-brand-surface px-4 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-60"
            >
              {uploading ? "Uploading…" : "Upload finished shot"}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_IMAGE_EXTS}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleCoverUpload(f);
            }}
          />
        </div>

        {err && (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
            {err}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-5 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Mark complete & archive"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-bg px-4 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────

function ModalShell({
  title,
  children,
  onCancel
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
}) {
  // Lock body scroll while a modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-brand-line bg-brand-bg">
        <div className="flex items-center justify-between border-b border-brand-line bg-brand-surface px-4 py-3">
          <h3 className="text-sm font-extrabold uppercase tracking-widest text-brand-accent">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-md px-2 text-xs font-bold text-brand-muted transition hover:text-brand-text"
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
