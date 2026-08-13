// /nex-app/refacing/your-project/[rf_id] · V6 remediation.
//
// Resume surface · homeowner returns to their Refacing Case at any time.
// Stage 1 · C6 LOCKED: Case must be durable across sessions.
//
// This is a client-heavy page — reads the token from localStorage, fetches
// the Case, renders current state summary + honest next-action prompts.
//
// PR-16 truthfulness: the summary always shows what NEX has observed AND
// what remains unknown. Never claims more than the photo shows.

import type { Metadata } from "next";
import { YourProjectView } from "@/components/nex-app/refacing/YourProjectView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your Refacing Project · NEX",
  description: "Continue where you left off. Your staircase project with NEX.",
};

export default async function YourProjectPage({
  params,
}: {
  params: Promise<{ rf_id: string }>;
}) {
  const { rf_id } = await params;
  return <YourProjectView refacingCaseId={rf_id} />;
}
