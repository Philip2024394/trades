"use client";

// Nex Project Journey · Philip 2026-08-02.
//
// The user-facing timeline for a Project. Deliberately named "journey"
// and phrased in human language throughout — NEVER "event log", "activity
// stream", "workflow history" or any CRM vocabulary. Nex is for normal
// people, not enterprise ops teams.
//
// Third-Law honest by design:
//   - Deterministic composition from project state · zero LLM
//   - Every entry references a real signal (creation time · message time)
//   - No fabricated milestones · no invented statuses
//   - Message excerpts are quoted verbatim · trimmed only for length
//
// Philip's verbatim label rules:
//   ✅ "Project started" · "You sent a message" · "Nex replied" ·
//      "Merchant replied" · "You added a photo" (future) ·
//      "Nex suggested a follow-up"
//   ❌ Never "event", "log", "record", "workflow", "activity"

import type { Project, ProjectMessageRole } from "./types";

export type JourneyActor = "you" | "nex" | "merchant" | "system";

export type JourneyEntry = {
  id: string;
  timestamp: number;
  actor: JourneyActor;
  headline: string;   // one-line human label
  excerpt?: string;   // optional short quote from the underlying message
};

const MAX_EXCERPT_CHARS = 90;

export function composeProjectJourney(project: Project): JourneyEntry[] {
  const entries: JourneyEntry[] = [];

  // 1. Project started
  entries.push({
    id: `${project.id}::started`,
    timestamp: project.created_at,
    actor: "you",
    headline: "Project started",
    excerpt: `with ${project.merchant_name}`,
  });

  // 2. Purpose recorded (only if set close to creation · avoid double-counting edits)
  if (project.purpose) {
    entries.push({
      id: `${project.id}::purpose`,
      timestamp: project.created_at + 1,
      actor: "you",
      headline: "You described your goal",
      excerpt: trim(project.purpose),
    });
  }

  // 3. Each message · in chronological order
  for (const m of project.messages) {
    entries.push({
      id: m.id,
      timestamp: m.created_at,
      actor: roleToActor(m.role),
      headline: headlineFor(m.role),
      excerpt: trim(m.text),
    });
  }

  entries.sort((a, b) => a.timestamp - b.timestamp);
  return entries;
}

function roleToActor(role: ProjectMessageRole): JourneyActor {
  switch (role) {
    case "customer": return "you";
    case "nex":      return "nex";
    case "merchant": return "merchant";
  }
}

function headlineFor(role: ProjectMessageRole): string {
  switch (role) {
    case "customer": return "You sent a message";
    case "nex":      return "Nex replied";
    case "merchant": return `Reply from the merchant`;
  }
}

function trim(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= MAX_EXCERPT_CHARS) return cleaned;
  return cleaned.slice(0, MAX_EXCERPT_CHARS - 1).trimEnd() + "…";
}

// ─── Grouping by day (for readable rendering) ────────────────────────

export type JourneyDay = {
  dayKey: string;        // "2026-08-02"
  dayLabel: string;      // "Today" · "Yesterday" · "Sat, 2 Aug"
  entries: JourneyEntry[];
};

export function groupJourneyByDay(entries: JourneyEntry[]): JourneyDay[] {
  if (entries.length === 0) return [];
  const byKey = new Map<string, JourneyEntry[]>();
  for (const e of entries) {
    const key = dayKeyOf(e.timestamp);
    const arr = byKey.get(key) ?? [];
    arr.push(e);
    byKey.set(key, arr);
  }

  const days: JourneyDay[] = [];
  for (const [key, es] of byKey) {
    days.push({
      dayKey: key,
      dayLabel: dayLabelFor(key),
      entries: es,
    });
  }
  days.sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  return days;
}

function dayKeyOf(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabelFor(key: string): string {
  const now = new Date();
  const todayKey = dayKeyOf(now.getTime());
  const yesterdayKey = dayKeyOf(now.getTime() - 24 * 60 * 60 * 1000);
  if (key === todayKey) return "Today";
  if (key === yesterdayKey) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
