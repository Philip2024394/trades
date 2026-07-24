"use client";

// CreateGroupModal — 4-step wizard for spinning up a new group.
// Step 1 · Type · pick one of 5 group types
// Step 2 · Members · multi-select from personal contacts
// Step 3 · Name · give the group a name
// Step 4 · Create · confirm + summary
// V1 stops at console.info() so the surface is fully clickable
// while the backing service is designed.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Users, Briefcase, Heart, Globe, Hammer, X } from "lucide-react";
import { DARK } from "./ContactsShell";
import type { PersonalContact, GroupType } from "@/lib/nex/contacts/_types";

const TYPES: { id: GroupType; label: string; icon: typeof Users; hint: string; color: string }[] = [
  { id: "friends",   label: "Friends",    icon: Users,     hint: "Casual circle for chat + plans",   color: "#60A5FA" },
  { id: "family",    label: "Family",     icon: Heart,     hint: "Close family only",                color: "#F472B6" },
  { id: "business",  label: "Business",   icon: Briefcase, hint: "Colleagues, suppliers, partners",  color: "#FBBF24" },
  { id: "community", label: "Community",  icon: Globe,     hint: "Local groups + shared interests",  color: "#34D399" },
  { id: "project",   label: "Project",    icon: Hammer,    hint: "Time-bound working group",         color: "#A78BFA" }
];

