"use client";

// src/app/nex-native/manage/site/[siteId]/_inline-edit.tsx
// Wave D Slice 16e · Client Component that upgrades a plain text field into a
// click-to-edit input. Doctrine-safe: all writes go through the Server Action.
// This component is presentational only · Engine 1 semantics owned by the
// server (site-service.updateSiteField).

import { useState, useRef, useEffect } from "react";

interface InlineEditProps {
  siteId: string;
  field: "hero_headline" | "hero_subline" | "cta_label";
  initial: string;
  actionUrl?: string;   // defaults to the current page · form action wraps the Server Action
  label?: string;
  multiline?: boolean;
  submit: (formData: FormData) => Promise<void>;
}

export function InlineTextEdit({
  siteId, field, initial, label, multiline = false, submit,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => { setValue(initial); }, [initial]);
  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  async function commit(next: string) {
    setPending(true);
    const fd = new FormData();
    fd.set("site_id", siteId);
    fd.set("field", field);
    fd.set("value", next);
    try {
      await submit(fd);
    } finally {
      setPending(false);
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group flex w-full items-baseline gap-2 rounded border border-dashed border-neutral-300 bg-neutral-50/50 px-3 py-2 text-left hover:border-neutral-500 hover:bg-neutral-100"
        aria-label={`Edit ${label ?? field}`}
      >
        {label && <span className="shrink-0 text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>}
        <span className="min-w-0 flex-1 truncate text-sm text-neutral-900">{value}</span>
        <span className="shrink-0 text-[10px] text-neutral-400 group-hover:text-neutral-700">click to edit</span>
      </button>
    );
  }

  const Tag = (multiline ? "textarea" : "input") as "textarea";
  return (
    <form
      action={commit.bind(null, value)}
      onSubmit={(e) => { e.preventDefault(); void commit(value); }}
      className="flex items-center gap-2"
    >
      <Tag
        // @ts-expect-error union ref type
        ref={inputRef}
        name="value"
        rows={multiline ? 3 : undefined}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void commit(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !multiline) { e.preventDefault(); void commit(value); }
          if (e.key === "Escape") { setValue(initial); setEditing(false); }
        }}
        disabled={pending}
        maxLength={240}
        className="min-w-0 flex-1 rounded border border-neutral-500 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-neutral-400"
      />
      <span className="text-[10px] text-neutral-500">enter to save · esc to cancel</span>
    </form>
  );
}
