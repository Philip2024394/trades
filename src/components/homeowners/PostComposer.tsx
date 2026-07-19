"use client";

// PostComposer — the homeowner's "what's happening?" input at the top
// of /sitebook. Post lives inside a project + optionally scopes to
// specific trades. On submit, POSTs to /api/homeowner/posts and
// refreshes the feed.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Image as ImageIcon, Hammer, Users, ChevronDown, X } from "lucide-react";
import type { PostKind, PostVisibility } from "@/lib/homeowners/types";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

export type ComposerProject = { id: string; title: string };
export type ComposerTrade   = { listingId: string; name: string; tradeType: string | null };

export function PostComposer({
  authorInitial,
  projects,
  trades
}: {
  authorInitial: string;
  projects:      ComposerProject[];
  trades:        ComposerTrade[];
}) {
  const router = useRouter();
  const [expanded, setExpanded]         = useState(false);
  const [title, setTitle]               = useState("");
  const [body, setBody]                 = useState("");
  const [projectId, setProjectId]       = useState(projects[0]?.id ?? "");
  const [kind, setKind]                 = useState<PostKind>("update");
  const [visibility, setVisibility]     = useState<PostVisibility>("all-trades");
  const [invited, setInvited]           = useState<string[]>([]);
  const [status, setStatus]             = useState<"idle" | "sending" | "error">("idle");
  const [errorMsg, setErrorMsg]         = useState("");

  const canSubmit = body.trim().length > 0 && projectId && status !== "sending";

  function toggleTrade(id: string) {
    setInvited((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("sending");
    setErrorMsg("");
    const res = await fetch("/api/homeowner/posts", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        projectId,
        title:             title.trim() || undefined,
        body:              body.trim(),
        kind,
        visibility,
        invitedListingIds: visibility === "selected" ? invited : []
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setStatus("error");
      setErrorMsg(data.error === "missing-invitees" ? "Pick at least one trade to invite." : "Failed to post. Try again.");
      return;
    }
    // Reset + collapse + refresh
    setTitle("");
    setBody("");
    setInvited([]);
    setExpanded(false);
    setStatus("idle");
    router.refresh();
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border-2 bg-white p-5 text-center shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        <p className="text-[13px] font-black text-neutral-900">Create a project first</p>
        <p className="mt-1 text-[11.5px] text-neutral-600">Posts live inside projects. Head to your SiteBook overview to add one.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-black text-neutral-900" style={{ backgroundColor: BRAND_YELLOW }}>
          {authorInitial}
        </span>
        <div className="flex-1">
          {expanded && (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
              placeholder="Title (optional)"
              className="mb-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[13px] font-black text-neutral-900 outline-none placeholder:font-normal placeholder:text-neutral-400 focus:border-neutral-400"
            />
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => setExpanded(true)}
            rows={expanded ? 3 : 1}
            placeholder="What's happening on your project today?"
            className="w-full resize-none rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-[13px] outline-none focus:border-neutral-400 focus:bg-white"
          />

          {expanded && (
            <div className="mt-3 space-y-3 border-t border-neutral-100 pt-3">
              {/* Project + kind */}
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider text-neutral-500">
                    <Hammer size={10}/> Project
                  </span>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-neutral-400"
                  >
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider text-neutral-500">
                    <ChevronDown size={10}/> Kind
                  </span>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as PostKind)}
                    className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-neutral-400"
                  >
                    <option value="update">Update</option>
                    <option value="new-work">New work request</option>
                    <option value="question">Question</option>
                    <option value="completion">Completion</option>
                    <option value="warranty">Warranty</option>
                  </select>
                </label>
              </div>

              {/* Visibility toggle */}
              <div>
                <span className="mb-1 flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider text-neutral-500">
                  <Users size={10}/> Visible to
                </span>
                <div className="inline-flex items-center rounded-full bg-neutral-100 p-0.5 text-[10.5px] font-black uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => setVisibility("all-trades")}
                    className={`rounded-full px-3 py-1 ${visibility === "all-trades" ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-500"}`}
                  >
                    All trades on project
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility("selected")}
                    className={`rounded-full px-3 py-1 ${visibility === "selected" ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-500"}`}
                  >
                    Selected trades
                  </button>
                </div>
              </div>

              {/* Trade selector — only when visibility='selected' */}
              {visibility === "selected" && (
                <div>
                  <p className="mb-1 text-[9.5px] font-black uppercase tracking-wider text-neutral-500">
                    Invite trades ({invited.length} selected)
                  </p>
                  {trades.length === 0 ? (
                    <p className="rounded-md bg-neutral-50 px-3 py-2 text-[11px] text-neutral-500">
                      No trades on your team yet. Invite one first, then come back.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {trades.map((t) => {
                        const active = invited.includes(t.listingId);
                        return (
                          <button
                            type="button"
                            key={t.listingId}
                            onClick={() => toggleTrade(t.listingId)}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${active ? "text-neutral-900 shadow-sm" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"}`}
                            style={active ? { backgroundColor: BRAND_YELLOW, borderColor: BRAND_YELLOW } : {}}
                          >
                            {active && <X size={9}/>}
                            {t.name}
                            <span className="text-[9px] text-neutral-500">{t.tradeType || ""}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {status === "error" && errorMsg && (
                <p className="rounded-md bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-800">{errorMsg}</p>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {expanded && (
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Photo upload — TODO (endpoint exists at /api/homeowner/projects/[id]/photos)"
                className="inline-flex h-8 items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-500"
              >
                <ImageIcon size={11}/> Photos (soon)
              </button>
            )}
            {expanded && (
              <button
                type="button"
                onClick={() => { setExpanded(false); setBody(""); setTitle(""); setInvited([]); }}
                className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!canSubmit}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-95 disabled:opacity-40"
              style={{ backgroundColor: BRAND_GREEN }}
            >
              {status === "sending" ? "Posting…" : <>Post <Send size={11}/></>}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
