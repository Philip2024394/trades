// /authors/dashboard — the Author's home screen.
//
// Lists every Brain the Author has drafts for, plus a way to open a
// new module editor. Server component that hits the internal
// /api/authors/brains endpoint via the cookie-authenticated fetch.

import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuthorFromCookie, nexAuthorStudioEnabled } from "@/lib/nex/brains/_studio";

type BrainEntry = { slug: string; name?: string; status?: string; version?: string };

async function fetchBrains(): Promise<BrainEntry[]> {
  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const proto  = h.get("x-forwarded-proto") ?? "http";
  const host   = h.get("host") ?? "localhost:3000";
  const res    = await fetch(`${proto}://${host}/api/authors/brains`, {
    headers: { cookie },
    cache:   "no-store"
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.brains ?? [];
}

export default async function DashboardPage() {
  if (!nexAuthorStudioEnabled()) redirect("/authors");
  const authorId = await getAuthorFromCookie();
  if (!authorId) redirect("/authors");

  const brains = await fetchBrains();

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Your Brains</h1>
        <span className="text-xs text-[#0A0A0A]/60">Author ID: {authorId}</span>
      </div>

      {brains.length === 0 ? (
        <div className="rounded border border-[#0A0A0A]/10 bg-white p-6">
          <p className="text-sm text-[#0A0A0A]/70">
            No Brains assigned yet. When Program Lead assigns you to a Trade Brain,
            it will appear here.
          </p>
          <p className="mt-3 text-xs text-[#0A0A0A]/50">
            If you were told to start with the Staircase Brain, open{" "}
            <Link href="/authors/brains/staircase/extract" className="underline">
              Teach Nex about staircases
            </Link>{" "}
            (paste your experience to start) or{" "}
            <Link href="/authors/brains/staircase/edit" className="underline">
              refine in the editor
            </Link>
            {" "}(type directly).
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {brains.map((b) => (
            <li key={b.slug} className="flex items-center justify-between rounded border border-[#0A0A0A]/10 bg-white p-4">
              <div>
                <div className="text-sm font-semibold">{b.name ?? b.slug}</div>
                <div className="text-xs text-[#0A0A0A]/60">
                  status: {b.status ?? "draft"}
                  {b.version ? ` · v${b.version}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/authors/brains/${b.slug}/extract`}
                  className="rounded bg-[#166534] px-3 py-1.5 text-xs font-medium text-white"
                >
                  Teach Nex
                </Link>
                <Link
                  href={`/authors/brains/${b.slug}/edit`}
                  className="rounded border border-[#0A0A0A]/20 bg-white px-3 py-1.5 text-xs font-medium text-[#0A0A0A]"
                >
                  Refine in editor
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-4 text-xs text-[#0A0A0A]/50">
        <p>
          <strong>Teach Nex</strong> is the primary workflow: paste raw knowledge, notes, voice transcripts or written experience — Nex proposes structured Knowledge Node candidates for you to review per-item.{" "}
          <strong>Refine in editor</strong> is where you polish or add facts directly after teaching runs.
        </p>
        <p className="mt-2">
          Studio drafts are not merchant-visible. When you are ready for review,
          use the &quot;Submit for review&quot; button in the Brain editor.
        </p>
      </div>
    </div>
  );
}
