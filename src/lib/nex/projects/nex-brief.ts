"use client";

// Nex-authored project brief · Philip 2026-08-02.
//
// This is the "Alive Project Manager" logic (Big Win #2). Given a Project
// object, compose a short honest status brief that answers three questions
// on the detail page:
//
//   1. Where does this project stand right now?
//   2. Who is Nex waiting on?
//   3. What (if anything) should the user do next?
//
// Deliberate constraints (Third Law · Truth):
//   - v1 is DETERMINISTIC · no LLM call · pure function of Project state.
//     Zero hallucination risk. Works offline.
//   - Every claim comes from a real signal (timestamps · status · role of
//     last message). No fabricated merchant promises.
//   - Language separates FACT (times · statuses) from EXPECTATION
//     ("most merchants reply within a working day") so users can tell
//     the difference.
//   - Never invents a merchant reply · never guarantees a response time.

import type { Project } from "./types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type NexBriefTone = "info" | "waiting" | "action" | "celebrate";

export type NexBriefAction = {
  label: string;
  kind: "focus_latest" | "draft_followup" | "leave_review";
};

export type NexBrief = {
  tone: NexBriefTone;
  headline: string;
  detail: string;
  facts: string[];         // hard facts pulled from the project (Third Law)
  expectation?: string;    // Nex-labelled expectation (soft signal)
  action?: NexBriefAction;
};

export function composeNexBrief(project: Project): NexBrief {
  const now = Date.now();
  const lastCustomer = lastMessageOfRole(project, "customer");
  const lastMerchant = lastMessageOfRole(project, "merchant");
  const sinceLastCustomer = lastCustomer ? now - lastCustomer.created_at : null;
  const sinceProjectStart = now - project.created_at;
  const facts = collectFacts(project, sinceLastCustomer, sinceProjectStart);

  switch (project.status) {
    case "planning":
      return {
        tone: "info",
        headline: "Draft project",
        detail: `This project isn't sent to ${project.merchant_name} yet. When you're ready, open Nex Chat and send your first message to kick it off.`,
        facts,
      };

    case "waiting_for_quotation":
      return briefForWaiting(project, facts, sinceLastCustomer);

    case "quotation_received":
      return {
        tone: "action",
        headline: "Quote received",
        detail: `${project.merchant_name} has sent through a quote. Take a look and let them know if you'd like to go ahead.`,
        facts,
        action: { label: "Read the latest message", kind: "focus_latest" },
      };

    case "agreed":
      return {
        tone: "info",
        headline: "Agreed",
        detail: `You've accepted ${project.merchant_name}'s quote. The next milestone is usually a site survey — Nex will highlight the date once it lands.`,
        facts,
      };

    case "in_progress":
      return {
        tone: "info",
        headline: "Work under way",
        detail: `${project.merchant_name} is progressing your project. Nex will surface updates here as they land — no action needed from you right now.`,
        facts,
      };

    case "completed":
      return {
        tone: "celebrate",
        headline: "Job complete",
        detail: `The work with ${project.merchant_name} is done. When you're ready, leaving a short review helps other homeowners find good trades.`,
        facts,
        action: { label: "Leave a review", kind: "leave_review" },
      };

    case "reviewed":
      return {
        tone: "info",
        headline: "Project closed",
        detail: `Reviewed and archived. The full history stays here in case you need it again.`,
        facts,
      };
  }
}

// ─── Waiting-for-quotation logic (the richest branch) ────────────────

function briefForWaiting(
  project: Project,
  facts: string[],
  sinceLastCustomer: number | null,
): NexBrief {
  // Have we heard from the merchant since the customer's last message?
  const merchantHasReplied = hasMerchantRepliedSinceLastCustomer(project);
  if (merchantHasReplied) {
    return {
      tone: "action",
      headline: "New reply from the merchant",
      detail: `${project.merchant_name} has responded. Take a look and reply when you're ready.`,
      facts,
      action: { label: "Read the latest message", kind: "focus_latest" },
    };
  }

  // No merchant reply · how long since the customer sent something?
  if (sinceLastCustomer === null) {
    return {
      tone: "info",
      headline: "Ready to start",
      detail: `Open Nex Chat when you're ready to send your first message to ${project.merchant_name}.`,
      facts,
    };
  }

  if (sinceLastCustomer < 6 * HOUR) {
    return {
      tone: "waiting",
      headline: "Just sent — no action needed",
      detail: `Your message to ${project.merchant_name} is fresh. Nothing more to do right now.`,
      facts,
      expectation: "Most UK trades reply within a working day. Nex will nudge you if it starts to feel long.",
    };
  }

  if (sinceLastCustomer < 2 * DAY) {
    return {
      tone: "waiting",
      headline: `Waiting on ${project.merchant_name}`,
      detail: `You sent your message ${humanDuration(sinceLastCustomer)} ago. This is still well within normal reply time.`,
      facts,
      expectation: "A working day is typical. Nex will suggest a follow-up if the gap grows.",
    };
  }

  if (sinceLastCustomer < 5 * DAY) {
    return {
      tone: "action",
      headline: `It's been ${humanDuration(sinceLastCustomer)} — worth a nudge?`,
      detail: `${project.merchant_name} hasn't replied since your last message. A short friendly follow-up often unblocks the conversation.`,
      facts,
      expectation: "Some trades run 2–3 day reply cycles, especially during busy seasons.",
      action: { label: "Draft a follow-up", kind: "draft_followup" },
    };
  }

  return {
    tone: "action",
    headline: `${humanDuration(sinceLastCustomer)} without a reply`,
    detail: `${project.merchant_name} hasn't come back to you in a while. If you don't hear back soon, it might be worth speaking to another trade in parallel.`,
    facts,
    expectation: "5+ days is longer than most trades take. Nex isn't inside their inbox — they might just be busy.",
    action: { label: "Draft a follow-up", kind: "draft_followup" },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

function lastMessageOfRole(project: Project, role: "customer" | "merchant" | "nex") {
  for (let i = project.messages.length - 1; i >= 0; i--) {
    if (project.messages[i].role === role) return project.messages[i];
  }
  return null;
}

function hasMerchantRepliedSinceLastCustomer(project: Project): boolean {
  const lastCustomer = lastMessageOfRole(project, "customer");
  if (!lastCustomer) return false;
  return project.messages.some(
    (m) => m.role === "merchant" && m.created_at > lastCustomer.created_at,
  );
}

function collectFacts(
  project: Project,
  sinceLastCustomer: number | null,
  sinceProjectStart: number,
): string[] {
  const facts: string[] = [];
  facts.push(`Project started ${humanDuration(sinceProjectStart)} ago`);
  if (sinceLastCustomer !== null) {
    facts.push(`Last message from you: ${humanDuration(sinceLastCustomer)} ago`);
  }
  const customerCount = project.messages.filter((m) => m.role === "customer").length;
  const merchantCount = project.messages.filter((m) => m.role === "merchant").length;
  const nexCount = project.messages.filter((m) => m.role === "nex").length;
  if (customerCount + merchantCount + nexCount > 0) {
    facts.push(`${customerCount + merchantCount + nexCount} messages in this thread`);
  }
  return facts;
}

function humanDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return "less than a minute";
  const m = Math.floor(s / 60);
  if (m < 60) return m === 1 ? "1 minute" : `${m} minutes`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? "1 hour" : `${h} hours`;
  const d = Math.floor(h / 24);
  if (d < 7) return d === 1 ? "1 day" : `${d} days`;
  const w = Math.floor(d / 7);
  return w === 1 ? "1 week" : `${w} weeks`;
}
