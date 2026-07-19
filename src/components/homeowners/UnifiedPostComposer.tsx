"use client";

// UnifiedPostComposer — the single door into SiteBook.
//
// Shape (Philip's brainstorm 2026-07-19):
//   Row 1 · Destination toggle (SiteBook / Yard) + Project dropdown
//   Row 2 · Body textarea (natural language)
//   Row 3 · Quiet toolbar (📷 📎 £ 🔧 🏠 🏗️) + Post CTA
//
// The toolbar icons inflate a single inline row above the toolbar
// when tapped. Tap again to collapse (values preserved). This keeps
// the resting state at 3 rows / ~110px — Twitter-density — while
// still covering the whole SiteBook surface (posts, costs, docs,
// snags, home-care, new projects) from one place.
//
// On desktop: icon + tiny caption (`£ Cost`).
// On mobile:  icon only, caption hidden via sm: breakpoint.
//
// Yard mode strips the fanout icons — Yard has no projects, costs,
// warranties. Only camera + city + one banner: "Public — remove
// anything private."
//
// Post → single button that fans out to N API calls based on which
// rows are inflated. Backend wiring lives in the parent via the
// onSubmit callback — this component is purely UI.

import { useMemo, useRef, useState } from "react";
import {
  Send, Loader2, X,
  Camera, Paperclip, PoundSterling, Wrench, CalendarClock, HardHat,
  UserPlus, ChevronDown, Check
} from "lucide-react";
import Link from "next/link";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

export type ComposerProject = { id: string; title: string };
export type ComposerTrade   = { listingId: string; name: string; tradeType: string | null };

export type ComposerDestination = "sitebook" | "yard";

export type ComposerSubmitPayload = {
  destination:  ComposerDestination;
  projectId:    string | null;          // null when "new project" or Yard
  /** Short subject / topic (e.g. "Roof re-slate", "Kitchen refit").
   *  Optional — posts without a subject just show the body. */
  title?:       string;
  body:         string;

  // Yard-only extras
  yardCity?:    string | null;

  /** Trades / suppliers explicitly invited to see this post. When
   *  empty, the post is visible to every project member ("all-trades").
   *  When populated, visibility="selected" and only these listing IDs
   *  can view the post. */
  invitedListingIds?: string[];

  /** When true, also publish this post as a public Yard beacon so
   *  trades outside the invited list can see it and respond. */
  crossPostToYard?: boolean;

  // Inflated toolbar rows — each set only when its icon is inflated
  photos?:      File[];
  documents?:   File[];
  cost?:        { amountPence: number; tradeListingId: string | null; tradeName: string | null } | null;
  fix?:         { title: string; assigneeListingId: string | null; photo?: File | null } | null;
  homeCare?:    { title: string; every: "annual" | "6mo" | "3mo" | "monthly" } | null;
  newProject?:  { title: string; city: string } | null;
};

export type ComposerResult = { ok: boolean; error?: string };

const YARD_CITIES = [
  "Manchester", "London", "Birmingham", "Leeds", "Liverpool",
  "Bristol", "Sheffield", "Newcastle", "Cardiff", "Glasgow"
];

const HOME_CARE_INTERVALS: { value: "annual" | "6mo" | "3mo" | "monthly"; label: string }[] = [
  { value: "annual",  label: "Annual"    },
  { value: "6mo",     label: "6 months"  },
  { value: "3mo",     label: "3 months"  },
  { value: "monthly", label: "Monthly"   }
];

export type ToolKey = "photo" | "doc" | "cost" | "fix" | "homecare" | "newproject";

const TOOLS: { key: ToolKey; icon: typeof Camera; caption: string; sitebookOnly: boolean }[] = [
  { key: "photo",      icon: Camera,        caption: "Image",             sitebookOnly: false },
  { key: "doc",        icon: Paperclip,     caption: "File (excel / pdf)", sitebookOnly: true  },
  { key: "cost",       icon: PoundSterling, caption: "Cost",              sitebookOnly: true  },
  { key: "fix",        icon: Wrench,        caption: "Fix",               sitebookOnly: true  },
  { key: "homecare",   icon: CalendarClock, caption: "Home care",         sitebookOnly: true  },
  { key: "newproject", icon: HardHat,       caption: "new project",       sitebookOnly: true  }
];

