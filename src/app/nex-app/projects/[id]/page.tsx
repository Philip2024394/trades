"use client";

// Project detail view · Philip 2026-08-02.
//
// Shows the Project as a first-class object: title · members · status ·
// timeline · message thread. Customer can continue the conversation (posts
// to /api/nex/merchant-chat and appends to project.messages), mark as
// completed (moves to Completed section), or cancel (destructive · removes
// the project).

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Send,
  Star,
  Store,
  Target,
  Users,
  X as XIcon,
} from "lucide-react";
import { composeNexBrief, type NexBrief } from "@/lib/nex/projects/nex-brief";
import {
  composeProjectJourney,
  groupJourneyByDay,
  type JourneyActor,
} from "@/lib/nex/projects/journey";
import {
  appendMessage,
  cancelProject,
  formatRelativeTime,
  getProject,
  PROJECTS_UPDATED_EVENT,
  updateConversationId,
  updatePurpose,
  updateStatus,
} from "@/lib/nex/projects/customer-store";
import {
  PROJECT_STATUS_LABEL,
  type Project,
  type ProjectStatus,
} from "@/lib/nex/projects/types";

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [project, setProject] = useState<Project | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false); // true once first fetch resolves
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await getProject(id);
        if (!cancelled) setProject(next);
      } catch (err) {
        console.error("[nex-projects][detail]", err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void refresh();
    const handler = () => { void refresh(); };
    window.addEventListener(PROJECTS_UPDATED_EVENT, handler);
    window.addEventListener("focus", handler);
    return () => {
      cancelled = true;
      window.removeEventListener(PROJECTS_UPDATED_EVENT, handler);
      window.removeEventListener("focus", handler);
    };
  }, [id]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [project?.messages.length]);

  if (!mounted || !loaded) return <DetailSkeleton />;

  if (!project) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Header title="Project" onBack={() => router.back()} />
        <main className="mx-auto max-w-md px-4 py-10 text-center">
          <p className="text-sm text-black/70">
            This project no longer exists (or belongs to another browser).
          </p>
          <Link
            href="/nex-app/projects"
            className="mt-4 inline-block rounded-full bg-orange-500 px-4 py-2 text-[13px] font-semibold text-white"
          >
            Back to My Projects
          </Link>
        </main>
      </div>
    );
  }

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || sending || !project) return;
    setSending(true);
    // Optimistic customer bubble
    setProject({
      ...project,
      messages: [
        ...project.messages,
        {
          id: "tmp-" + Date.now(),
          role: "customer",
          text: clean,
          created_at: Date.now(),
        },
      ],
    });
    try {
      await appendMessage(project.id, "customer", clean);
      const res = await fetch("/api/nex/merchant-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: clean,
          merchant_id: project.merchant_id,
          merchant_name: project.merchant_name,
          conversation_id: project.conversation_id,
          intent: project.intent,
        }),
      });
      const data = await res.json();
      if (typeof data?.conversation_id === "string" && !project.conversation_id) {
        await updateConversationId(project.id, data.conversation_id);
      }
      const reply =
        typeof data?.answer === "string" && data.answer.length > 0
          ? data.answer
          : `Thanks — I'll pass that on to ${project.merchant_name}.`;
      await appendMessage(project.id, "nex", reply);
    } catch {
      await appendMessage(
        project.id,
        "nex",
        "Sorry, I couldn't reach the chat service just now. Try again in a moment.",
      );
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (next: ProjectStatus) => {
    if (!project) return;
    await updateStatus(project.id, next);
    setMenuOpen(false);
  };

  const remove = async () => {
    if (!project) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Cancel this project? This removes it from your list. Your messages to the merchant are already sent.",
      );
      if (!ok) return;
    }
    await cancelProject(project.id);
    router.push("/nex-app/projects");
  };

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <Header title={project.title} onBack={() => router.back()}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-full p-1.5 text-black/60 hover:bg-black/5"
          aria-label="Project actions"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </Header>

      {menuOpen && (
        <div className="mx-auto w-full max-w-md px-4">
          <div className="rounded-2xl border border-black/5 bg-white p-2 shadow-lg">
            <MenuItem
              label="Mark quotation received"
              onClick={() => changeStatus("quotation_received")}
            />
            <MenuItem
              label="Mark as agreed"
              onClick={() => changeStatus("agreed")}
            />
            <MenuItem
              label="Mark as in progress"
              onClick={() => changeStatus("in_progress")}
            />
            <MenuItem
              label="Mark as completed"
              onClick={() => changeStatus("completed")}
            />
            <div className="my-1 h-px bg-black/5" />
            <MenuItem label="Cancel project" tone="danger" onClick={remove} />
          </div>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-3">
        <ProjectHeaderCard project={project} />
        <PurposeCard project={project} />
        <NexBriefCard
          project={project}
          onFocusLatest={() => {
            if (threadRef.current) {
              threadRef.current.scrollTop = threadRef.current.scrollHeight;
            }
          }}
          onDraftFollowup={() => {
            setDraft(
              `Hi ${project.merchant_name}, just following up on my message — is there anything else you need from me to get things moving?`,
            );
          }}
        />
        <ProjectJourneyCard project={project} />
        <ProjectPeople project={project} />

        <div
          ref={threadRef}
          className="mt-4 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-black/5 bg-white p-3 shadow-sm"
        >
          {project.messages.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-black/50">
              No messages yet. Start the conversation below.
            </p>
          ) : (
            project.messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} text={m.text} at={m.created_at} />
            ))
          )}
          {sending && (
            <div className="pl-1 text-[11px] italic text-black/40">
              Nex is preparing your enquiry…
            </div>
          )}
        </div>

        <div className="sticky bottom-0 -mx-4 mt-3 border-t border-black/5 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const t = draft.trim();
                  if (t) {
                    setDraft("");
                    void send(t);
                  }
                }
              }}
              rows={2}
              placeholder={`Reply to ${project.merchant_name}…`}
              className="flex-1 resize-none rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none placeholder:text-black/40 focus:border-orange-400"
            />
            <button
              type="button"
              onClick={() => {
                const t = draft.trim();
                if (t) {
                  setDraft("");
                  void send(t);
                }
              }}
              disabled={!draft.trim() || sending}
              className="grid h-10 w-10 place-items-center rounded-full bg-orange-500 text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Header({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/5 bg-white/90 px-4 py-3 backdrop-blur">
      <button
        type="button"
        onClick={onBack}
        className="rounded-full p-1.5 text-black/60 hover:bg-black/5"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-black">
        {title}
      </h1>
      {children}
    </header>
  );
}

