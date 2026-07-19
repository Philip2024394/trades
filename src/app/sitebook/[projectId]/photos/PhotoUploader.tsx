"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PhotoStage } from "@/lib/homeowners/types";

const BRAND_GREEN = "#166534";

export function PhotoUploader({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [file, setFile]       = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [stage, setStage]     = useState<PhotoStage | "">("");
  const [status, setStatus]   = useState<"idle" | "uploading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setStatus("uploading");
    setMessage("");
    const form = new FormData();
    form.append("file", file);
    if (caption) form.append("caption", caption);
    if (stage)   form.append("stage", stage);
    const res = await fetch(`/api/homeowner/projects/${projectId}/photos`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setStatus("error");
      setMessage(data.error || "Upload failed. Try again.");
      return;
    }
    setFile(null);
    setCaption("");
    setStage("");
    setStatus("idle");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="block w-full text-[12px] text-neutral-700 file:mr-3 file:rounded-md file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-[11px] file:font-black file:uppercase file:tracking-wider file:text-neutral-700"
      />
      <input
        type="text"
        placeholder="Caption (optional)"
        value={caption}
        maxLength={300}
        onChange={(e) => setCaption(e.target.value)}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-[12.5px] outline-none focus:ring-2 focus:ring-yellow-400"
      />
      <div className="flex flex-wrap gap-1.5">
        {(["before", "in-progress", "after"] as PhotoStage[]).map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => setStage(stage === s ? "" : s)}
            className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider transition ${
              stage === s ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {status === "error" && (
        <p className="rounded-md bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-800">{message}</p>
      )}
      <button
        type="submit"
        disabled={!file || status === "uploading"}
        className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-60"
        style={{ backgroundColor: BRAND_GREEN }}
      >
        {status === "uploading" ? "Uploading…" : "Upload photo →"}
      </button>
    </form>
  );
}
