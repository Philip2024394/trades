// Homeowner starts a new project on their property.

"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

const LEAF_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "kitchen_full", label: "Kitchen" },
  { key: "bathroom_full", label: "Bathroom" },
  { key: "staircase_full", label: "Staircase" },
  { key: "internal_doors", label: "Internal doors" },
  { key: "flooring_room", label: "Flooring" },
  { key: "driveway_full", label: "Driveway" },
  { key: "garden_fence", label: "Fence" },
  { key: "roof_tiling", label: "Roof" },
  { key: "internal_decorating", label: "Decorating" },
  { key: "loft_ladders", label: "Loft ladder" }
];

export function NewProjectForm({
  propertyId,
  onDone
}: {
  propertyId: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [leafSlug, setLeafSlug] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) {
      setError("Give the project a short name (e.g. 'Kitchen 2026').");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/os/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          propertyId,
          title: title.trim(),
          leafSlug
        })
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error || "Could not create project.");
        return;
      }
      onDone();
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <label className="block text-[13px] font-semibold text-neutral-700">
          Give it a name
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Kitchen 2026"
          required
          className="mt-1 block min-h-[44px] w-full rounded-lg border border-neutral-200 bg-white px-3 text-[14px] outline-none focus:border-neutral-900"
        />
      </div>
      <div>
        <div className="mb-1 text-[13px] font-semibold text-neutral-700">
          What kind of project? (optional)
        </div>
        <div className="flex flex-wrap gap-2">
          {LEAF_OPTIONS.map((l) => {
            const active = leafSlug === l.key;
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => setLeafSlug(active ? null : l.key)}
                className={`inline-flex min-h-[36px] items-center rounded-full border px-3 text-[13px] font-medium transition ${
                  active
                    ? "border-neutral-900 bg-neutral-900 text-[#1B1A17]"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                }`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </div>
      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 text-[14px] font-semibold text-[#1B1A17] transition hover:bg-neutral-800 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Creating…
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" aria-hidden />
            Create project
          </>
        )}
      </button>
    </form>
  );
}
