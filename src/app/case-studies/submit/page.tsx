// /case-studies/submit — case-study submission page.

import type { Metadata } from "next";
import { BRAND, absolute } from "@/lib/seo";
import { SubmitForm } from "./client";

export const metadata: Metadata = {
  title:       `Submit a Case Study · Networkers Members — ${BRAND.name}`,
  description: `Submit your UK trade project for feature on The Networkers case studies section. Free editorial coverage. Verified members only. Editorial checklist + submission form.`,
  alternates:  { canonical: `/case-studies/submit` },
  openGraph:   {
    type:     "website",
    siteName: BRAND.name,
    title:    `Submit a case study`,
    description: `Free editorial feature for Networkers member projects.`,
    url:      absolute(`/case-studies/submit`)
  },
  robots: { index: true, follow: true }
};

export default function SubmitPage() {
  return <SubmitForm/>;
}
