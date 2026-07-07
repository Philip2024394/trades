// Contact 360° detail — contact card + timeline + tasks + follow-up drafter.

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  MessageCircle,
  Phone,
  MapPin,
  Loader2,
  Wand2,
  Send,
  Plus,
  CheckCircle2,
  Sparkles,
  FileText,
  ClipboardCheck,
  Star,
  ShieldCheck,
  Clock,
  ExternalLink,
  StickyNote
} from "lucide-react";
import { SurfaceCard } from "@/platform/ui";
import type { ContactSummary, ContactTimelineItem } from "@/lib/crm/loadContactTimeline";

const KIND_META: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    tint: string;
  }
> = {
  contact_created: { label: "Contact added", icon: Plus, tint: "bg-neutral-100 text-neutral-800" },
  render: { label: "Render", icon: Sparkles, tint: "bg-amber-100 text-amber-900" },
  quote_drafted: { label: "Quote drafted", icon: FileText, tint: "bg-neutral-100 text-neutral-800" },
  quote_sent: { label: "Quote sent", icon: FileText, tint: "bg-blue-100 text-blue-800" },
  quote_viewed: { label: "Quote viewed", icon: FileText, tint: "bg-blue-100 text-blue-800" },
  quote_accepted: { label: "Quote accepted", icon: CheckCircle2, tint: "bg-emerald-100 text-emerald-800" },
  quote_rejected: { label: "Quote declined", icon: FileText, tint: "bg-red-100 text-red-800" },
  job_opened: { label: "Job opened", icon: ClipboardCheck, tint: "bg-blue-100 text-blue-800" },
  job_signed_off: { label: "Signed off", icon: CheckCircle2, tint: "bg-emerald-100 text-emerald-800" },
  job_entry: { label: "Diary entry", icon: ClipboardCheck, tint: "bg-neutral-100 text-neutral-800" },
  warranty_registered: { label: "Warranty", icon: ShieldCheck, tint: "bg-emerald-100 text-emerald-800" },
  review_posted: { label: "Review", icon: Star, tint: "bg-amber-100 text-amber-900" },
  review_responded: { label: "Response", icon: Star, tint: "bg-amber-100 text-amber-900" },
  note: { label: "Note", icon: StickyNote, tint: "bg-neutral-100 text-neutral-800" },
  whatsapp_sent: { label: "WhatsApp sent", icon: MessageCircle, tint: "bg-emerald-100 text-emerald-800" },
  email_sent: { label: "Email sent", icon: Mail, tint: "bg-neutral-100 text-neutral-800" },
  call: { label: "Call", icon: Phone, tint: "bg-neutral-100 text-neutral-800" },
  manual: { label: "Manual", icon: StickyNote, tint: "bg-neutral-100 text-neutral-800" }
};

