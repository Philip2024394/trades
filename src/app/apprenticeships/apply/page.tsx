// /apprenticeships/apply — young-person sign-up form.
//
// The Networkers supports UK trade youth. Every apprenticeship request
// is broadcast to verified local trades in that trade. Trades pay
// 1 washer to reveal contact — that puts a small friction on
// speculative outreach so the young person only hears from serious
// employers.
//
// Wraps the client form (all interactivity lives in ./client.tsx).

import type { Metadata } from "next";
import { BRAND, absolute } from "@/lib/seo";
import { ApplyForm } from "./client";

export const metadata: Metadata = {
  title:       `Apply for a UK Trade Apprenticeship — ${BRAND.name}`,
  description: `Free apprenticeship application for 16+ UK youth. Local verified trades see your request and get in touch directly. The Networkers supports the next generation of UK tradies.`,
  alternates:  { canonical: `/apprenticeships/apply` },
  robots:      { index: true, follow: true },
  openGraph:   {
    type:     "website",
    siteName: BRAND.name,
    title:    `Apply for a UK Trade Apprenticeship`,
    description: `Employers are looking for suitable candidates. You could be chosen.`,
    url:      absolute(`/apprenticeships/apply`)
  }
};

export default function ApplyPage() {
  return <ApplyForm/>;
}