export function CreateGroupModal({
  open, onClose, contacts
}: {
  open: boolean;
  onClose: () => void;
  contacts: PersonalContact[];
}) {
  const [step, setStep]         = useState(0);
  const [type, setType]         = useState<GroupType | null>(null);
  const [members, setMembers]   = useState<Set<string>>(new Set());
  const [name, setName]         = useState("");
  const [done, setDone]         = useState(false);

  useEffect(() => {
    if (open) { setStep(0); setType(null); setMembers(new Set()); setName(""); setDone(false); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const canAdvance = useMemo(() => {
    if (step === 0) return type !== null;
    if (step === 1) return members.size >= 1;
    if (step === 2) return name.trim().length >= 2;
    return true;
  }, [step, type, members, name]);

  function toggleMember(id: string) {
    setMembers((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function submit() {
    // eslint-disable-next-line no-console
    console.info("[contacts:create-group]", {
      type, member_ids: [...members], name: name.trim()
    });
    setDone(true);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create group"
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
        className="relative flex w-full max-w-md flex-col rounded-t-3xl px-5 pb-8 pt-3"
        style={{
          background: "rgba(15, 15, 22, 0.94)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          borderTop: `1px solid ${DARK.border}`,
          boxShadow: "0 -20px 60px -20px rgba(251, 191, 36, 0.25)",
          color: DARK.text,
          minHeight: "72vh"
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: DARK.borderStrong }} aria-hidden />

        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            aria-label={step === 0 ? "Close" : "Back"}
            className="grid h-9 w-9 place-items-center rounded-full"
            style={{
              background: DARK.surfaceElev,
              color: DARK.text,
              border: `1px solid ${DARK.border}`
            }}
          >
            {step === 0 ? <X size={16} strokeWidth={2} /> : <ArrowLeft size={16} strokeWidth={2} />}
          </button>
          <div
            className="text-[10px] font-black uppercase tracking-[0.32em]"
            style={{
              background: DARK.accentGrad,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text"
            }}
          >
            Step {step + 1} of 4
          </div>
          <div className="w-9" />
        </header>

        <div className="mt-2 flex gap-1">
          {[0,1,2,3].map((i) => (
            <div key={i} className="h-1 flex-1 rounded-full"
                 style={{ background: i <= step ? DARK.accentGrad : DARK.border }} />
          ))}
        </div>

        <div className="mt-5 flex-1 overflow-y-auto">
          {done
            ? <DoneScreen name={name} count={members.size} />
            : step === 0
            ? <StepType type={type} onPick={setType} />
            : step === 1
            ? <StepMembers contacts={contacts} selected={members} onToggle={toggleMember} />
            : step === 2
            ? <StepName name={name} onChange={setName} />
            : <StepReview type={type} members={members} name={name} contacts={contacts} />}
        </div>

        {!done && (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => (step === 3 ? submit() : setStep((s) => s + 1))}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-[13px] font-black text-white transition-transform active:scale-[0.98] disabled:opacity-40"
            style={{
              background: DARK.accentGrad,
              boxShadow: "0 12px 32px -8px rgba(251, 191, 36, 0.55)"
            }}
          >
            {step === 3 ? "Create Group" : "Continue"}
            {step !== 3 && <ArrowRight size={15} strokeWidth={2.5} />}
          </button>
        )}
        {done && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-[13px] font-black text-white"
            style={{
              background: DARK.accentGrad,
              boxShadow: "0 12px 32px -8px rgba(251, 191, 36, 0.55)"
            }}
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}

// ── Steps ────────────────────────────────────────────────────────────

function StepType({ type, onPick }: { type: GroupType | null; onPick: (t: GroupType) => void }) {
  return (
    <div>
      <h2 className="text-[18px] font-black" style={{ color: DARK.text }}>
        What kind of group?
      </h2>
      <p className="mt-1 text-[12px]" style={{ color: DARK.textMuted }}>
        This sets defaults for privacy and notifications. You can change it later.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {TYPES.map((t) => {
          const active = type === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t.id)}
              className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-transform active:scale-[0.98]"
              style={{
                background: active ? DARK.accentSoft : DARK.surfaceElev,
                border: `1px solid ${active ? DARK.borderStrong : DARK.border}`,
                boxShadow: active ? "0 8px 20px -12px rgba(245, 158, 11, 0.45)" : undefined
              }}
              aria-pressed={active}
            >
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl"
                    style={{ background: `${t.color}18`, color: t.color }}>
                <t.icon size={18} strokeWidth={1.75} />
              </span>
              <span className="flex flex-1 flex-col leading-tight">
                <span className="text-[13px] font-bold" style={{ color: DARK.text }}>{t.label}</span>
                <span className="mt-0.5 text-[11px]" style={{ color: DARK.textMuted }}>{t.hint}</span>
              </span>
              {active && <Check size={16} strokeWidth={2.5} style={{ color: DARK.accent }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepMembers({
  contacts, selected, onToggle
}: {
  contacts: PersonalContact[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="text-[18px] font-black" style={{ color: DARK.text }}>
        Who&apos;s in it?
      </h2>
      <p className="mt-1 text-[12px]" style={{ color: DARK.textMuted }}>
        Pick from your personal contacts. You can add more later.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {contacts.map((c) => {
          const active = selected.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggle(c.id)}
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-transform active:scale-[0.98]"
              style={{
                background: active ? DARK.accentSoft : DARK.surfaceElev,
                border: `1px solid ${active ? DARK.borderStrong : DARK.border}`,
                boxShadow: active ? "0 8px 20px -12px rgba(245, 158, 11, 0.45)" : undefined
              }}
              aria-pressed={active}
            >
              <span className="grid h-10 w-10 flex-shrink-0 overflow-hidden rounded-full"
                    style={{ background: DARK.border }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.photo_url} alt="" className="h-full w-full object-cover" />
              </span>
              <span className="flex flex-1 flex-col leading-tight">
                <span className="text-[13px] font-bold" style={{ color: DARK.text }}>{c.name}</span>
                <span className="mt-0.5 text-[11px]" style={{ color: DARK.textMuted }}>{c.connection_type}</span>
              </span>
              <span className="grid h-6 w-6 place-items-center rounded-full text-white"
                    style={{
                      background: active ? DARK.accentGrad : "transparent",
                      border: `1px solid ${active ? "transparent" : DARK.border}`
                    }}>
                {active && <Check size={13} strokeWidth={2.75} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepName({ name, onChange }: { name: string; onChange: (v: string) => void }) {
  return (
    <div>
      <h2 className="text-[18px] font-black" style={{ color: DARK.text }}>
        Give it a name.
      </h2>
      <p className="mt-1 text-[12px]" style={{ color: DARK.textMuted }}>
        Something the members will recognise instantly.
      </p>
      <input
        autoFocus
        value={name}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Salford Loft Project"
        className="mt-4 w-full rounded-2xl px-4 py-3 text-[14px] outline-none"
        style={{
          background: DARK.surfaceElev,
          border: `1px solid ${DARK.border}`,
          color: DARK.text
        }}
      />
    </div>
  );
}

function StepReview({
  type, members, name, contacts
}: {
  type: GroupType | null;
  members: Set<string>;
  name: string;
  contacts: PersonalContact[];
}) {
  const typeMeta = TYPES.find((t) => t.id === type);
  const memberList = contacts.filter((c) => members.has(c.id));
  return (
    <div>
      <h2 className="text-[18px] font-black" style={{ color: DARK.text }}>
        Looking good.
      </h2>
      <p className="mt-1 text-[12px]" style={{ color: DARK.textMuted }}>
        Confirm and we&apos;ll create it.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <ReviewRow label="Name"    value={name} />
        <ReviewRow label="Type"    value={typeMeta?.label ?? "—"} color={typeMeta?.color} />
        <ReviewRow label="Members" value={`${memberList.length} · ${memberList.map((c) => c.name.split(" ")[0]).join(", ")}`} />
      </div>
    </div>
  );
}

function ReviewRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl px-4 py-3"
         style={{ background: DARK.surfaceElev, border: `1px solid ${DARK.border}` }}>
      <div className="text-[10px] font-black uppercase tracking-widest"
           style={{ color: DARK.textFaint }}>
        {label}
      </div>
      <div className="mt-1 text-[13px] font-semibold"
           style={{ color: color ?? DARK.text }}>
        {value}
      </div>
    </div>
  );
}

function DoneScreen({ name, count }: { name: string; count: number }) {
  return (
    <div className="mt-6 flex flex-col items-center text-center">
      <span
        className="mb-4 grid h-16 w-16 place-items-center rounded-full text-white"
        style={{
          background: DARK.accentGrad,
          boxShadow: "0 12px 32px -8px rgba(251, 191, 36, 0.55)"
        }}
        aria-hidden
      >
        <Check size={30} strokeWidth={2.5} />
      </span>
      <h2 className="text-[19px] font-black" style={{ color: DARK.text }}>
        {name.trim() || "Group"} created.
      </h2>
      <p className="mt-2 max-w-xs text-[12.5px] leading-[1.5]" style={{ color: DARK.textMuted }}>
        {count} member{count === 1 ? "" : "s"} invited. They&apos;ll see the group in their
        Contacts as soon as they accept.
      </p>
    </div>
  );
}
