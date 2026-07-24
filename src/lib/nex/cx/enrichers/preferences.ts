// Preferences enricher.
//
// Infers preferences from OBSERVED patterns in the contact's activity
// timeline. Every preference carries a reason ("5 of last 6 activities
// were on WhatsApp"). Nothing invented — if signal is thin, we return
// no preference (evidence-or-silence).

import type { ContactSummary } from "@/lib/crm/loadContactTimeline";
import { evidenceFor, type Preference } from "../types";

const DAY_MS = 86_400_000;

export function inferPreferences(summary: ContactSummary): Preference[] {
  const prefs: Preference[] = [];
  const ev = evidenceFor("timeline pattern inference", ["app_crm_activities"]);

  const activities = summary.timeline;
  const last12 = activities.slice(0, 12);
  if (last12.length < 3) return prefs;   // signal too thin to infer

  // 1. Preferred channel.
  const channelCounts = countBy(last12, (a) => channelFor(a.kind));
  const topChannel = Object.entries(channelCounts).sort((a, b) => b[1] - a[1])[0];
  if (topChannel && topChannel[1] >= Math.ceil(last12.length * 0.6) && topChannel[0] !== "other") {
    prefs.push({
      key:      `channel_${topChannel[0]}`,
      label:    `Prefers ${labelFor(topChannel[0])}`,
      strength: topChannel[1] === last12.length ? "strong" : "observed",
      reason:   `${topChannel[1]} of the last ${last12.length} activities were on ${labelFor(topChannel[0])}.`,
      evidence: ev
    });
  }

  // 2. Response speed — infer from quote_sent → quote_viewed lag.
  const sentTimes: Record<string, string> = {};
  const viewedTimes: Record<string, string> = {};
  for (const a of activities) {
    if (!a.sourceId) continue;
    if (a.kind === "quote_sent"   && !sentTimes[a.sourceId])   sentTimes[a.sourceId]   = a.occurredAt;
    if (a.kind === "quote_viewed" && !viewedTimes[a.sourceId]) viewedTimes[a.sourceId] = a.occurredAt;
  }
  const lags: number[] = [];
  for (const id of Object.keys(sentTimes)) {
    if (viewedTimes[id]) {
      lags.push((new Date(viewedTimes[id]).getTime() - new Date(sentTimes[id]).getTime()) / DAY_MS);
    }
  }
  if (lags.length >= 2) {
    const avgLag = Number((lags.reduce((s, n) => s + n, 0) / lags.length).toFixed(1));
    if (avgLag <= 1)   prefs.push({ key: "response_fast",   label: "Responds within a day",  strength: "observed", reason: `Averaged ${avgLag} days to open the last ${lags.length} quotes.`, evidence: ev });
    else if (avgLag >= 5) prefs.push({ key: "response_slow",   label: "Slow to reply",         strength: "observed", reason: `Averaged ${avgLag} days to open the last ${lags.length} quotes — chase early.`, evidence: ev });
  }

  // 3. Time-of-day preference.
  const hours = last12
    .map((a) => new Date(a.occurredAt).getUTCHours())
    .filter((h) => Number.isFinite(h));
  if (hours.length >= 5) {
    const evening = hours.filter((h) => h >= 17 || h < 6).length;
    const daytime = hours.length - evening;
    if (evening >= Math.ceil(hours.length * 0.7)) {
      prefs.push({ key: "time_evening", label: "Contacts in the evenings",  strength: "observed", reason: `${evening} of the last ${hours.length} activities landed after 5pm.`, evidence: ev });
    } else if (daytime >= Math.ceil(hours.length * 0.8)) {
      prefs.push({ key: "time_daytime", label: "Contacts in working hours", strength: "observed", reason: `${daytime} of the last ${hours.length} activities landed inside working hours.`, evidence: ev });
    }
  }

  // 4. Explicit notes from the contact (respected verbatim).
  const notes = summary.contact.notes ?? "";
  if (notes.trim().length > 0) {
    // Extract a first-line preference cue if it starts with "prefers"/"likes".
    const first = notes.split(/\r?\n/)[0].trim();
    if (/^(prefers|likes|wants|always)/i.test(first)) {
      prefs.push({
        key:      "note_pref",
        label:    first.slice(0, 100),
        strength: "strong",
        reason:   "From the merchant note on the contact record.",
        evidence: evidenceFor("app_crm_contacts.notes", ["app_crm_contacts"])
      });
    }
  }

  return prefs;
}

function channelFor(kind: string): string {
  if (kind === "whatsapp_sent") return "wa";
  if (kind === "email_sent")    return "email";
  if (kind === "call")          return "call";
  return "other";
}

function labelFor(ch: string): string {
  if (ch === "wa")    return "WhatsApp";
  if (ch === "email") return "email";
  if (ch === "call")  return "phone";
  return ch;
}

function countBy<T>(arr: T[], f: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of arr) {
    const k = f(x);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
