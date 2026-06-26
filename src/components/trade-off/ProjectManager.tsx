"use client";

// Client UI for the Verified Work Gallery editor at
// /trade-off/edit/[slug]/projects. Lists current projects with edit /
// delete, plus an inline form to add new ones. Photo uploaders post to
// /api/trade-off/projects/upload (Before / During / After).
//
// `verified` is admin-only. We surface a green "Verified by Hammerex"
// pill on verified rows and an amber "Pending review" pill on unverified
// rows — but the public grid hides the pending pill entirely.

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { HammerexTradeOffProject } from "@/lib/supabase";

type Mode = "list" | "create" | { kind: "edit"; project: HammerexTradeOffProject };

type FormState = {
  title: string;
  description: string;
  location_city: string;
  completed_at: string;
  before_url: string;
  during_url: string;
  after_url: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  location_city: "",
  completed_at: "",
  before_url: "",
  during_url: "",
  after_url: ""
};

function projectToForm(p: HammerexTradeOffProject): FormState {
  return {
    title: p.title ?? "",
    description: p.description ?? "",
    location_city: p.location_city ?? "",
    completed_at: p.completed_at ?? "",
    before_url: p.before_url ?? "",
    during_url: p.during_url ?? "",
    after_url: p.after_url ?? ""
  };
}

