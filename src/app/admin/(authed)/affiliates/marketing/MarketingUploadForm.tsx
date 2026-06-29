"use client";

// Multipart upload form for the affiliate marketing pack. Posts to
// /api/admin/affiliates/marketing (POST). On success it triggers a hard
// reload so the table re-renders server-side.
import { useState } from "react";

const KINDS = [
  "banner",
  "story",
  "social_post",
  "logo",
  "qr",
  "image",
  "video",
  "pdf"
];

export function MarketingUploadForm() {
  const [kind, setKind] = useState("banner");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [featured, setFeatured] = useState(false);
  const [requiredLevel, setRequiredLevel] = useState("bronze");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    if (!file) {
      setErr("Choose a file.");
      return;
    }
    if (!title.trim()) {
      setErr("Title is required.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      fd.append("featured", featured ? "1" : "0");
      fd.append("required_level", requiredLevel);
      fd.append("file", file);
      const res = await fetch("/api/admin/affiliates/marketing", {
        method: "POST",
        body: fd
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!body.ok) {
        setErr(body.error || "Upload failed.");
        return;
      }
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 sm:grid-cols-2"
      encType="multipart/form-data"
    >
      <label className="block sm:col-span-1">
        <span className="text-[13px] font-bold text-brand-text">Kind</span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="mt-1 block h-11 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-1">
        <span className="text-[13px] font-bold text-brand-text">Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="mt-1 block h-11 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="text-[13px] font-bold text-brand-text">
          Description (optional)
        </span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block h-11 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="text-[13px] font-bold text-brand-text">File</span>
        <input
          type="file"
          accept="image/*,video/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          className="mt-1 block w-full rounded-lg border border-brand-line bg-brand-bg p-2 text-[13px] text-brand-text file:mr-3 file:rounded file:border-0 file:bg-brand-accent file:px-3 file:py-1.5 file:font-bold file:text-black"
        />
        <span className="mt-1 block text-[13px] text-brand-muted">
          Max 50 MB. PDFs, mp4/mov/webm videos, png/jpg/webp/gif/svg images.
        </span>
      </label>
      <label className="block sm:col-span-1">
        <span className="text-[13px] font-bold text-brand-text">
          Minimum level
        </span>
        <select
          value={requiredLevel}
          onChange={(e) => setRequiredLevel(e.target.value)}
          className="mt-1 block h-11 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
        >
          <option value="bronze">Bronze (everyone)</option>
          <option value="silver">Silver+</option>
          <option value="gold">Gold+</option>
          <option value="platinum">Platinum only</option>
        </select>
      </label>
      <label className="flex items-center gap-2 sm:col-span-2">
        <input
          type="checkbox"
          checked={featured}
          onChange={(e) => setFeatured(e.target.checked)}
        />
        <span className="text-[13px] text-brand-text">
          Featured (shows first in affiliate dashboard)
        </span>
      </label>
      {err && (
        <p className="sm:col-span-2 text-[13px] font-semibold text-red-500">
          {err}
        </p>
      )}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-accent px-4 text-[13px] font-bold text-black hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}
