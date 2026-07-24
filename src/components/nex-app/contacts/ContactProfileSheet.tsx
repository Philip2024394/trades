"use client";

// ContactProfileSheet — premium relationship profile panel. Opens
// as a bottom sheet, near-full height, containing:
//
//   1. Hero identity (large photo · name · type · location · online)
//   2. Tag chips
//   3. Action grid (Message · Call · Ask NEX · Share · Reminder · Meet)
//   4. NEX Relationship Memory card (shape-aware summary)
//   5. Private Notes (only visible to the user)
//   6. Activity Timeline (chronological events NEX has captured)
//
// This is the "premium AI relationship" replacement for a phone
// contact card — everything about the relationship in one calm,
// spacious surface. Dark charcoal + warm yellow accent + soft glass
// cards throughout.

import { useEffect } from "react";
import {
  X, Sparkles, MessageCircle, Phone, Share2, BellPlus, CalendarClock, MapPin,
  Bookmark, Handshake, MessageSquareQuote, FileText, Users, ArrowUpRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { DARK } from "./ContactsShell";
import type {
  PersonalContact, BusinessContact,
  PersonalMemory, TradeMemory, BusinessMemory,
  TimelineEvent, TimelineEventKind
} from "@/lib/nex/contacts/_types";

type Subject = PersonalContact | BusinessContact | null;

function isPersonal(s: NonNullable<Subject>): s is PersonalContact {
  return "connection_type" in s;
}

export function ContactProfileSheet({
  subject, onClose
}: {
  subject: Subject;
  onClose: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!subject) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [subject, onClose]);

  if (!subject) return null;

  const personal = isPersonal(subject);
  const subtitle = personal ? subject.connection_type : subject.category;
  const location = subject.location;

  function askNex() {
    const q = personal
      ? `Tell me about my relationship with ${subject.name}.`
      : `What do I know about ${subject.name}?`;
    router.push(`/nex-app/chat?q=${encodeURIComponent(q)}`);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${subject.name} profile`}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{
        background: "rgba(4, 4, 8, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)"
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-md flex-col rounded-t-3xl px-5 pb-10 pt-3"
        style={{
          background: "rgba(15, 15, 22, 0.94)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          borderTop: `1px solid ${DARK.border}`,
          boxShadow: "0 -20px 60px -20px rgba(251, 191, 36, 0.20)",
          maxHeight: "94vh",
          color: DARK.text
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full"
             style={{ background: DARK.border }} aria-hidden />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close profile"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full"
          style={{
            background: DARK.surfaceElev,
            color: DARK.text,
            border: `1px solid ${DARK.border}`
          }}
        >
          <X size={16} strokeWidth={2} />
        </button>

        <div className="overflow-y-auto pr-1">
          <IdentityBlock subject={subject} personal={personal} subtitle={subtitle} location={location} />
          <TagsRow tags={subject.tags} />
          <ActionsGrid onAskNex={askNex} />
          <RelationshipMemoryBlock memory={subject.memory} />
          <PrivateNotesBlock notes={subject.private_notes} />
          <TimelineBlock events={subject.timeline ?? []} />
        </div>
      </div>
    </div>
  );
}

// ── Hero identity ───────────────────────────────────────────────────

function IdentityBlock({
  subject, personal, subtitle, location
}: {
  subject: NonNullable<Subject>;
  personal: boolean;
  subtitle: string;
  location?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={`relative overflow-hidden ${personal ? "rounded-full" : "rounded-2xl"}`}
        style={{
          width: 108, height: 108,
          padding: 2,
          background: DARK.accentGrad,
          boxShadow: "0 20px 50px -20px rgba(251, 191, 36, 0.55)"
        }}
      >
        <div
          className={`h-full w-full overflow-hidden ${personal ? "rounded-full" : "rounded-[14px]"}`}
          style={{ background: DARK.surfaceSolid }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={subject.photo_url} alt="" className="h-full w-full object-cover" />
        </div>
        {personal && "online" in subject && subject.online && (
          <span
            aria-label="Online"
            className="absolute bottom-1 right-1 h-4 w-4 rounded-full"
            style={{ background: DARK.online, border: `2px solid ${DARK.bgSoft}` }}
          />
        )}
      </div>

      <h2 className="mt-4 text-[22px] font-black tracking-tight" style={{ color: DARK.text }}>
        {subject.name}
      </h2>
      <p className="mt-1 text-[12.5px]" style={{ color: DARK.textMuted }}>
        {subtitle}
      </p>
      {location && (
        <p className="mt-1.5 flex items-center gap-1 text-[11.5px]"
           style={{ color: DARK.textFaint }}>
          <MapPin size={12} strokeWidth={1.75} />
          {location}
        </p>
      )}
    </div>
  );
}

// ── Tags ────────────────────────────────────────────────────────────

function TagsRow({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
          style={{
            background: DARK.accentSoft,
            color: DARK.accent,
            border: `1px solid rgba(251, 191, 36, 0.20)`
          }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

// ── Actions grid ────────────────────────────────────────────────────

function ActionsGrid({ onAskNex }: { onAskNex: () => void }) {
  const items: {
    label: string; icon: typeof MessageCircle; onClick?: () => void; primary?: boolean;
  }[] = [
    { label: "Message",   icon: MessageCircle,     primary: true },
    { label: "Call",      icon: Phone },
    { label: "Ask NEX",   icon: Sparkles,          onClick: onAskNex, primary: true },
    { label: "Share",     icon: Share2 },
    { label: "Reminder",  icon: BellPlus },
    { label: "Meet",      icon: CalendarClock }
  ];

  return (
    <div className="mt-5 grid grid-cols-3 gap-2">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={it.onClick}
          className="flex flex-col items-center gap-1.5 rounded-xl py-3 transition-transform active:scale-[0.97]"
          style={{
            background: it.primary ? DARK.accentSoft : DARK.surfaceElev,
            border: `1px solid ${it.primary ? "rgba(251, 191, 36, 0.24)" : DARK.border}`,
            color: it.primary ? DARK.accent : DARK.text
          }}
        >
          <it.icon size={17} strokeWidth={1.9} />
          <span className="text-[10.5px] font-bold">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── NEX Relationship Memory ─────────────────────────────────────────

function RelationshipMemoryBlock({
  memory
}: {
  memory: PersonalMemory | TradeMemory | BusinessMemory | undefined;
}) {
  const rows = memoryRows(memory);
  return (
    <section className="mt-6">
      <header className="mb-2.5 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full text-[#141416]"
              style={{
                background: DARK.accentGrad,
                boxShadow: "0 4px 12px -4px rgba(251, 191, 36, 0.55)"
              }}>
          <Sparkles size={12} strokeWidth={2.25} />
        </span>
        <h3
          className="text-[11px] font-black uppercase tracking-[0.20em]"
          style={{
            background: DARK.accentGrad,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text"
          }}
        >
          NEX Relationship Memory
        </h3>
      </header>

      <div className="overflow-hidden rounded-2xl"
           style={{
             background: DARK.surface,
             backdropFilter: "blur(12px)",
             WebkitBackdropFilter: "blur(12px)",
             border: `1px solid ${DARK.border}`,
             boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 40px -24px rgba(251, 191, 36, 0.30)"
           }}>
        {rows.length === 0 ? (
          <div className="px-4 py-4 text-[12px]" style={{ color: DARK.textMuted }}>
            NEX will start remembering details as your relationship grows.
          </div>
        ) : (
          rows.map((r, i) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between gap-3 px-4 py-3.5"
              style={{ borderTop: i === 0 ? "none" : `1px solid ${DARK.border}` }}
            >
              <span className="text-[10.5px] font-bold uppercase tracking-wider"
                    style={{ color: DARK.textFaint }}>
                {r.label}
              </span>
              <span className="text-right text-[13.5px] font-semibold"
                    style={{ color: DARK.text }}>
                {r.value}
              </span>
            </div>
          ))
        )}
      </div>

      <p className="mt-2 px-1 text-[10.5px] leading-[1.5]"
         style={{ color: DARK.textFaint }}>
        Only visible to you. NEX uses these notes to help you pick up where you left off.
      </p>
    </section>
  );
}

type Row = { label: string; value: string };

function memoryRows(memory: PersonalMemory | TradeMemory | BusinessMemory | undefined): Row[] {
  const rows: Row[] = [];
  if (!memory) return rows;
  if (memory.kind === "personal") {
    rows.push({ label: "Connected", value: memory.connected_at });
    if (memory.first_conversation) rows.push({ label: "First conversation", value: memory.first_conversation });
    if (memory.shared)             rows.push({ label: "Shared",             value: memory.shared });
    if (typeof memory.message_count === "number") {
      rows.push({ label: "Previous messages", value: memory.message_count.toLocaleString("en-GB") });
    }
    return rows;
  }
  if (memory.kind === "trade") {
    if (memory.met_through) rows.push({ label: "Met through", value: memory.met_through });
    if (typeof memory.jobs_completed === "number") {
      rows.push({ label: "Jobs completed", value: memory.jobs_completed.toLocaleString("en-GB") });
    }
    if (memory.last_booking) rows.push({ label: "Last booking", value: memory.last_booking });
    return rows;
  }
  rows.push({ label: "First contacted", value: memory.first_contacted_at });
  if (typeof memory.enquiries_count === "number") {
    rows.push({ label: "Previous enquiries", value: memory.enquiries_count.toLocaleString("en-GB") });
  }
  if (typeof memory.last_quote_gbp === "number") {
    rows.push({ label: "Last quote", value: `£${memory.last_quote_gbp.toLocaleString("en-GB")}` });
  }
  return rows;
}

// ── Private Notes ───────────────────────────────────────────────────

function PrivateNotesBlock({ notes }: { notes?: string }) {
  const has = !!notes && notes.trim().length > 0;
  return (
    <section className="mt-6">
      <header className="mb-2.5 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full"
              style={{
                background: DARK.surfaceElev,
                border: `1px solid ${DARK.border}`,
                color: DARK.accent
              }}>
          <Bookmark size={12} strokeWidth={2} />
        </span>
        <h3 className="text-[11px] font-black uppercase tracking-[0.20em]"
            style={{ color: DARK.textMuted }}>
          Private Notes
        </h3>
      </header>
      <div className="rounded-2xl px-4 py-3.5"
           style={{
             background: DARK.surface,
             backdropFilter: "blur(12px)",
             WebkitBackdropFilter: "blur(12px)",
             border: `1px solid ${DARK.border}`
           }}>
        {has ? (
          <p className="text-[13px] leading-[1.55]" style={{ color: DARK.text }}>
            {notes}
          </p>
        ) : (
          <p className="text-[12px] leading-[1.55]" style={{ color: DARK.textFaint }}>
            Add notes only you can see — preferred contact style, likes, meeting context…
          </p>
        )}
      </div>
    </section>
  );
}

// ── Activity Timeline ───────────────────────────────────────────────

const TIMELINE_ICON: Record<TimelineEventKind, typeof MessageCircle> = {
  connected:    Handshake,
  discovered:   Sparkles,
  message:      MessageSquareQuote,
  quote:        FileText,
  booking:      CalendarClock,
  meeting:      CalendarClock,
  shared:       Share2,
  group_joined: Users,
  note_added:   Bookmark
};

function TimelineBlock({ events }: { events: TimelineEvent[] }) {
  return (
    <section className="mt-6">
      <header className="mb-2.5 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full"
              style={{
                background: DARK.surfaceElev,
                border: `1px solid ${DARK.border}`,
                color: DARK.accent
              }}>
          <ArrowUpRight size={12} strokeWidth={2} />
        </span>
        <h3 className="text-[11px] font-black uppercase tracking-[0.20em]"
            style={{ color: DARK.textMuted }}>
          NEX Timeline
        </h3>
      </header>

      <div className="rounded-2xl px-4 pb-4 pt-2"
           style={{
             background: DARK.surface,
             backdropFilter: "blur(12px)",
             WebkitBackdropFilter: "blur(12px)",
             border: `1px solid ${DARK.border}`
           }}>
        {events.length === 0 ? (
          <p className="py-3 text-[12px]" style={{ color: DARK.textFaint }}>
            No activity yet. Events NEX captures will appear here.
          </p>
        ) : (
          <ol className="relative ml-1 mt-1 border-l"
              style={{ borderColor: "rgba(251, 191, 36, 0.20)" }}>
            {events.map((e, i) => {
              const Icon = TIMELINE_ICON[e.kind] ?? MessageCircle;
              return (
                <li key={i} className="relative flex gap-3 pb-4 pl-6 last:pb-0">
                  <span
                    className="absolute -left-[13px] top-0 grid h-6 w-6 place-items-center rounded-full text-[#141416]"
                    style={{
                      background: DARK.accentGrad,
                      boxShadow: "0 4px 12px -4px rgba(251, 191, 36, 0.55)"
                    }}
                  >
                    <Icon size={11} strokeWidth={2.25} />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider"
                         style={{ color: DARK.accent }}>
                      {e.at}
                    </div>
                    <div className="mt-0.5 text-[12.5px] leading-snug"
                         style={{ color: DARK.text }}>
                      {e.label}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
