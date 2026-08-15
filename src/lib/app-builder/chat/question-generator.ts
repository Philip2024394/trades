// NEX App Builder · Chat · Question generator (Philip 2026-08-14).
//
// Takes a Blueprint + validation result → produces the next human-friendly
// question NEX should ask.
//
// Rule: NO technical language. Never "identity.displayName REQUIRED".
// Always plain English the customer will understand.

import type { AppBlueprint } from "../blueprint-schema";
import { runValidationWorker } from "../workers/validation-worker";

export type ChatQuestion = {
  /** The Blueprint field path this question fills. */
  fieldPath: string;
  /** Plain-English question shown to the customer. */
  text: string;
  /** Placeholder shown in the input field. */
  placeholder?: string;
  /** Input hint (email/tel/number/text). */
  inputKind: "text" | "email" | "tel" | "number" | "postcode" | "textarea";
  /** Optional validation regex to reject obviously-wrong answers client-side. */
  clientRegex?: string;
};

const QUESTION_MAP: Record<string, Omit<ChatQuestion, "fieldPath">> = {
  "identity.displayName": {
    text: "What's the company name?",
    placeholder: "e.g. Rowan Architectural Staircases",
    inputKind: "text"
  },
  "identity.contact.primaryEmail": {
    text: "What email address should customer enquiries go to?",
    placeholder: "hello@yourcompany.co.uk",
    inputKind: "email",
    clientRegex: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"
  },
  "identity.contact.primaryPhone": {
    text: "What phone number should customers use?",
    placeholder: "020 7946 0000",
    inputKind: "tel"
  },
  "identity.contact.serviceRadius.centre": {
    text: "What's the postcode you work from?",
    placeholder: "SW1A 1AA",
    inputKind: "postcode",
    clientRegex: "^[A-Za-z]{1,2}[0-9][A-Za-z0-9]?\\s?[0-9][A-Za-z]{2}$"
  },
  "identity.contact.serviceRadius.radiusMiles": {
    text: "How many miles from that postcode do you cover?",
    placeholder: "25",
    inputKind: "number"
  },
  "brand.palette.primary": {
    text: "What's your brand's primary colour? (hex like #8b5a2b works)",
    placeholder: "#8b5a2b",
    inputKind: "text",
    clientRegex: "^#[0-9a-fA-F]{6}$"
  }
};

/** Generate the next question (or null when nothing missing). */
export function generateNextQuestion(bp: AppBlueprint): ChatQuestion | null {
  const validation = runValidationWorker({ runId: "chat_analyze", blueprint: bp });
  const requiredFacts = validation.data.requiredFacts;

  if (requiredFacts.length === 0) return null;

  // Ask in a sensible order: company name → contact → radius → brand
  const priorityOrder = [
    "identity.displayName",
    "identity.contact.primaryPhone",
    "identity.contact.primaryEmail",
    "identity.contact.serviceRadius.centre",
    "identity.contact.serviceRadius.radiusMiles",
    "brand.palette.primary"
  ];

  for (const path of priorityOrder) {
    if (requiredFacts.some((f) => f.path === path)) {
      const meta = QUESTION_MAP[path];
      if (meta) return { fieldPath: path, ...meta };
    }
  }

  // Fallback for any unrecognised REQUIRED field — surface generically
  // (must NOT be technical wording · translate the path)
  const first = requiredFacts[0];
  return {
    fieldPath: first.path,
    text: `We still need: ${humaniseUnknownPath(first.path)}`,
    inputKind: "text"
  };
}

function humaniseUnknownPath(path: string): string {
  return path
    .replace(/^identity\./, "")
    .replace(/\./g, " › ")
    .replace(/[A-Z]/g, (m) => " " + m.toLowerCase())
    .trim();
}
