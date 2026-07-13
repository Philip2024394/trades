// /trade-off/packages — new pricing / packages page.
//
// Fresh design language separate from the legacy /trade-off/pricing
// surface (which stays intact for existing traffic). One-base + add-ons
// model with a monthly/annual toggle. Marketing page — no DB reads.

import type { Metadata } from "next";
import { BRAND } from "@/lib/seo";
import { PackagesShell } from "./PackagesShell";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Packages — Thenetworkers",
  description:
    "One base, pick what you need. Free tier with your own thenetworkers.app URL, Pro from £6.99/mo, Trade Center Marketplace + Video + Verified add-ons. 14-day free trial, cancel any time.",
  alternates: { canonical: "/trade-off/packages" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Packages — Thenetworkers",
    description:
      "One base, pick what you need. Free tier with your own thenetworkers.app URL, Pro from £6.99/mo."
  }
};

export default function PackagesPage() {
  return <PackagesShell/>;
}