export function ContactDetail({
  summary,
  merchantDisplayName
}: {
  summary: ContactSummary;
  merchantDisplayName: string;
}) {
  const [tasks, setTasks] = useState(summary.openTasks);
  const [timeline, setTimeline] = useState<ContactTimelineItem[]>(summary.timeline);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteHeadline, setNoteHeadline] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [taskSaving, setTaskSaving] = useState(false);
  const [draftedMessage, setDraftedMessage] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);

  const contact = summary.contact;
  const waDigits = contact.whatsappE164?.replace(/\D/g, "") || "";

  async function draftFollowUp() {
    setDrafting(true);
    try {
      const res = await fetch(
        `/api/apps/crm/contacts/${contact.id}/draft-follow-up`
      );
      const data: { ok: boolean; message?: string } = await res.json();
      if (data.ok && data.message) setDraftedMessage(data.message);
    } finally {
      setDrafting(false);
    }
  }

  async function saveNote(kind: string) {
    if (noteHeadline.trim().length < 2) return;
    setNoteSaving(true);
    try {
      await fetch(`/api/apps/crm/contacts/${contact.id}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          headline: noteHeadline.trim(),
          body: noteBody || null
        })
      });
      setTimeline((v) => [
        {
          kind: kind as ContactTimelineItem["kind"],
          occurredAt: new Date().toISOString(),
          headline: noteHeadline.trim(),
          body: noteBody || null
        },
        ...v
      ]);
      setNoteHeadline("");
      setNoteBody("");
      setNoteOpen(false);
    } finally {
      setNoteSaving(false);
    }
  }

  async function addTask() {
    if (taskTitle.trim().length < 2) return;
    setTaskSaving(true);
    try {
      const res = await fetch(`/api/apps/crm/contacts/${contact.id}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          dueAt: new Date(taskDueAt).toISOString()
        })
      });
      const data: { ok: boolean; taskId?: string } = await res.json();
      if (data.ok && data.taskId) {
        setTasks((v) => [
          ...v,
          {
            id: data.taskId as string,
            title: taskTitle.trim(),
            description: null,
            dueAt: new Date(taskDueAt).toISOString(),
            channelHint: null,
            status: "open"
          }
        ]);
        setTaskTitle("");
        setTaskOpen(false);
      }
    } finally {
      setTaskSaving(false);
    }
  }

  async function completeTask(taskId: string) {
    await fetch(
      `/api/apps/crm/contacts/${contact.id}/tasks/${taskId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "completed" })
      }
    );
    setTasks((v) => v.filter((t) => t.id !== taskId));
  }

  const waLink = waDigits && draftedMessage
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(draftedMessage)}`
    : waDigits
      ? `https://wa.me/${waDigits}`
      : null;

  return (
    <>
      <div className="mb-4">
        <Link
          href="/site-office/apps/crm"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to contacts
        </Link>
      </div>

      <header className="mb-4">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500 capitalize">
          {contact.lifecycleStage.replace(/_/g, " ")}
        </div>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">
          {contact.displayName}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2 text-[13px]">
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 font-semibold text-neutral-800 hover:border-neutral-400"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              {contact.email}
            </a>
          ) : null}
          {waDigits ? (
            <a
              href={`https://wa.me/${waDigits}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 font-semibold text-white hover:bg-emerald-500"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              WhatsApp
            </a>
          ) : null}
          {contact.postcode ? (
            <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 font-mono">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {contact.postcode}
            </span>
          ) : null}
        </div>
      </header>

      {/* AT-A-GLANCE TOTALS */}
      <div className="mb-4 grid grid-cols-3 gap-2 md:grid-cols-5">
        <StatCard label="Renders" value={summary.totals.renders} icon={Sparkles} />
        <StatCard label="Quotes sent" value={summary.totals.quotesSent} icon={FileText} />
        <StatCard label="Accepted" value={summary.totals.quotesAccepted} icon={CheckCircle2} />
        <StatCard label="Signed off" value={summary.totals.jobsSignedOff} icon={ClipboardCheck} />
        <StatCard label="Reviews" value={summary.totals.reviewsPosted} icon={Star} />
      </div>

      {/* FOLLOW-UP DRAFTER */}
      <SurfaceCard variant="highlight" padding="md" className="mb-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-amber-900">
          <Wand2 className="h-3.5 w-3.5" aria-hidden />
          Follow up
        </div>
        {!draftedMessage ? (
          <button
            type="button"
            onClick={draftFollowUp}
            disabled={drafting}
            className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[13px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {drafting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Wand2 className="h-3.5 w-3.5" aria-hidden />
            )}
            Draft a message
          </button>
        ) : (
          <>
            <textarea
              value={draftedMessage}
              onChange={(e) => setDraftedMessage(e.target.value)}
              rows={4}
              className="mt-2 block w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-[14px] text-neutral-900"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    void fetch(`/api/apps/crm/contacts/${contact.id}/notes`, {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        kind: "whatsapp_sent",
                        headline: "Follow-up WhatsApp sent",
                        body: draftedMessage
                      })
                    })
                  }
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[13px] font-semibold text-white hover:bg-emerald-500"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  Send on WhatsApp
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => setDraftedMessage(null)}
                className="inline-flex min-h-[40px] items-center gap-1 text-[13px] font-semibold text-neutral-600 hover:text-neutral-900"
              >
                Redraft
              </button>
            </div>
          </>
        )}
      </SurfaceCard>

      {/* OPEN TASKS */}
      <SurfaceCard variant="primary" padding="md" className="mb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            Follow-ups ({tasks.length})
          </div>
          <button
            type="button"
            onClick={() => setTaskOpen((v) => !v)}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 text-[13px] font-semibold text-neutral-700 hover:border-neutral-400"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Add
          </button>
        </div>
        {taskOpen ? (
          <div className="mb-3 space-y-2">
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Chase kitchen quote"
              className="block min-h-[36px] w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px]"
            />
            <input
              type="date"
              value={taskDueAt}
              onChange={(e) => setTaskDueAt(e.target.value)}
              className="block min-h-[36px] w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px]"
            />
            <button
              type="button"
              onClick={addTask}
              disabled={taskSaving}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-neutral-900 px-3 text-[13px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {taskSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : null}
              Save task
            </button>
          </div>
        ) : null}
        {tasks.length === 0 ? (
          <p className="text-[13px] text-neutral-500">Nothing due.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <div className="text-[14px] font-semibold text-neutral-900">
                    {t.title}
                  </div>
                  <div className="text-[13px] text-neutral-500">
                    Due{" "}
                    {new Date(t.dueAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short"
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => completeTask(t.id)}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 text-[13px] font-semibold text-neutral-700 hover:border-neutral-400"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Done
                </button>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>

      {/* NOTE COMPOSER */}
      <SurfaceCard variant="primary" padding="md" className="mb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            Log an interaction
          </div>
          <button
            type="button"
            onClick={() => setNoteOpen((v) => !v)}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 text-[13px] font-semibold text-neutral-700 hover:border-neutral-400"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Add
          </button>
        </div>
        {noteOpen ? (
          <div className="space-y-2">
            <input
              value={noteHeadline}
              onChange={(e) => setNoteHeadline(e.target.value)}
              placeholder="Short headline (e.g. Chased on WhatsApp)"
              className="block min-h-[40px] w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px]"
            />
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              rows={3}
              placeholder="Optional detail"
              className="block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px]"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => saveNote("note")}
                disabled={noteSaving}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-neutral-900 px-3 text-[13px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {noteSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <StickyNote className="h-3.5 w-3.5" aria-hidden />
                )}
                Note
              </button>
              <button
                type="button"
                onClick={() => saveNote("call")}
                disabled={noteSaving}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-700 hover:border-neutral-400"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden />
                Call
              </button>
              <button
                type="button"
                onClick={() => saveNote("whatsapp_sent")}
                disabled={noteSaving}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-700 hover:border-neutral-400"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                WA
              </button>
              <button
                type="button"
                onClick={() => saveNote("email_sent")}
                disabled={noteSaving}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-700 hover:border-neutral-400"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden />
                Email
              </button>
            </div>
          </div>
        ) : null}
      </SurfaceCard>

      {/* TIMELINE */}
      <section>
        <h2 className="mb-3 text-xl font-semibold">Timeline</h2>
        {timeline.length === 0 ? (
          <SurfaceCard variant="secondary" padding="md">
            <p className="text-[13px] text-neutral-500">
              No activity yet. As soon as this contact renders, gets a
              quote, or you log an interaction, it shows here.
            </p>
          </SurfaceCard>
        ) : (
          <ol className="relative ml-4 border-l-2 border-neutral-200">
            {timeline.map((e, i) => {
              const meta = KIND_META[e.kind] || KIND_META.note;
              const Icon = meta.icon;
              const deepLink = sourceLink(e);
              return (
                <li key={`${e.kind}-${e.occurredAt}-${i}`} className="mb-4 ml-4">
                  <span className="absolute -left-[7px] mt-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-neutral-900" />
                  <div className="flex items-center gap-2 text-[13px] text-neutral-500">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-semibold ${meta.tint}`}
                    >
                      <Icon className="h-3 w-3" aria-hidden />
                      {meta.label}
                    </span>
                    <span>
                      {new Date(e.occurredAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[14px] font-semibold text-neutral-900">
                    <span>{e.headline}</span>
                    {deepLink ? (
                      <Link
                        href={deepLink}
                        className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-neutral-500 hover:text-neutral-900"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden />
                      </Link>
                    ) : null}
                  </div>
                  {e.body ? (
                    <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-neutral-700">
                      {e.body}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}

function StatCard({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  return (
    <SurfaceCard variant="primary" padding="sm">
      <div className="flex items-center gap-1 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </SurfaceCard>
  );
}

function sourceLink(e: ContactTimelineItem): string | null {
  if (!e.sourceApp || !e.sourceId) return null;
  switch (e.sourceApp) {
    case "quote-workspace":
      return `/site-office/apps/quote-workspace/${e.sourceId}`;
    case "job-diary":
      return `/site-office/apps/job-diary/${e.sourceId}`;
    case "reviews":
      return `/site-office/apps/reviews`;
    default:
      return null;
  }
}
