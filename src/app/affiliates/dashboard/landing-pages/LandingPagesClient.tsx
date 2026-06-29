"use client";

// Client island — list + create + edit + delete landing pages.
import { useState } from "react";

type Page = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  cta_text: string;
  hero_image_url: string | null;
  body_markdown: string | null;
};

type Form = {
  id: string | null;
  slug: string;
  title: string;
  tagline: string;
  cta_text: string;
  hero_image_url: string;
  body_markdown: string;
};

const EMPTY: Form = {
  id: null,
  slug: "",
  title: "",
  tagline: "",
  cta_text: "Join xratedtrade.com",
  hero_image_url: "",
  body_markdown: ""
};

export function LandingPagesClient({
  affiliateId,
  initial
}: {
  affiliateId: number;
  initial: Page[];
}): React.ReactElement {
  const [pages, setPages] = useState<Page[]>(initial);
  const [form, setForm] = useState<Form>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startEdit(p: Page) {
    setForm({
      id: p.id,
      slug: p.slug,
      title: p.title,
      tagline: p.tagline ?? "",
      cta_text: p.cta_text,
      hero_image_url: p.hero_image_url ?? "",
      body_markdown: p.body_markdown ?? ""
    });
    setEditing(true);
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const url = form.id
        ? `/api/affiliates/dashboard/landing-pages/${form.id}`
        : "/api/affiliates/dashboard/landing-pages";
      const method = form.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: form.slug,
          title: form.title,
          tagline: form.tagline,
          cta_text: form.cta_text,
          hero_image_url: form.hero_image_url,
          body_markdown: form.body_markdown
        })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        page?: Page;
        error?: string;
      };
      if (!body.ok || !body.page) {
        setErr(body.error ?? "Could not save.");
        return;
      }
      setPages((prev) =>
        form.id
          ? prev.map((p) => (p.id === form.id ? body.page! : p))
          : [body.page!, ...prev]
      );
      setForm(EMPTY);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this landing page?")) return;
    setBusy(true);
    try {
      await fetch(`/api/affiliates/dashboard/landing-pages/${id}`, {
        method: "DELETE"
      });
      setPages((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-brand-line bg-brand-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
            {editing ? "Edit page" : "Create page"}
          </h2>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setForm(EMPTY);
                setEditing(false);
              }}
              className="text-[13px] font-bold text-brand-muted hover:underline"
            >
              Cancel edit
            </button>
          )}
        </div>
        <form onSubmit={save} className="mt-3 space-y-3 text-[13px]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="font-bold text-brand-text">Slug</span>
              <input
                type="text"
                required
                value={form.slug}
                onChange={(e) =>
                  setForm({
                    ...form,
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]+/g, "-")
                      .slice(0, 40)
                  })
                }
                placeholder="my-page"
                className="mt-1 block h-10 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
              />
            </label>
            <label className="block">
              <span className="font-bold text-brand-text">Title</span>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 block h-10 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
              />
            </label>
          </div>
          <label className="block">
            <span className="font-bold text-brand-text">Tagline</span>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="mt-1 block h-10 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
            />
          </label>
          <label className="block">
            <span className="font-bold text-brand-text">Hero image URL</span>
            <input
              type="url"
              value={form.hero_image_url}
              onChange={(e) =>
                setForm({ ...form, hero_image_url: e.target.value })
              }
              className="mt-1 block h-10 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
            />
          </label>
          <label className="block">
            <span className="font-bold text-brand-text">Body (markdown)</span>
            <textarea
              value={form.body_markdown}
              onChange={(e) =>
                setForm({ ...form, body_markdown: e.target.value })
              }
              rows={6}
              className="mt-1 block w-full rounded-lg border border-brand-line bg-brand-bg px-3 py-2 text-[13px] text-brand-text"
            />
          </label>
          <label className="block">
            <span className="font-bold text-brand-text">CTA text</span>
            <input
              type="text"
              value={form.cta_text}
              onChange={(e) => setForm({ ...form, cta_text: e.target.value })}
              className="mt-1 block h-10 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
            />
          </label>
          {err && <p className="text-[13px] font-semibold text-red-500">{err}</p>}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-accent px-4 text-[13px] font-bold text-black disabled:opacity-60"
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Create page"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        {pages.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-brand-line bg-brand-surface p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-brand-text">{p.title}</p>
                <a
                  href={`/affiliates/by/${affiliateId}/${p.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-brand-accent hover:underline"
                >
                  /affiliates/by/{affiliateId}/{p.slug}
                </a>
                {p.tagline && (
                  <p className="mt-1 text-[13px] text-brand-muted">{p.tagline}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="rounded-lg border border-brand-line bg-brand-bg px-2 py-1 text-[13px] font-bold text-brand-text hover:bg-brand-line"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  className="rounded-lg border border-brand-line bg-brand-bg px-2 py-1 text-[13px] font-bold text-red-400 hover:bg-brand-line"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {pages.length === 0 && (
          <p className="text-[13px] text-brand-muted">
            No landing pages yet. Create one above.
          </p>
        )}
      </section>
    </div>
  );
}