// v1 default toolbar — the simple "post project + attach + describe"
// experience. Additional tools (Cost / Fix / Home care) unlock as the
// homeowner installs their apps from the App Store.
const V1_TOOLS: ToolKey[] = ["photo", "doc", "newproject"];

export function UnifiedPostComposer({
  authorInitial,
  authorName,
  authorSubtitle,
  authorAvatarUrl,
  projects,
  trades,
  onSubmit,
  enabledTools = V1_TOOLS,
  addTradesHref
}: {
  authorInitial:    string;
  /** Owner display name shown in the header strip (e.g. "Sarah K."). */
  authorName?:      string;
  /** Small caption under the name (e.g. "Project Owner · Manchester"). */
  authorSubtitle?:  string;
  /** Optional round photo — falls back to the yellow initial tile. */
  authorAvatarUrl?: string | null;
  projects:         ComposerProject[];
  trades:           ComposerTrade[];
  /** REQUIRED. Handler that fans out the payload to backend APIs.
   *  Must be created inside a client component — never pass an inline
   *  function from a server component (React will error). Use
   *  UnifiedPostComposerWithFanout / UnifiedPostComposerPreview so
   *  server pages don't touch this prop directly. */
  onSubmit:         (payload: ComposerSubmitPayload) => Promise<ComposerResult>;
  /** Which toolbar chips render. Defaults to V1 (Photo · Quote · New
   *  project). Additional chips unlock as apps get installed — real
   *  /sitebook derives this list from the homeowner's installed apps. */
  enabledTools?:    ToolKey[];
  /** When set, an "Add trades" pill appears in the footer that opens
   *  the SiteBook trades directory. Same route as the "+ Add" pill on
   *  the Trades & Suppliers panel. */
  addTradesHref?:   string;
}) {
  const effectiveSubmit = onSubmit;
  // ─── Row 1: destination + project ────────────────────────────────
  // Destination is locked to "sitebook" for v1 — the SiteBook/Yard toggle
  // was removed per Philip 2026-07-19. Yard cross-posting will return as
  // a smart-default checkbox in the footer alongside the Post button.
  const destination: ComposerDestination = "sitebook";
  const [projectId,   setProjectId]   = useState<string>(projects[0]?.id ?? "");
  void YARD_CITIES;                                // keep for when Yard flow returns

  // ─── Row 2: subject + body ───────────────────────────────────────
  const [title, setTitle] = useState("");
  const [body,  setBody]  = useState("");

  // ─── Row 3: toolbar (which tools are inflated) ───────────────────
  const [inflated, setInflated] = useState<Set<ToolKey>>(new Set());

  // Inflated-row state
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef   = useRef<HTMLInputElement | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [docFiles,   setDocFiles]   = useState<File[]>([]);

  const [costAmount, setCostAmount] = useState<string>("");   // "2450.00"
  const [costTrade,  setCostTrade]  = useState<string>("");   // listingId

  const [fixTitle,    setFixTitle]    = useState<string>("");
  const [fixAssignee, setFixAssignee] = useState<string>("");
  const [fixPhoto,    setFixPhoto]    = useState<File | null>(null);
  const fixPhotoRef = useRef<HTMLInputElement | null>(null);

  const [hcTitle, setHcTitle] = useState<string>("");
  const [hcEvery, setHcEvery] = useState<"annual" | "6mo" | "3mo" | "monthly">("annual");

  const [npTitle, setNpTitle] = useState<string>("");
  const [npCity,  setNpCity]  = useState<string>("");

  // Add-trades dropdown state
  const [invitedIds,     setInvitedIds]     = useState<Set<string>>(new Set());
  const [tradesMenuOpen, setTradesMenuOpen] = useState<boolean>(false);
  // "Also post to Yard" — default on for new-project posts (broadcast
  // is the point), default off for updates (privacy is the point).
  const [crossPostYard,  setCrossPostYard]  = useState<boolean>(false);
  function toggleInvite(listingId: string) {
    setInvitedIds((cur) => {
      const next = new Set(cur);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
  }

  // Submit state
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error,  setError]  = useState<string>("");

  // ─── Derived ─────────────────────────────────────────────────────
  const enabledSet = useMemo(() => new Set(enabledTools), [enabledTools]);
  const availableTools = useMemo(
    () => TOOLS.filter((t) =>
      enabledSet.has(t.key) && (destination === "sitebook" || !t.sitebookOnly)
    ),
    [enabledSet, destination]
  );

  const canSubmit =
    status !== "sending" &&
    body.trim().length > 0 &&
    (
      destination === "yard"
        ? true
        : inflated.has("newproject") ? npTitle.trim().length > 0 : !!projectId
    );

  function toggle(key: ToolKey) {
    setInflated((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    // Smart default: New-project posts should broadcast to Yard so
    // trades outside the project can find them. Updates default off.
    if (key === "newproject") setCrossPostYard((v) => !v);
  }

  function onPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPhotoFiles((cur) => [...cur, ...files]);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }
  function onDocs(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setDocFiles((cur) => [...cur, ...files]);
    if (docInputRef.current) docInputRef.current.value = "";
  }
  function onFixPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFixPhoto(f);
    if (fixPhotoRef.current) fixPhotoRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("sending");
    setError("");

    const payload: ComposerSubmitPayload = {
      destination,
      projectId: destination === "yard" ? null : (inflated.has("newproject") ? null : projectId || null),
      title:     title.trim() || undefined,
      body:      body.trim(),

      yardCity: null,

      invitedListingIds: invitedIds.size > 0 ? Array.from(invitedIds) : undefined,
      crossPostToYard:   crossPostYard,

      photos:    inflated.has("photo") && photoFiles.length > 0 ? photoFiles : undefined,
      documents: inflated.has("doc")   && docFiles.length   > 0 ? docFiles   : undefined,

      cost: inflated.has("cost") && Number.parseFloat(costAmount) > 0 ? {
        amountPence:      Math.round(Number.parseFloat(costAmount) * 100),
        tradeListingId:   costTrade || null,
        tradeName:        trades.find((t) => t.listingId === costTrade)?.name ?? null
      } : null,

      fix: inflated.has("fix") && fixTitle.trim().length > 0 ? {
        title:              fixTitle.trim(),
        assigneeListingId:  fixAssignee || null,
        photo:              fixPhoto
      } : null,

      homeCare: inflated.has("homecare") && hcTitle.trim().length > 0 ? {
        title: hcTitle.trim(),
        every: hcEvery
      } : null,

      newProject: destination === "sitebook" && inflated.has("newproject") && npTitle.trim().length > 0 ? {
        title: npTitle.trim(),
        city:  npCity.trim()
      } : null
    };

    const res = await effectiveSubmit(payload);
    if (!res.ok) {
      setStatus("error");
      setError(res.error || "Post failed. Try again.");
      return;
    }
    // reset
    setTitle("");
    setBody("");
    setInflated(new Set());
    setPhotoFiles([]);
    setDocFiles([]);
    setCostAmount(""); setCostTrade("");
    setFixTitle("");   setFixAssignee(""); setFixPhoto(null);
    setInvitedIds(new Set());
    setTradesMenuOpen(false);
    setCrossPostYard(false);
    setHcTitle("");    setHcEvery("annual");
    setNpTitle("");    setNpCity("");
    setStatus("idle");
  }

  // ─── Render ──────────────────────────────────────────────────────
  const bodyPlaceholder = "Describe the project or the task you need help with…";

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border-2 bg-white shadow-sm"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      {/* ─── Owner profile strip — always visible at top of the composer ─── */}
      {(authorName || authorSubtitle) && (
        <div className="flex items-center gap-2.5 border-b px-3 py-2.5" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          {authorAvatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={authorAvatarUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover shadow-sm"
              style={{ border: "2px solid white", boxShadow: "0 0 0 1px rgba(0,0,0,0.06)" }}
              loading="lazy"
            />
          ) : (
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-black text-neutral-900 shadow-sm"
              style={{ backgroundColor: BRAND_YELLOW, border: "2px solid white", boxShadow: "0 0 0 1px rgba(0,0,0,0.06)" }}
            >
              {authorInitial}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {authorName && (
              <p className="truncate text-[13px] font-black leading-tight text-neutral-900">{authorName}</p>
            )}
            {authorSubtitle && (
              <p className="mt-0.5 truncate text-[10px] font-black uppercase tracking-wider text-neutral-500">
                {authorSubtitle}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── ROW 1 · Start Your Project header + Add trades pill (top-right) + project select ─── */}
      <div className="border-b p-3" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-900">
            Start Your Project
          </p>
          {/* Project dropdown removed from top row per Philip 2026-07-19 —
              it duplicated info that's already implicit in the Feed's
              project context. When the owner has multiple projects the
              picker returns as an inline row here, but for the single-
              project default it's silent. */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setTradesMenuOpen((v) => !v)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-neutral-900 px-3 text-[10.5px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-110"
                title="Pick which trades or suppliers can see this post"
                aria-expanded={tradesMenuOpen}
                aria-haspopup="listbox"
              >
                <UserPlus size={11} strokeWidth={2.5}/>
                Add trades
                {invitedIds.size > 0 && (
                  <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] tabular-nums">
                    {invitedIds.size}
                  </span>
                )}
                <ChevronDown size={10} strokeWidth={2.5} className="opacity-70"/>
              </button>

              {tradesMenuOpen && (
                <>
                  {/* Click-away scrim */}
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setTradesMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    role="listbox"
                    className="absolute right-0 top-full z-40 mt-1 w-[260px] overflow-hidden rounded-lg border bg-white shadow-lg"
                    style={{ borderColor: "rgba(0,0,0,0.08)" }}
                  >
                    <div className="border-b bg-neutral-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-neutral-600" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                      Who sees this post?
                    </div>
                    {trades.length === 0 ? (
                      <p className="px-3 py-3 text-[11.5px] text-neutral-600">
                        No trades on your team yet. Browse the directory to add your first.
                      </p>
                    ) : (
                      <ul className="max-h-64 overflow-y-auto">
                        {trades.map((t) => {
                          const checked = invitedIds.has(t.listingId);
                          return (
                            <li key={t.listingId}>
                              <button
                                type="button"
                                onClick={() => toggleInvite(t.listingId)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-neutral-50"
                              >
                                <span
                                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border-2"
                                  style={{
                                    borderColor:     checked ? BRAND_GREEN : "rgba(0,0,0,0.20)",
                                    backgroundColor: checked ? BRAND_GREEN : "white"
                                  }}
                                >
                                  {checked && <Check size={10} strokeWidth={3} className="text-white"/>}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[12px] font-black text-neutral-900">{t.name}</p>
                                  {t.tradeType && (
                                    <p className="truncate text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                      {t.tradeType}
                                    </p>
                                  )}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <div className="border-t bg-neutral-50 px-3 py-1.5 text-[10px] text-neutral-500" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                      {invitedIds.size === 0
                        ? "Nobody selected · all project trades will see this post."
                        : `${invitedIds.size} selected · only they can see this post.`}
                    </div>
                    {addTradesHref && (
                      <Link
                        href={addTradesHref}
                        className="flex items-center justify-between border-t px-3 py-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-800 transition hover:bg-neutral-50"
                        style={{ borderColor: "rgba(0,0,0,0.06)" }}
                      >
                        Browse full directory
                        <span className="text-neutral-400">→</span>
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── ROW 2 · subject + body */}
      <div className="space-y-1 px-3 py-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 120))}
          placeholder="What's this post about?"
          className="w-full border-0 bg-transparent px-0 py-1 text-[15px] font-black text-neutral-900 outline-none placeholder:font-black placeholder:text-neutral-400"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder={bodyPlaceholder}
          className="w-full resize-none rounded-lg border-0 bg-transparent px-0 py-1 text-[14px] leading-relaxed text-neutral-900 outline-none placeholder:font-normal placeholder:text-neutral-400"
        />
      </div>

      {/* ─── Inflated inline rows (rendered above toolbar) ─── */}
      {inflated.size > 0 && (
        <div className="space-y-2 border-t px-3 py-2" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          {inflated.has("newproject") && (
            <InflatedRow icon={HardHat} label="New project" onClose={() => toggle("newproject")}>
              <input
                value={npTitle}
                onChange={(e) => setNpTitle(e.target.value.slice(0, 80))}
                placeholder="Project title (e.g. En-suite plumbing)"
                className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-[12px] outline-none focus:border-neutral-400"
              />
              <input
                value={npCity}
                onChange={(e) => setNpCity(e.target.value.slice(0, 40))}
                placeholder="City"
                className="w-28 rounded-md border border-neutral-300 bg-white px-2 py-1 text-[12px] outline-none focus:border-neutral-400"
              />
            </InflatedRow>
          )}

          {inflated.has("cost") && (
            <InflatedRow icon={PoundSterling} label="Cost" onClose={() => toggle("cost")}>
              <div className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12px] font-black text-neutral-500">£</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={costAmount}
                  onChange={(e) => setCostAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-28 rounded-md border border-neutral-300 bg-white pl-5 pr-2 py-1 text-[12px] tabular-nums outline-none focus:border-neutral-400"
                />
              </div>
              <select
                value={costTrade}
                onChange={(e) => setCostTrade(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-[12px] outline-none focus:border-neutral-400"
              >
                <option value="">Trade / supplier (optional)</option>
                {trades.map((t) => <option key={t.listingId} value={t.listingId}>{t.name}</option>)}
              </select>
            </InflatedRow>
          )}

          {inflated.has("doc") && (
            <InflatedRow icon={Paperclip} label="Quote / invoice" onClose={() => toggle("doc")}>
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-neutral-300 bg-white px-2.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
              >
                <Paperclip size={10}/> Attach PDF / spreadsheet / image
              </button>
              <input
                ref={docInputRef}
                type="file"
                accept="application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,image/*"
                multiple
                onChange={onDocs}
                className="hidden"
              />
              {docFiles.length > 0 && (
                <ul className="flex flex-wrap gap-1">
                  {docFiles.map((f, i) => (
                    <li key={i} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 pl-2 pr-1 text-[10.5px] text-neutral-800">
                      <span className="max-w-[100px] truncate font-bold">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setDocFiles((cur) => cur.filter((_, j) => j !== i))}
                        className="text-neutral-500 hover:text-neutral-900"
                      >
                        <X size={10}/>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </InflatedRow>
          )}

          {inflated.has("photo") && (
            <InflatedRow icon={Camera} label="Photos" onClose={() => toggle("photo")}>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-neutral-300 bg-white px-2.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
              >
                <Camera size={10}/> Add photos
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onPhotos}
                className="hidden"
              />
              {photoFiles.length > 0 && (
                <ul className="flex flex-wrap gap-1">
                  {photoFiles.map((f, i) => (
                    <li key={i} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 pl-2 pr-1 text-[10.5px] text-neutral-800">
                      <span className="max-w-[80px] truncate font-bold">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setPhotoFiles((cur) => cur.filter((_, j) => j !== i))}
                        className="text-neutral-500 hover:text-neutral-900"
                      >
                        <X size={10}/>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </InflatedRow>
          )}

          {inflated.has("fix") && (
            <InflatedRow icon={Wrench} label="Thing to fix" onClose={() => toggle("fix")}>
              <input
                value={fixTitle}
                onChange={(e) => setFixTitle(e.target.value.slice(0, 120))}
                placeholder="What needs fixing?"
                className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-[12px] outline-none focus:border-neutral-400"
              />
              <select
                value={fixAssignee}
                onChange={(e) => setFixAssignee(e.target.value)}
                className="w-32 rounded-md border border-neutral-300 bg-white px-2 py-1 text-[12px] outline-none focus:border-neutral-400"
              >
                <option value="">Assignee</option>
                {trades.map((t) => <option key={t.listingId} value={t.listingId}>{t.name}</option>)}
              </select>
              <button
                type="button"
                onClick={() => fixPhotoRef.current?.click()}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-neutral-300 bg-white px-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
              >
                <Camera size={10}/> {fixPhoto ? "Change" : "Photo"}
              </button>
              <input
                ref={fixPhotoRef}
                type="file"
                accept="image/*"
                onChange={onFixPhoto}
                className="hidden"
              />
              {fixPhoto && (
                <span className="max-w-[80px] truncate text-[10.5px] font-bold text-neutral-600">{fixPhoto.name}</span>
              )}
            </InflatedRow>
          )}

          {inflated.has("homecare") && (
            <InflatedRow icon={CalendarClock} label="Home care" onClose={() => toggle("homecare")}>
              <input
                value={hcTitle}
                onChange={(e) => setHcTitle(e.target.value.slice(0, 120))}
                placeholder="Reminder title (e.g. Service boiler)"
                className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-[12px] outline-none focus:border-neutral-400"
              />
              <select
                value={hcEvery}
                onChange={(e) => setHcEvery(e.target.value as typeof hcEvery)}
                className="w-28 rounded-md border border-neutral-300 bg-white px-2 py-1 text-[12px] outline-none focus:border-neutral-400"
                aria-label="Repeat interval"
              >
                {HOME_CARE_INTERVALS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </InflatedRow>
          )}
        </div>
      )}

      {/* Error strip */}
      {status === "error" && error && (
        <div className="border-t bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-800" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          {error}
        </div>
      )}

      {/* ─── ROW 3 · footer · tool buttons + Post CTA ─── */}
      <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-2" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        {availableTools.map((t) => {
          const Icon    = t.icon;
          const active  = inflated.has(t.key);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => toggle(t.key)}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[10.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition hover:brightness-95 sm:px-2.5"
              style={{
                backgroundColor: BRAND_YELLOW,
                border:          active ? "2px solid #0A0A0A" : "2px solid transparent"
              }}
              title={t.caption}
              aria-pressed={active}
            >
              <Icon size={11} strokeWidth={2.5}/>
              <span className="hidden sm:inline">{t.caption}</span>
            </button>
          );
        })}

        {/* Also post to Yard — public broadcast checkbox. Smart
            default flips on when the New project chip is inflated. */}
        <label
          className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50"
          title="Broadcast this post as a public Yard beacon so trades outside your project can see + respond"
        >
          <span
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border-2"
            style={{
              borderColor:     crossPostYard ? BRAND_GREEN : "rgba(0,0,0,0.20)",
              backgroundColor: crossPostYard ? BRAND_GREEN : "white"
            }}
          >
            {crossPostYard && <Check size={10} strokeWidth={3} className="text-white"/>}
          </span>
          Also post to Yard
          <input
            type="checkbox"
            checked={crossPostYard}
            onChange={(e) => setCrossPostYard(e.target.checked)}
            className="sr-only"
          />
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-95 disabled:opacity-40"
          style={{ backgroundColor: BRAND_GREEN }}
        >
          {status === "sending"
            ? <><Loader2 size={12} className="animate-spin"/> Posting…</>
            : <>Post <Send size={11}/></>}
        </button>
      </div>
    </form>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function InflatedRow({
  icon: Icon, label, children, onClose
}: {
  icon: typeof Camera;
  label: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-neutral-50 px-2 py-1.5">
      <span
        className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider text-neutral-500"
        style={{ minWidth: 78 }}
      >
        <Icon size={10} strokeWidth={2.5}/>
        {label}
      </span>
      {children}
      <button
        type="button"
        onClick={onClose}
        className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-200"
        aria-label="Collapse"
      >
        <X size={11}/>
      </button>
    </div>
  );
}
