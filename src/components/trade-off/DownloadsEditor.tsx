"use client";

// DownloadsEditor — file CRUD for the Downloads add-on. Two tabs:
//   Files          → upload, edit metadata, archive, drag-reorder
//   Captured emails → leads collected from email-gated downloads
//
// File upload reuses /api/trade-off/downloads/upload (10 MB cap,
// PDF / Word / Excel / image only, server-side MIME + extension sniff).
// Drag-reorder uses dnd-kit with a 250 ms touch activation delay
// matching ShopModeEditor.

import { useEffect, useRef, useState } from "react";
import type { HammerexXratedDownload } from "@/lib/supabase";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DownloadsLeadsTable } from "./DownloadsLeadsTable";

const CATEGORIES: HammerexXratedDownload["category"][] = [
  "brochure",
  "form",
  "compliance",
  "catalogue",
  "qualification",
  "other"
];

const CATEGORY_LABEL: Record<HammerexXratedDownload["category"], string> = {
  brochure: "Brochure",
  form: "Form",
  compliance: "Compliance",
  catalogue: "Catalogue",
  qualification: "Qualification",
  other: "Other"
};

const ACCEPT_EXTS = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png";
const MAX_LIVE = 20;
const WARN_AT = 17;

type EditForm = {
  id: string;
  name: string;
  description: string;
  category: HammerexXratedDownload["category"];
  requires_email: boolean;
  status: "live" | "archived";
};

function emptyEdit(): EditForm {
  return {
    id: "",
    name: "",
    description: "",
    category: "other",
    requires_email: false,
    status: "live"
  };
}

function rowToEdit(d: HammerexXratedDownload): EditForm {
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? "",
    category: d.category,
    requires_email: d.requires_email,
    status: d.status
  };
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

function useDragSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