function ProjectHeaderCard({ project }: { project: Project }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700">
          {project.merchant_avatar_url ? (
            <img
              src={project.merchant_avatar_url}
              alt=""
              className="h-11 w-11 rounded-xl object-cover"
            />
          ) : (
            <Store className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-black">
            {project.merchant_name}
          </div>
          <div className="mt-0.5 text-[11px] text-black/50">
            Started {formatRelativeTime(project.created_at)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-black/50">
          Status
        </span>
        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">
          {PROJECT_STATUS_LABEL[project.status]}
        </span>
      </div>
    </div>
  );
}

function NexBriefCard({
  project,
  onFocusLatest,
  onDraftFollowup,
}: {
  project: Project;
  onFocusLatest: () => void;
  onDraftFollowup: () => void;
}) {
  // Philip 2026-08-02 · Alive Project Manager card (Big Win #2).
  // Nex-authored status brief · deterministic v1 (no LLM · Third Law
  // safe · no hallucination). Refreshes any time the project state
  // changes because the parent already re-composes on message updates.
  const brief = composeNexBrief(project);
  const [expanded, setExpanded] = useState(false);

  const toneStyles = toneToStyles(brief.tone);

  const handleAction = () => {
    if (!brief.action) return;
    switch (brief.action.kind) {
      case "focus_latest":
        onFocusLatest();
        break;
      case "draft_followup":
        onDraftFollowup();
        break;
      case "leave_review":
        // Placeholder for v1 · review flow ships when Merchant Sales
        // Engine (Big Win #3) lands.
        break;
    }
  };

  return (
    <div className={`mt-3 rounded-2xl border p-3 shadow-sm ${toneStyles.container}`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${toneStyles.avatar}`}>
          N
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${toneStyles.tag}`}>
              Nex · Project Manager
            </span>
          </div>
          <div className={`mt-0.5 text-sm font-semibold ${toneStyles.headline}`}>
            {brief.headline}
          </div>
          <div className={`mt-1 text-[13px] leading-snug ${toneStyles.detail}`}>
            {brief.detail}
          </div>

          {brief.action && (
            <button
              type="button"
              onClick={handleAction}
              className={`mt-2.5 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-semibold shadow-sm ${toneStyles.actionButton}`}
            >
              {brief.action.kind === "leave_review" && (
                <Star className="h-3 w-3" strokeWidth={2.5} />
              )}
              {brief.action.label}
            </button>
          )}

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={`mt-2 flex items-center gap-1 text-[11px] font-medium ${toneStyles.expand}`}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide the detail" : "How did Nex work this out?"}
          </button>

          {expanded && (
            <div className={`mt-2 space-y-1 rounded-xl bg-white/60 p-2.5 text-[11px] leading-snug ${toneStyles.factsText}`}>
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                Facts Nex is using
              </div>
              <ul className="list-inside list-disc space-y-0.5">
                {brief.facts.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              {brief.expectation && (
                <>
                  <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider opacity-70">
                    Nex's expectation (not a promise)
                  </div>
                  <p>{brief.expectation}</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function toneToStyles(tone: NexBrief["tone"]) {
  switch (tone) {
    case "action":
      return {
        container: "border-orange-200 bg-orange-50",
        avatar: "bg-orange-500",
        tag: "text-orange-800",
        headline: "text-orange-950",
        detail: "text-orange-900/90",
        actionButton: "bg-orange-500 text-white hover:bg-orange-600",
        expand: "text-orange-800/80 hover:text-orange-900",
        factsText: "text-orange-900",
      };
    case "waiting":
      return {
        container: "border-amber-200 bg-amber-50",
        avatar: "bg-amber-500",
        tag: "text-amber-800",
        headline: "text-amber-950",
        detail: "text-amber-900/90",
        actionButton: "bg-amber-500 text-white hover:bg-amber-600",
        expand: "text-amber-800/80 hover:text-amber-900",
        factsText: "text-amber-900",
      };
    case "celebrate":
      return {
        container: "border-emerald-200 bg-emerald-50",
        avatar: "bg-emerald-500",
        tag: "text-emerald-800",
        headline: "text-emerald-950",
        detail: "text-emerald-900/90",
        actionButton: "bg-emerald-500 text-white hover:bg-emerald-600",
        expand: "text-emerald-800/80 hover:text-emerald-900",
        factsText: "text-emerald-900",
      };
    case "info":
    default:
      return {
        container: "border-black/10 bg-white",
        avatar: "bg-neutral-800",
        tag: "text-black/60",
        headline: "text-black",
        detail: "text-black/70",
        actionButton: "bg-black text-white hover:bg-neutral-800",
        expand: "text-black/50 hover:text-black/70",
        factsText: "text-black/70",
      };
  }
}

function ProjectJourneyCard({ project }: { project: Project }) {
  // Philip 2026-08-02 · "Your journey" — the human-language timeline.
  // Never "Event log" · "Activity stream" · "Workflow history."
  const entries = composeProjectJourney(project);
  const days = groupJourneyByDay(entries);
  const [expanded, setExpanded] = useState(entries.length <= 8);

  const totalCount = entries.length;
  const visibleDays = expanded ? days : days.slice(-3);
  const hiddenCount = expanded
    ? 0
    : days.slice(0, -3).reduce((n, d) => n + d.entries.length, 0);

  return (
    <div className="mt-3 rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-black/50">
          Your journey
        </span>
        <span className="ml-auto text-[10px] text-black/40">
          {totalCount === 1 ? "1 update" : `${totalCount} updates`}
        </span>
      </div>

      {hiddenCount > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 w-full rounded-xl border border-black/5 bg-neutral-50 px-3 py-1.5 text-[11px] font-medium text-black/60 hover:bg-neutral-100"
        >
          Show the {hiddenCount} earlier {hiddenCount === 1 ? "update" : "updates"}
        </button>
      )}

      <div className="mt-2 space-y-3">
        {visibleDays.map((day) => (
          <div key={day.dayKey}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
              {day.dayLabel}
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {day.entries.map((e) => (
                <li key={e.id} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white ${actorBadgeStyles(e.actor)}`}
                  >
                    {actorBadgeInitial(e.actor)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium leading-snug text-black/85">
                      {e.headline}
                    </div>
                    {e.excerpt && (
                      <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-black/55">
                        {e.excerpt}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {expanded && days.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-2 w-full text-[11px] font-medium text-black/50 hover:text-black/80"
        >
          Show only recent updates
        </button>
      )}
    </div>
  );
}

function actorBadgeStyles(actor: JourneyActor): string {
  switch (actor) {
    case "you":      return "bg-orange-500";
    case "nex":      return "bg-neutral-800";
    case "merchant": return "bg-emerald-500";
    case "system":   return "bg-black/40";
  }
}
function actorBadgeInitial(actor: JourneyActor): string {
  switch (actor) {
    case "you":      return "Y";
    case "nex":      return "N";
    case "merchant": return "M";
    case "system":   return "·";
  }
}

function PurposeCard({ project }: { project: Project }) {
  // Philip 2026-08-02 · every project has a single-line purpose. Auto-
  // composed at create time · editable inline. Every future AI action
  // should reference this to stop conversations drifting.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.purpose ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(project.purpose ?? "");
  }, [project.purpose, editing]);

  const commit = async () => {
    const next = draft.trim().slice(0, 240);
    setSaving(true);
    try {
      await updatePurpose(project.id, next.length === 0 ? null : next);
      setEditing(false);
    } catch (err) {
      console.error("[nex-projects][purpose]", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-black/50" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-black/50">
          Purpose
        </span>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-black/50 hover:bg-black/[0.04] hover:text-black"
            aria-label="Edit purpose"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            maxLength={240}
            placeholder="What is this project for?"
            className="w-full resize-none rounded-xl border border-black/10 bg-white px-2.5 py-2 text-[13px] leading-snug text-black outline-none focus:border-orange-400"
            autoFocus
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-black/40">
              {draft.length}/240
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(project.purpose ?? "");
                }}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-medium text-black/70 hover:bg-black/[0.04]"
                disabled={saving}
              >
                <XIcon className="mr-1 inline h-3 w-3" />
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void commit()}
                disabled={saving}
                className="rounded-full bg-orange-500 px-3 py-1 text-[11px] font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                <Check className="mr-1 inline h-3 w-3" strokeWidth={2.5} />
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : project.purpose ? (
        <p className="mt-1.5 text-[13px] leading-snug text-black">
          {project.purpose}
        </p>
      ) : (
        <p className="mt-1.5 text-[13px] italic leading-snug text-black/40">
          No purpose set yet. Tap Edit to describe what this project is for.
        </p>
      )}
    </div>
  );
}

function ProjectPeople({ project }: { project: Project }) {
  // Philip 2026-08-02 · Nex is the PROJECT MANAGER, not just another
  // participant. Rendered above the human members section so the mental
  // model matches how Nex actually behaves (surfaces updates · nudges
  // stale merchants · summarises · maintains state).
  const nex = project.members.find((m) => m.role === "nex");
  const humans = project.members.filter((m) => m.role !== "nex");

  return (
    <div className="mt-3 space-y-2">
      {nex && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-orange-800">
            Project Manager
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-orange-900">
            <span
              aria-hidden="true"
              className="grid h-6 w-6 place-items-center rounded-full bg-orange-500 text-[11px] font-bold text-white"
            >
              N
            </span>
            {nex.display_name}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-black/50" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-black/50">
            Members
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {humans.map((m) => (
            <span
              key={m.role + m.display_name}
              className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-medium text-black/70"
            >
              {m.display_name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  text,
  at,
}: {
  role: "customer" | "nex" | "merchant";
  text: string;
  at: number;
}) {
  const isCustomer = role === "customer";
  const align = isCustomer ? "justify-end" : "justify-start";
  const bubble = isCustomer
    ? "bg-orange-500 text-white rounded-br-md"
    : role === "nex"
    ? "bg-neutral-100 text-black rounded-bl-md"
    : "bg-emerald-50 text-emerald-900 rounded-bl-md";
  const author = role === "nex" ? "Nex" : role === "merchant" ? "Merchant" : "You";
  return (
    <div className={`flex ${align}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${bubble}`}>
        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
          {author} · {formatRelativeTime(at)}
        </div>
        <div className="mt-0.5 whitespace-pre-wrap">{text}</div>
      </div>
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  tone,
}: {
  label: string;
  onClick: () => void;
  tone?: "danger";
}) {
  const className =
    tone === "danger"
      ? "block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
      : "block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-black/80 hover:bg-black/[0.04]";
  return (
    <button type="button" onClick={onClick} className={className}>
      {label}
    </button>
  );
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="h-12 border-b border-black/5 bg-white" />
      <div className="mx-auto max-w-md px-4 pt-4">
        <div className="h-24 animate-pulse rounded-2xl bg-white" />
        <div className="mt-3 h-12 animate-pulse rounded-2xl bg-white" />
        <div className="mt-3 h-64 animate-pulse rounded-2xl bg-white" />
      </div>
    </div>
  );
}