export function ProjectManager({
  slug,
  editToken,
  initialProjects
}: {
  slug: string;
  editToken: string;
  initialProjects: HammerexTradeOffProject[];
}) {
  const [projects, setProjects] = useState<HammerexTradeOffProject[]>(initialProjects);
  const [mode, setMode] = useState<Mode>("list");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const editLink = useMemo(
    () => `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(editToken)}`,
    [slug, editToken]
  );

  function startCreate() {
    setForm(EMPTY_FORM);
    setErr(null);
    setMode("create");
  }
  function startEdit(p: HammerexTradeOffProject) {
    setForm(projectToForm(p));
    setErr(null);
    setMode({ kind: "edit", project: p });
  }
  function cancelEdit() {
    setForm(EMPTY_FORM);
    setErr(null);
    setMode("list");
  }
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setErr(null);
    if (!form.title.trim()) {
      setErr("Title is required.");
      return;
    }
    if (!form.before_url && !form.during_url && !form.after_url) {
      setErr("Add at least one photo (Before, During, or After).");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/trade-off/projects/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug,
            edit_token: editToken,
            title: form.title.trim(),
            description: form.description.trim() || null,
            before_url: form.before_url || null,
            during_url: form.during_url || null,
            after_url: form.after_url || null,
            location_city: form.location_city.trim() || null,
            completed_at: form.completed_at || null
          })
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          project_id?: string;
          error?: string;
        };
        if (!body.ok || !body.project_id) {
          setErr(body.error || "Could not save project.");
          return;
        }
        // Prepend to local list with the inputs the user just saved.
        const newProject: HammerexTradeOffProject = {
          id: body.project_id,
          listing_id: "",
          title: form.title.trim(),
          description: form.description.trim() || null,
          before_url: form.before_url || null,
          during_url: form.during_url || null,
          after_url: form.after_url || null,
          location_city: form.location_city.trim() || null,
          completed_at: form.completed_at || null,
          verified: false,
          sort_order: projects.length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setProjects((arr) => [newProject, ...arr]);
        cancelEdit();
      } else if (typeof mode === "object" && mode.kind === "edit") {
        const res = await fetch("/api/trade-off/projects/update", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug,
            edit_token: editToken,
            project_id: mode.project.id,
            fields: {
              title: form.title.trim(),
              description: form.description.trim() || null,
              before_url: form.before_url || null,
              during_url: form.during_url || null,
              after_url: form.after_url || null,
              location_city: form.location_city.trim() || null,
              completed_at: form.completed_at || null
            }
          })
        });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!body.ok) {
          setErr(body.error || "Could not save changes.");
          return;
        }
        setProjects((arr) =>
          arr.map((p) =>
            p.id === mode.project.id
              ? {
                  ...p,
                  title: form.title.trim(),
                  description: form.description.trim() || null,
                  before_url: form.before_url || null,
                  during_url: form.during_url || null,
                  after_url: form.after_url || null,
                  location_city: form.location_city.trim() || null,
                  completed_at: form.completed_at || null,
                  updated_at: new Date().toISOString()
                }
              : p
          )
        );
        cancelEdit();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeProject(p: HammerexTradeOffProject) {
    if (!window.confirm(`Delete "${p.title}"? This can't be undone.`)) return;
    setErr(null);
    try {
      const res = await fetch("/api/trade-off/projects/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: editToken, project_id: p.id })
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!body.ok) {
        setErr(body.error || "Could not delete project.");
        return;
      }
      setProjects((arr) => arr.filter((x) => x.id !== p.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-brand-muted">
          Each project is a Before / During / After photo set. Once you publish, Hammerex reviews
          and stamps verified projects with a green badge.
        </p>
        <Link
          href={editLink}
          className="shrink-0 text-xs font-semibold text-brand-accent underline-offset-4 hover:underline"
        >
          ← Back to edit profile
        </Link>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {err}
        </div>
      )}

      {mode === "list" && (
        <button
          type="button"
          onClick={startCreate}
          className="h-11 w-full rounded-lg bg-brand-accent px-6 text-xs font-bold text-black transition hover:opacity-90 sm:w-auto"
        >
          + Add a project
        </button>
      )}

      {(mode === "create" || (typeof mode === "object" && mode.kind === "edit")) && (
        <ProjectForm
          form={form}
          update={update}
          onCancel={cancelEdit}
          onSubmit={submit}
          submitting={submitting}
          mode={mode === "create" ? "create" : "edit"}
        />
      )}

      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-brand-line bg-brand-surface/40 p-6 text-center text-xs text-brand-muted">
          No projects yet. Add your first one — even a single after-photo counts.
        </p>
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border border-brand-line bg-brand-surface/40 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-xs font-bold text-brand-text">{p.title}</h3>
                    {p.verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-success/20 px-2 py-0.5 text-[11px] font-bold text-brand-success">
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
                        Verified by Hammerex
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                        Pending review
                      </span>
                    )}
                  </div>
                  {(p.location_city || p.completed_at) && (
                    <p className="mt-1 text-[11px] text-brand-muted">
                      {[p.location_city, p.completed_at].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {p.description && (
                    <p className="mt-2 line-clamp-2 text-xs text-brand-muted">{p.description}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    {p.before_url && <Thumb url={p.before_url} label="Before" />}
                    {p.during_url && <Thumb url={p.during_url} label="During" />}
                    {p.after_url && <Thumb url={p.after_url} label="After" />}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="h-11 flex-1 rounded-lg border border-brand-line bg-brand-surface px-4 text-xs font-semibold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => removeProject(p)}
                  className="h-11 flex-1 rounded-lg border border-brand-line bg-brand-surface px-4 text-xs font-semibold text-brand-text transition hover:border-red-500 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Thumb({ url, label }: { url: string; label: string }) {
  return (
    <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-brand-line bg-neutral-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="h-full w-full object-cover" />
      <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-center text-[10px] font-bold uppercase text-white">
        {label}
      </span>
    </div>
  );
}

function ProjectForm({
  form,
  update,
  onCancel,
  onSubmit,
  submitting,
  mode
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
  mode: "create" | "edit";
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-brand-accent/40 bg-brand-surface/60 p-5">
      <h2 className="text-xs font-bold uppercase tracking-widest text-brand-accent">
        {mode === "create" ? "New project" : "Edit project"}
      </h2>

      <Field label="Project title *">
        <Input
          value={form.title}
          onChange={(v) => update("title", v)}
          placeholder="e.g. Loft conversion, Stockport"
          maxLength={160}
        />
      </Field>
      <Field label="Description (optional)">
        <textarea
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="A short, plain description. What was the job and how did it go?"
          maxLength={2000}
          rows={4}
          className="w-full rounded-lg border border-brand-line bg-brand-bg p-3 text-xs leading-relaxed text-brand-text focus:border-brand-accent focus:outline-none"
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Location (optional)">
          <Input
            value={form.location_city}
            onChange={(v) => update("location_city", v)}
            placeholder="e.g. Stockport"
            maxLength={80}
          />
        </Field>
        <Field label="Completed (optional)">
          <input
            type="date"
            value={form.completed_at}
            onChange={(e) => update("completed_at", e.target.value)}
            className="h-11 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-xs text-brand-text focus:border-brand-accent focus:outline-none"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PhotoSlot
          label="Before"
          value={form.before_url}
          onChange={(v) => update("before_url", v)}
        />
        <PhotoSlot
          label="During"
          value={form.during_url}
          onChange={(v) => update("during_url", v)}
        />
        <PhotoSlot
          label="After"
          value={form.after_url}
          onChange={(v) => update("after_url", v)}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="h-11 flex-1 rounded-lg bg-brand-accent px-6 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Saving…" : mode === "create" ? "Save project" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="h-11 flex-1 rounded-lg border border-brand-line bg-brand-surface px-6 text-xs font-semibold text-brand-text transition hover:border-brand-accent disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}

function PhotoSlot({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    setUploading(true);
    try {
      const file = files[0];
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/trade-off/projects/upload", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!body.ok || !body.url) {
        setErr(body.error || "Upload failed.");
        return;
      }
      onChange(body.url);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-brand-text">{label}</span>
      <div className="relative overflow-hidden rounded-lg border border-brand-line bg-brand-surface">
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt={label} className="aspect-square w-full object-cover" />
            <div className="flex items-center justify-between gap-1 border-t border-brand-line bg-neutral-50 p-1">
              <label className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded text-xs text-brand-text hover:bg-brand-bg">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => handleFiles(e.target.files)}
                  disabled={uploading}
                />
                {uploading ? "Uploading…" : "Replace"}
              </label>
              <button
                type="button"
                onClick={() => onChange("")}
                className="h-11 flex-1 rounded text-xs text-brand-text hover:bg-red-900/40"
              >
                Remove
              </button>
            </div>
          </>
        ) : (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 p-4 text-center text-xs text-brand-muted transition hover:border-brand-accent hover:text-brand-accent">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => handleFiles(e.target.files)}
              disabled={uploading}
            />
            <span className="text-2xl">+</span>
            <span>{uploading ? "Uploading…" : `Add ${label.toLowerCase()}`}</span>
          </label>
        )}
      </div>
      {err && <p className="mt-1 text-[11px] text-red-600">{err}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-text">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  maxLength
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="h-11 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-xs text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
    />
  );
}