export function DownloadsEditor({
  slug,
  editToken,
  initialDownloads
}: {
  slug: string;
  editToken: string;
  initialDownloads: HammerexXratedDownload[];
}) {
  const [tab, setTab] = useState<"files" | "leads">("files");
  const [downloads, setDownloads] = useState<HammerexXratedDownload[]>(initialDownloads);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  // PII disclaimer must be acknowledged before each upload session
  // (one tick lets multiple uploads through without re-prompting).
  const [piiAck, setPiiAck] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const liveCount = downloads.filter((d) => d.status === "live").length;
  const atCap = liveCount >= MAX_LIVE;
  const nearCap = liveCount >= WARN_AT && liveCount < MAX_LIVE;

  async function handleUpload(file: File) {
    setErr(null);
    setMsg(null);
    if (atCap) {
      setErr(`Cap reached — ${MAX_LIVE} live files. Archive one first.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErr("File exceeds 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", slug);
      fd.append("edit_token", editToken);
      const upRes = await fetch("/api/trade-off/downloads/upload", {
        method: "POST",
        body: fd
      });
      const upJson = await upRes.json();
      if (!upJson.ok || !upJson.url) {
        setErr(upJson.error ?? "Upload failed.");
        return;
      }

      // Persist the row with a sensible default name (file name without ext).
      const baseName = file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "Untitled file";
      const upsertRes = await fetch("/api/trade-off/downloads/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          download: {
            name: baseName,
            description: "",
            file_url: upJson.url,
            file_type: upJson.file_type,
            file_size_bytes: upJson.size_bytes,
            category: "other",
            requires_email: false,
            status: "live",
            sort_order: downloads.length * 10
          }
        })
      });
      const upsertJson = await upsertRes.json();
      if (!upsertJson.ok) {
        setErr(upsertJson.error ?? "Save failed.");
        return;
      }
      const saved = upsertJson.download as HammerexXratedDownload;
      setDownloads((prev) => [...prev, saved]);
      setMsg("Uploaded. Edit the details to customise the title and category.");
      // Open the edit drawer for the new file so the tradesperson can
      // immediately set name + category + email gate.
      setEdit(rowToEdit(saved));
    } catch {
      setErr("Network error during upload.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveEdit() {
    if (!edit) return;
    setErr(null);
    setMsg(null);
    const trimmedName = edit.name.trim();
    if (!trimmedName) {
      setErr("Name is required.");
      return;
    }
    const target = downloads.find((d) => d.id === edit.id);
    if (!target) {
      setErr("Source file not found — refresh the page.");
      return;
    }
    setSavingId(edit.id);
    try {
      const res = await fetch("/api/trade-off/downloads/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          download: {
            id: edit.id,
            name: trimmedName.slice(0, 120),
            description: edit.description.trim().slice(0, 1000),
            file_url: target.file_url,
            file_type: target.file_type,
            file_size_bytes: target.file_size_bytes,
            category: edit.category,
            requires_email: edit.requires_email,
            status: edit.status,
            sort_order: target.sort_order
          }
        })
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Save failed.");
        return;
      }
      const saved = json.download as HammerexXratedDownload;
      setDownloads((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
      setMsg("Updated.");
      setEdit(null);
    } catch {
      setErr("Network error — try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function archive(d: HammerexXratedDownload) {
    if (!confirm(`Archive "${d.name}"? Customers won't see it any more.`)) return;
    setErr(null);
    try {
      const res = await fetch("/api/trade-off/downloads/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          download_id: d.id
        })
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Archive failed.");
        return;
      }
      setDownloads((prev) =>
        prev.map((x) => (x.id === d.id ? { ...x, status: "archived" } : x))
      );
    } catch {
      setErr("Network error — try again.");
    }
  }

  // Reorder — local-first, debounced POST. Mirrors ShopModeEditor.
  const reorderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (reorderTimeoutRef.current) clearTimeout(reorderTimeoutRef.current);
    };
  }, []);

  function applyReorder(next: HammerexXratedDownload[], snapshot: HammerexXratedDownload[]) {
    setDownloads(next);
    if (reorderTimeoutRef.current) clearTimeout(reorderTimeoutRef.current);
    reorderTimeoutRef.current = setTimeout(async () => {
      const ordering = next.map((d, idx) => ({
        id: d.id,
        sort_order: (idx + 1) * 10
      }));
      try {
        const res = await fetch("/api/trade-off/downloads/reorder", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, edit_token: editToken, ordering })
        });
        const json = await res.json();
        if (!json.ok) {
          setDownloads(snapshot);
          setErr(json.error ?? "Reorder failed — restored previous order.");
        }
      } catch {
        setDownloads(snapshot);
        setErr("Network error — restored previous order.");
      }
    }, 500);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-brand-line">
        <TabButton
          label="Files"
          active={tab === "files"}
          onClick={() => setTab("files")}
        />
        <TabButton
          label="Captured emails"
          active={tab === "leads"}
          onClick={() => setTab("leads")}
        />
      </div>

      {tab === "files" ? (
        <div className="space-y-4 rounded-xl border border-brand-line bg-brand-surface p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold">Your files</h2>
              <p className="mt-1 text-[13px] text-brand-muted">
                {liveCount} live &middot; {downloads.length - liveCount} archived
                &middot; cap {MAX_LIVE}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex h-11 items-center gap-2 rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] font-bold text-brand-text">
                <input
                  type="checkbox"
                  checked={piiAck}
                  onChange={(e) => setPiiAck(e.target.checked)}
                  className="h-5 w-5 accent-brand-accent"
                />
                <span>No customer data inside</span>
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || atCap || !piiAck}
                className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "+ Upload file"}
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_EXTS}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
            }}
          />

          {!piiAck && (
            <p className="rounded-lg border border-brand-line bg-brand-bg px-3 py-2 text-[13px] text-brand-muted">
              Tick the box to confirm there&rsquo;s no customer data or
              sensitive information in the file you&rsquo;re about to upload.
            </p>
          )}
          {nearCap && (
            <p className="rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-[13px] font-semibold text-brand-accent">
              You&rsquo;re close to the {MAX_LIVE}-file cap ({liveCount}/{MAX_LIVE}).
              Archive older files to make room.
            </p>
          )}
          {atCap && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-300">
              Cap reached ({MAX_LIVE}/{MAX_LIVE}). Archive a file before uploading more.
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

          <FileList
            downloads={downloads}
            onEdit={(d) => setEdit(rowToEdit(d))}
            onArchive={archive}
            onReorder={applyReorder}
          />

          {edit && (
            <EditDrawer
              form={edit}
              update={(patch) => setEdit({ ...edit, ...patch })}
              busy={savingId === edit.id}
              onCancel={() => setEdit(null)}
              onSave={saveEdit}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-brand-line bg-brand-surface p-5">
          <div>
            <h2 className="text-lg font-extrabold">Captured emails</h2>
            <p className="mt-1 text-[13px] text-brand-muted">
              Customers who downloaded an email-gated file appear here.
            </p>
          </div>
          <DownloadsLeadsTable slug={slug} editToken={editToken} />
        </div>
      )}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative inline-flex h-11 items-center px-3 text-[13px] font-extrabold uppercase tracking-wider transition"
      style={{ color: active ? "#FFB300" : "#737373" }}
    >
      {label}
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 -bottom-px h-[3px] rounded-t-full"
          style={{ background: "#FFB300" }}
        />
      )}
    </button>
  );
}

