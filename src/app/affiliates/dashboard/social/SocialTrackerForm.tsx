"use client";

import { useState } from "react";

type SocialLink = {
  id: string;
  platform: string;
  url: string;
  status: string;
  last_checked_at: string | null;
  created_at: string;
};

const PLATFORMS = [
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "linkedin",
  "pinterest",
  "x",
  "website",
  "other"
] as const;

export function SocialTrackerForm({
  initialLinks
}: {
  initialLinks: SocialLink[];
}) {
  const [links, setLinks] = useState<SocialLink[]>(initialLinks);
  const [platform, setPlatform] = useState<string>("instagram");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliates/social-links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform, url })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        link?: SocialLink;
        error?: string;
      };
      if (!body.ok || !body.link) {
        setErr(body.error || "Could not save the link.");
        return;
      }
      setLinks((prev) => [body.link!, ...prev]);
      setUrl("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    setErr(null);
    try {
      const res = await fetch(`/api/affiliates/social-links/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        setErr("Could not delete the link.");
        return;
      }
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="rounded-xl border border-brand-line bg-brand-surface p-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr_auto]">
          <label className="block">
            <span className="text-[13px] font-bold text-brand-text">
              Platform
            </span>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[13px] font-bold text-brand-text">URL</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="https://…"
              className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="mt-7 inline-flex h-12 items-center justify-center rounded-xl bg-brand-accent px-4 text-[13px] font-bold text-black hover:opacity-90 disabled:opacity-60 sm:mt-7"
          >
            {submitting ? "Saving…" : "Add link"}
          </button>
        </div>
        {err && (
          <p className="mt-3 text-[13px] font-semibold text-red-500">{err}</p>
        )}
      </form>

      <div className="overflow-x-auto rounded-xl border border-brand-line bg-brand-surface">
        <table className="min-w-full text-[13px]">
          <thead className="bg-brand-bg/40 text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-3 py-2">Platform</th>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last checked</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id} className="border-t border-brand-line">
                <td className="px-3 py-2 font-bold">{l.platform}</td>
                <td className="px-3 py-2 break-all">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-accent hover:underline"
                  >
                    {l.url}
                  </a>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[13px] font-bold ${
                      l.status === "active"
                        ? "bg-green-900/40 text-green-400"
                        : "bg-red-900/40 text-red-400"
                    }`}
                  >
                    {l.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-brand-muted">
                  {l.last_checked_at
                    ? new Date(l.last_checked_at).toLocaleDateString("en-GB")
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(l.id)}
                    className="text-[13px] font-semibold text-red-400 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {links.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-brand-muted"
                >
                  No links saved yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
