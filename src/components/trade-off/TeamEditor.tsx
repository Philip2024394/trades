"use client";

// TeamEditor — drag-reorderable team list. First row is the Boss,
// visually tagged. Per row: avatar upload OR paste URL, name, role,
// years experience, comma-separated skills (max 5), optional direct
// dial phone. Save persists the full array.

import { useState } from "react";

type Member = {
  name: string;
  role: string;
  years_experience: number | null;
  avatar_url: string | null;
  skills: string[];
  direct_phone: string | null;
  direct_extension: string | null;
};

function empty(): Member {
  return {
    name: "",
    role: "",
    years_experience: null,
    avatar_url: null,
    skills: [],
    direct_phone: null,
    direct_extension: null
  };
}

export function TeamEditor({
  slug,
  token,
  initial
}: {
  slug: string;
  token: string;
  initial: Member[];
}) {
  const [members, setMembers] = useState<Member[]>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  function update(idx: number, patch: Partial<Member>) {
    setMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  }
  function remove(idx: number) {
    if (!confirm("Remove this team member?")) return;
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  }
  function add() {
    setMembers((prev) => [...prev, empty()]);
  }
  function onDragStart(idx: number) {
    return () => setDragIdx(idx);
  }
  function onDragOver(idx: number) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      if (dragIdx === null || dragIdx === idx) return;
      setMembers((prev) => {
        const copy = prev.slice();
        const [moved] = copy.splice(dragIdx, 1);
        copy.splice(idx, 0, moved);
        return copy;
      });
      setDragIdx(idx);
    };
  }
  function onDragEnd() {
    setDragIdx(null);
  }

  async function uploadAvatar(idx: number, file: File) {
    setUploadingIdx(idx);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/trade-off/upload-photo", { method: "POST", body: form });
      const j = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !j.ok || !j.url) {
        setToast(j.error ?? "Upload failed");
        return;
      }
      update(idx, { avatar_url: j.url });
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setUploadingIdx(null);
      window.setTimeout(() => setToast(null), 2500);
    }
  }

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/trade-off/team/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, token, members })
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; members?: Member[] };
      if (!res.ok || !j.ok) {
        setToast(j.error ?? "Save failed");
      } else {
        setToast("Saved.");
        if (j.members) setMembers(j.members);
      }
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSaving(false);
      window.setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4 px-4 pb-24">
      {members.length === 0 && (
        <p className="rounded-2xl border border-dashed border-brand-line bg-brand-surface p-6 text-center text-[13px] text-brand-muted">
          No team yet. Tap &ldquo;Add member&rdquo; below. Your first entry is the Boss.
        </p>
      )}

      <ul className="space-y-3">
        {members.map((m, idx) => {
          const skillsCsv = m.skills.join(", ");
          return (
            <li
              key={idx}
              draggable
              onDragStart={onDragStart(idx)}
              onDragOver={onDragOver(idx)}
              onDragEnd={onDragEnd}
              className="rounded-2xl border border-brand-line bg-brand-surface p-4"
              style={{ opacity: dragIdx === idx ? 0.5 : 1 }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="cursor-grab select-none px-1 text-[16px] text-brand-muted"
                  aria-label="Drag to reorder"
                  title="Drag to reorder"
                >
                  ⋮⋮
                </span>

                <span
                  className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-brand-line bg-brand-bg"
                  aria-hidden="true"
                >
                  {m.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
                      No img
                    </span>
                  )}
                </span>

                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {idx === 0 && (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
                        style={{ background: "#FFB300", color: "#0A0A0A" }}
                      >
                        Boss
                      </span>
                    )}
                    <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-brand-line bg-brand-bg px-2 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted transition hover:border-brand-accent hover:text-brand-text">
                      {uploadingIdx === idx ? "…" : "Upload avatar"}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadAvatar(idx, f);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="ml-auto text-[10px] font-extrabold uppercase tracking-widest text-red-500 transition hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted">Name</span>
                      <input
                        type="text"
                        value={m.name}
                        onChange={(e) => update(idx, { name: e.target.value })}
                        className="mt-1 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] font-bold text-brand-text outline-none focus:border-brand-accent"
                        placeholder="e.g. Sarah Kingsley"
                        maxLength={80}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted">Role / position</span>
                      <input
                        type="text"
                        value={m.role}
                        onChange={(e) => update(idx, { role: e.target.value })}
                        className="mt-1 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
                        placeholder="e.g. Yard Manager"
                        maxLength={80}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted">Years of experience</span>
                      <input
                        type="number"
                        min={0}
                        max={80}
                        value={m.years_experience ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          update(idx, { years_experience: v === "" ? null : Number(v) });
                        }}
                        className="mt-1 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                        Direct dial (optional)
                      </span>
                      <div className="mt-1 flex gap-1.5">
                        <input
                          type="tel"
                          value={m.direct_phone ?? ""}
                          onChange={(e) => update(idx, { direct_phone: e.target.value.trim() || null })}
                          className="h-10 flex-1 rounded-md border border-brand-line bg-brand-bg px-3 font-mono text-[12px] text-brand-text outline-none focus:border-brand-accent"
                          placeholder="+44 1482 555 0100"
                          maxLength={40}
                          aria-label="Direct phone number"
                        />
                        <input
                          type="text"
                          value={m.direct_extension ?? ""}
                          onChange={(e) => update(idx, { direct_extension: e.target.value.replace(/\D/g, "").slice(0, 10) || null })}
                          className="h-10 w-20 rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[12px] text-brand-text outline-none focus:border-brand-accent"
                          placeholder="ext"
                          maxLength={10}
                          aria-label="Extension number (optional)"
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-brand-muted">
                        Phone only, or phone + extension. Extension auto-dials after connection using the dialler pause standard.
                      </p>
                    </label>
                  </div>

                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                      Skills (comma-separated, max 5)
                    </span>
                    <input
                      type="text"
                      value={skillsCsv}
                      onChange={(e) => {
                        const arr = e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0)
                          .slice(0, 5);
                        update(idx, { skills: arr });
                      }}
                      className="mt-1 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
                      placeholder="e.g. Bulk order specialist, Trade account setup"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                      Avatar URL (or use Upload above)
                    </span>
                    <input
                      type="url"
                      value={m.avatar_url ?? ""}
                      onChange={(e) => update(idx, { avatar_url: e.target.value.trim() || null })}
                      className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-3 font-mono text-[11px] text-brand-text outline-none focus:border-brand-accent"
                      placeholder="https://…"
                    />
                  </label>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={add}
        disabled={members.length >= 10}
        className="inline-flex h-11 items-center rounded-xl border-2 border-dashed border-brand-line px-4 text-[12px] font-extrabold uppercase tracking-widest text-brand-muted transition hover:border-brand-accent hover:text-brand-text disabled:opacity-40"
      >
        + Add member {members.length >= 10 && "(max 10)"}
      </button>

      <div className="flex items-center gap-3 border-t border-brand-line pt-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-12 items-center rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 disabled:opacity-60"
          style={{ background: "#FFB300" }}
        >
          {saving ? "Saving…" : "Save team"}
        </button>
        {toast && <p className="text-[12px] font-bold text-brand-muted">{toast}</p>}
      </div>
    </section>
  );
}
