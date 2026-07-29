// /admin/brains/[slug]/drafts — Draft Workspace
//
// Client component. The authoring pipeline lives here:
// create → edit modules → submit for review → reviewer approve/reject/
// request changes → publish new immutable version → optionally roll back.
//
// Dev-mode auth: actor identity is a text field the operator can change
// to simulate different roles. When real auth ships, this becomes a
// session read.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LoggedInUser } from "@/components/nex/LoggedInUser";

type DraftListItem = {
  id: string;
  brain_slug: string;
  author_id: string;
  proposed_semver: string | null;
  status: "editing" | "submitted_for_review" | "changes_requested" | "approved" | "rejected";
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
};

type DraftFull = DraftListItem & {
  based_on_version_id: string | null;
  manifest_json: Record<string, unknown>;
  modules_json: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

const STATUS_STYLES: Record<DraftListItem["status"], string> = {
  editing:              "bg-neutral-100 text-neutral-800 border-neutral-300",
  submitted_for_review: "bg-blue-100 text-blue-800 border-blue-300",
  changes_requested:    "bg-amber-100 text-amber-800 border-amber-300",
  approved:             "bg-green-100 text-green-800 border-green-300",
  rejected:             "bg-red-100 text-red-800 border-red-300",
};

export default function DraftWorkspacePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // D1 Turn 3 · identity now flows via Supabase session cookies. No
  // more x-actor-id headers. Actor role for UI-side gating comes from
  // /api/admin/whoami (fetched inside LoggedInUser badge component).
  const authHeaders = { "content-type": "application/json" };
  // Reviewer UI gating: allow review actions when user is not the author.
  // For v1.0 we surface reviewer buttons if the draft.author_id is
  // different from the whoami email. The whoami is inside LoggedInUser;
  // for the editor's simple gating below we still show the buttons and
  // let the server enforce F6 (author cannot self-review).
  const actorRoleForUi: "author" | "reviewer" | "admin" = "admin";

  const loadDrafts = useCallback(async () => {
    const r = await fetch(`/api/admin/brains/${slug}/drafts`, { cache: "no-store" });
    const data = await r.json();
    if (data.ok) setDrafts(data.drafts);
  }, [slug]);

  const loadDraft = useCallback(async (id: string) => {
    setLoading(true);
    const r = await fetch(`/api/admin/brains/${slug}/drafts/${id}`, { cache: "no-store" });
    const data = await r.json();
    setLoading(false);
    if (data.ok) setDraft(data.draft);
    else setMessage({ kind: "err", text: data.error ?? "load failed" });
  }, [slug]);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);
  useEffect(() => { if (activeDraftId) loadDraft(activeDraftId); }, [activeDraftId, loadDraft]);

  const flash = (kind: "ok" | "err", text: string) => {
    setMessage({ kind, text });
    setTimeout(() => setMessage(null), 3500);
  };

  const createOrOpen = async () => {
    setLoading(true);
    const r = await fetch(`/api/admin/brains/${slug}/drafts`, { method: "POST", headers: authHeaders });
    const data = await r.json();
    setLoading(false);
    if (!data.ok) return flash("err", data.error ?? "create failed");
    flash("ok", data.created ? "New draft created" : "Existing draft opened");
    await loadDrafts();
    setActiveDraftId(data.draft.id);
  };

  const saveDraft = async (patch: Partial<Pick<DraftFull, "manifest_json" | "modules_json" | "proposed_semver">>) => {
    if (!draft) return;
    setLoading(true);
    const r = await fetch(`/api/admin/brains/${slug}/drafts/${draft.id}`, {
      method: "PATCH", headers: authHeaders, body: JSON.stringify(patch),
    });
    const data = await r.json();
    setLoading(false);
    if (!data.ok) return flash("err", data.error ?? "save failed");
    flash("ok", "Saved");
    setDraft(data.draft);
    await loadDrafts();
  };

  const submitForReview = async () => {
    if (!draft) return;
    setLoading(true);
    const r = await fetch(`/api/admin/brains/${slug}/drafts/${draft.id}/submit`, { method: "POST", headers: authHeaders });
    const data = await r.json();
    setLoading(false);
    if (!data.ok) return flash("err", data.error ?? "submit failed");
    flash("ok", "Submitted for review");
    setDraft(data.draft);
    await loadDrafts();
  };

  const reviewAction = async (action: "approve" | "reject" | "request_changes" | "comment", notes: string) => {
    if (!draft) return;
    setLoading(true);
    const r = await fetch(`/api/admin/brains/${slug}/drafts/${draft.id}/action`, {
      method: "POST", headers: authHeaders, body: JSON.stringify({ action, notes: notes || undefined }),
    });
    const data = await r.json();
    setLoading(false);
    if (!data.ok) return flash("err", data.error ?? "action failed");
    flash("ok", `Recorded: ${action}`);
    setDraft(data.draft);
    await loadDrafts();
  };

  const publish = async () => {
    if (!draft) return;
    if (!confirm(`Publish this draft as ${draft.proposed_semver ?? "next patch"}? Version rows are immutable.`)) return;
    setLoading(true);
    const r = await fetch(`/api/admin/brains/${slug}/drafts/${draft.id}/publish`, { method: "POST", headers: authHeaders });
    const data = await r.json();
    setLoading(false);
    if (!data.ok) {
      return flash("err", `${data.error ?? "publish failed"}${data.current ? ` · current is ${data.current}` : ""}${data.proposed ? ` · proposed ${data.proposed}` : ""}`);
    }
    flash("ok", `Published as ${data.published_semver}`);
    await loadDrafts();
  };

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-sm text-neutral-900" style={{ color: "#171717" }}>
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-3">
        <Link href={`/admin/brains/${slug}`} className="text-xs text-neutral-500 hover:text-neutral-900">← Back to Control Centre</Link>
        <div className="flex items-start justify-between gap-6 mt-2">
          <h1 className="text-xl font-semibold">Draft Workspace <span className="text-neutral-400 font-mono ml-2 text-sm">{slug}</span></h1>
          <LoggedInUser />
        </div>
      </header>

      {message && (
        <div className={`px-6 py-2 text-sm ${message.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {message.text}
        </div>
      )}

      <div className="p-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 max-w-[1600px] mx-auto">
        <aside className="rounded-xl border border-neutral-200 bg-white p-4 h-fit sticky top-24">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Drafts</h2>
            <button onClick={createOrOpen} disabled={loading}
              className="text-xs bg-neutral-900 text-white px-2 py-1 rounded hover:bg-neutral-700 disabled:opacity-50">
              + New / Open Mine
            </button>
          </div>
          {drafts.length === 0 ? (
            <p className="text-xs text-neutral-500">No drafts yet. Click "New / Open Mine" to seed one from the current published version.</p>
          ) : (
            <ul className="space-y-1">
              {drafts.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => setActiveDraftId(d.id)}
                    className={`w-full text-left rounded-lg px-3 py-2 border transition ${activeDraftId === d.id ? "border-neutral-800 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"}`}>
                    <div className="text-xs text-neutral-500 truncate">{d.author_id}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLES[d.status]}`}>{d.status.replace(/_/g, " ")}</span>
                      {d.proposed_semver && <span className="text-[10px] font-mono text-neutral-500">→{d.proposed_semver}</span>}
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-1">upd {new Date(d.updated_at).toLocaleString()}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="rounded-xl border border-neutral-200 bg-white p-5">
          {!draft ? (
            <div className="text-neutral-500 text-sm">Select or open a draft from the left.</div>
          ) : (
            <DraftEditor
              draft={draft}
              loading={loading}
              actorRole={actorRoleForUi}
              onSave={saveDraft}
              onSubmit={submitForReview}
              onReview={reviewAction}
              onPublish={publish}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ------------------------------- Editor -------------------------------

function DraftEditor({
  draft, loading, actorRole,
  onSave, onSubmit, onReview, onPublish,
}: {
  draft: DraftFull;
  loading: boolean;
  actorRole: "author" | "reviewer" | "admin";
  onSave: (patch: Partial<Pick<DraftFull, "manifest_json" | "modules_json" | "proposed_semver">>) => void | Promise<void>;
  onSubmit: () => void | Promise<void>;
  onReview: (action: "approve" | "reject" | "request_changes" | "comment", notes: string) => void | Promise<void>;
  onPublish: () => void | Promise<void>;
}) {
  const [proposedSemver, setProposedSemver] = useState(draft.proposed_semver ?? "");
  const [modulesText, setModulesText] = useState(JSON.stringify(draft.modules_json, null, 2));
  const [manifestText, setManifestText] = useState(JSON.stringify(draft.manifest_json, null, 2));
  const [reviewNotes, setReviewNotes] = useState("");
  const [parseErr, setParseErr] = useState<string | null>(null);

  useEffect(() => {
    setProposedSemver(draft.proposed_semver ?? "");
    setModulesText(JSON.stringify(draft.modules_json, null, 2));
    setManifestText(JSON.stringify(draft.manifest_json, null, 2));
  }, [draft.id, draft.proposed_semver, draft.modules_json, draft.manifest_json]);

  const editable = draft.status === "editing" || draft.status === "changes_requested";
  const reviewable = draft.status === "submitted_for_review";
  const publishable = draft.status === "approved";
  const canReview = actorRole === "reviewer" || actorRole === "admin";

  const handleSave = () => {
    try {
      const parsedModules = JSON.parse(modulesText);
      const parsedManifest = JSON.parse(manifestText);
      setParseErr(null);
      onSave({
        modules_json: parsedModules,
        manifest_json: parsedManifest,
        proposed_semver: proposedSemver.trim() || null,
      });
    } catch (e) {
      setParseErr((e as Error).message);
    }
  };

  const moduleKeys = Object.keys(draft.modules_json ?? {});

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">Status</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-1 rounded border ${STATUS_STYLES[draft.status]}`}>{draft.status.replace(/_/g, " ")}</span>
            {draft.review_notes && <span className="text-xs text-neutral-500">"{draft.review_notes}"</span>}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            by {draft.author_id} · {moduleKeys.length} modules: {moduleKeys.join(", ") || "none"}
            {draft.based_on_version_id && ` · from version ${draft.based_on_version_id.slice(0, 8)}…`}
          </div>
        </div>
        <div className="flex gap-2">
          {editable && (
            <>
              <button onClick={handleSave} disabled={loading}
                className="text-xs px-3 py-1.5 bg-neutral-900 text-white rounded hover:bg-neutral-700 disabled:opacity-50">
                Save
              </button>
              <button onClick={() => onSubmit()} disabled={loading}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50">
                Submit for review
              </button>
            </>
          )}
          {publishable && (
            <button onClick={() => onPublish()} disabled={loading}
              className="text-xs px-3 py-1.5 bg-green-700 text-white rounded hover:bg-green-600 disabled:opacity-50">
              Publish
            </button>
          )}
        </div>
      </div>

      {parseErr && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          JSON parse error: {parseErr}
        </div>
      )}

      <div className="grid grid-cols-[max-content_1fr] gap-3 items-center">
        <label className="text-xs text-neutral-500">Proposed semver</label>
        <input value={proposedSemver} onChange={(e) => setProposedSemver(e.target.value)}
          placeholder="e.g. 1.1.0 (leave blank to auto-bump patch on publish)"
          disabled={!editable}
          className="rounded border border-neutral-300 px-2 py-1 text-sm w-64 font-mono disabled:bg-neutral-50 disabled:text-neutral-500"
          style={{ color: "#171717" }} />
      </div>

      <div>
        <label className="text-xs uppercase tracking-wide text-neutral-500">Manifest (JSON)</label>
        <textarea value={manifestText} onChange={(e) => setManifestText(e.target.value)} disabled={!editable}
          className="w-full h-40 rounded border border-neutral-300 p-3 font-mono text-xs disabled:bg-neutral-50"
          style={{ color: "#171717" }} />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-neutral-500">Modules (JSON, keyed by module name)</label>
        <textarea value={modulesText} onChange={(e) => setModulesText(e.target.value)} disabled={!editable}
          className="w-full h-96 rounded border border-neutral-300 p-3 font-mono text-xs disabled:bg-neutral-50"
          style={{ color: "#171717" }} />
      </div>

      {reviewable && canReview && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
          <div className="text-sm font-medium text-blue-900">Reviewer Actions</div>
          <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Notes (required for reject / request_changes, recommended for approve)"
            className="w-full h-24 rounded border border-blue-300 p-2 text-sm bg-white"
            style={{ color: "#171717" }} />
          <div className="flex gap-2">
            <button onClick={() => onReview("approve", reviewNotes)} disabled={loading}
              className="text-xs px-3 py-1.5 bg-green-700 text-white rounded hover:bg-green-600 disabled:opacity-50">
              Approve
            </button>
            <button onClick={() => onReview("request_changes", reviewNotes)} disabled={loading || !reviewNotes.trim()}
              className="text-xs px-3 py-1.5 bg-amber-700 text-white rounded hover:bg-amber-600 disabled:opacity-50">
              Request Changes
            </button>
            <button onClick={() => onReview("reject", reviewNotes)} disabled={loading || !reviewNotes.trim()}
              className="text-xs px-3 py-1.5 bg-red-700 text-white rounded hover:bg-red-600 disabled:opacity-50">
              Reject
            </button>
            <button onClick={() => onReview("comment", reviewNotes)} disabled={loading || !reviewNotes.trim()}
              className="text-xs px-3 py-1.5 bg-neutral-700 text-white rounded hover:bg-neutral-600 disabled:opacity-50">
              Comment
            </button>
          </div>
        </div>
      )}

      {reviewable && !canReview && (
        <div className="text-xs text-neutral-500 italic">Awaiting review. Switch role to `reviewer` or `admin` to act on this draft.</div>
      )}
    </div>
  );
}
