// Studio AI playground — live demo of the compose + mutate endpoints.
//
// A single page where merchants (or Philip / the team) can test the
// Lovable-parity behaviour end-to-end BEFORE it's wired into the
// full editor. Type an intent → get a section proposal. Iterate with
// mutation prompts.
//
// This is Path B Day 3a. Day 3b (full editor integration) hooks the
// same client calls into the Studio's tree bus + autosave.

import { StudioAiPlayground } from "@/components/studio/StudioAiPlayground";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio AI Playground — Thenetworkers" };

export default function AiPlaygroundPage() {
  return <StudioAiPlayground />;
}
