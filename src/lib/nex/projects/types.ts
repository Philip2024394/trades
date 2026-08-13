// Project Object types · Philip 2026-08-02.
//
// A Project is the primitive Nex gives users instead of a Conversation.
// Created immediately when a customer taps "Start Project" on a merchant
// profile. Members = You + Merchant + Nex from day one. Conversation,
// files, tasks, quotes, surveys, invoices all live INSIDE the project.
//
// v1 scope: customer-side localStorage store · no server persistence yet.
// Server persistence + merchant reply pipe land in v2 (Supabase table).
//
// The word "enquiry" NEVER surfaces in UI — the existing enquiry-state
// server workflow now lives internally within a Project (see conversation_id).

export type ProjectStatus =
  | "planning"                // Draft · not yet sent
  | "waiting_for_quotation"   // Customer opened, waiting on merchant
  | "quotation_received"      // Merchant has responded with quote
  | "agreed"                  // Customer accepted the quote
  | "in_progress"             // Work under way
  | "completed"               // Work done, awaiting review
  | "reviewed";               // Customer left review · project closed

export type ProjectIntent = "quote" | "survey" | "question" | "order" | "advice";

export type ProjectMemberRole = "customer" | "merchant" | "nex";

export type ProjectMember = {
  role: ProjectMemberRole;
  display_name: string;
  merchant_id?: string;
  avatar_url?: string;
};

export type ProjectMessageRole = "customer" | "nex" | "merchant";

export type ProjectMessage = {
  id: string;
  role: ProjectMessageRole;
  text: string;
  created_at: number;
};

export type Project = {
  id: string;
  title: string;
  // Philip 2026-08-02 · single-line purpose. What is this project FOR?
  // Every future AI action should reference this so conversations don't
  // drift. Nullable — auto-composed at create time when possible; editable
  // later. Examples:
  //   "Replace existing staircase with an oak cut-string staircase."
  //   "Build a business website for Hammerex."
  purpose?: string;
  status: ProjectStatus;
  merchant_id: string;
  merchant_name: string;
  merchant_avatar_url?: string;
  members: ProjectMember[];
  messages: ProjectMessage[];
  intent?: ProjectIntent;
  conversation_id?: string;   // Links to server-side enquiry-state workflow
  created_at: number;
  updated_at: number;
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning:              "Planning",
  waiting_for_quotation: "Waiting for quotation",
  quotation_received:    "Quotation received",
  agreed:                "Agreed",
  in_progress:           "In progress",
  completed:             "Completed",
  reviewed:              "Reviewed",
};

// Active statuses = still open, show in list. Terminal statuses = done.
export function isOpenStatus(status: ProjectStatus): boolean {
  return status !== "completed" && status !== "reviewed";
}