function FileList({
  downloads,
  onEdit,
  onArchive,
  onReorder
}: {
  downloads: HammerexXratedDownload[];
  onEdit: (d: HammerexXratedDownload) => void;
  onArchive: (d: HammerexXratedDownload) => void;
  onReorder: (
    next: HammerexXratedDownload[],
    snapshot: HammerexXratedDownload[]
  ) => void;
}) {
  const sensors = useDragSensors();

  if (downloads.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-brand-line bg-brand-bg px-4 py-6 text-center text-[13px] text-brand-muted">
        No files yet. Tap &ldquo;+ Upload file&rdquo; to add your first
        brochure or form.
      </p>
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = downloads.findIndex((d) => d.id === active.id);
    const newIndex = downloads.findIndex((d) => d.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(downloads, oldIndex, newIndex), downloads);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={downloads.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-2">
          {downloads.map((d) => (
            <SortableFileRow
              key={d.id}
              download={d}
              onEdit={onEdit}
              onArchive={onArchive}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableFileRow({
  download,
  onEdit,
  onArchive
}: {
  download: HammerexXratedDownload;
  onEdit: (d: HammerexXratedDownload) => void;
  onArchive: (d: HammerexXratedDownload) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: download.id
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-line bg-brand-bg p-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="inline-flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md border border-brand-line bg-brand-surface text-brand-muted transition hover:border-brand-accent hover:text-brand-accent active:cursor-grabbing"
      >
        <DragHandleIcon />
      </button>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-brand-line bg-brand-surface text-[10px] font-bold uppercase tracking-widest text-brand-muted">
        {download.file_type}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-brand-text">{download.name}</p>
        <p className="text-[13px] text-brand-muted">
          {CATEGORY_LABEL[download.category]} &middot; {formatBytes(download.file_size_bytes) || "—"}
          {download.requires_email ? " · Email gated" : ""}
        </p>
      </div>
      <span className="inline-flex items-center rounded-full border border-brand-line bg-brand-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-text">
        {download.download_count} downloads
      </span>
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
          download.status === "live"
            ? "border-brand-accent/60 bg-brand-accent/10 text-brand-accent"
            : "border-brand-line bg-brand-surface text-brand-muted"
        }`}
      >
        {download.status}
      </span>
      <div className="flex w-full gap-2 sm:w-auto">
        <button
          type="button"
          onClick={() => onEdit(download)}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent sm:flex-none"
        >
          Edit
        </button>
        {download.status === "live" && (
          <button
            type="button"
            onClick={() => onArchive(download)}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/5 px-3 text-xs font-bold text-red-300 transition hover:bg-red-500/15 sm:flex-none"
          >
            Archive
          </button>
        )}
      </div>
    </li>
  );
}

function DragHandleIcon() {
  return (
    <svg
      width="14"
      height="20"
      viewBox="0 0 8 14"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="1.5" cy="2" r="1.2" />
      <circle cx="6.5" cy="2" r="1.2" />
      <circle cx="1.5" cy="7" r="1.2" />
      <circle cx="6.5" cy="7" r="1.2" />
      <circle cx="1.5" cy="12" r="1.2" />
      <circle cx="6.5" cy="12" r="1.2" />
    </svg>
  );
}

function EditDrawer({
  form,
  update,
  busy,
  onCancel,
  onSave
}: {
  form: EditForm;
  update: (patch: Partial<EditForm>) => void;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-brand-line bg-brand-bg p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-extrabold uppercase tracking-widest text-brand-accent">
          Edit file
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-md px-2 text-xs font-bold text-brand-muted transition hover:text-brand-text"
        >
          Cancel
        </button>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
          Name *
        </span>
        <input
          type="text"
          value={form.name}
          maxLength={120}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Skim coat product catalogue 2026"
          className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
          Description
        </span>
        <textarea
          value={form.description}
          maxLength={1000}
          onChange={(e) => update({ description: e.target.value })}
          rows={3}
          placeholder="A short blurb to help customers know what this is."
          className="block w-full rounded-md border border-brand-line bg-brand-surface px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-accent"
        />
        <p className="mt-1 text-[10px] uppercase tracking-widest text-brand-muted">
          {form.description.length}/1000
        </p>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
          Category
        </span>
        <select
          value={form.category}
          onChange={(e) =>
            update({
              category: e.target.value as HammerexXratedDownload["category"]
            })
          }
          className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-start gap-3 rounded-md border border-brand-line bg-brand-surface p-3">
        <input
          type="checkbox"
          checked={form.requires_email}
          onChange={(e) => update({ requires_email: e.target.checked })}
          className="mt-0.5 h-5 w-5 accent-brand-accent"
        />
        <span className="flex-1">
          <span className="block text-[13px] font-bold text-brand-text">
            Email-gate this file
          </span>
          <span className="mt-1 block text-[13px] text-brand-muted">
            Customers enter their email before downloading. Email-gating
            reduces downloads ~40% &mdash; use sparingly for high-value docs.
          </span>
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
          Status
        </span>
        <select
          value={form.status}
          onChange={(e) =>
            update({
              status: e.target.value === "archived" ? "archived" : "live"
            })
          }
          className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
        >
          <option value="live">Live (visible to customers)</option>
          <option value="archived">Archived (hidden)</option>
        </select>
      </label>

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-5 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save changes"}
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
  );
}
