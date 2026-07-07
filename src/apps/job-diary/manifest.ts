// job-diary — App #003 manifest.
//
// The operational spine from quote.accepted → warranty.registered.
// Consumes quote.accepted; publishes job.opened, job.checked_in,
// job.photo_added, job.signed_off, warranty.registered.

import { ClipboardCheck } from "lucide-react";

export const JOB_DIARY_APP_MANIFEST = {
  slug: "job-diary",
  name: "Job Diary",
  category: "operations" as const,
  version: "1.0.0",
  description:
    "One place for every accepted job — daily check-ins, photos, notes, milestones, sign-off. The homeowner sees the progress on their Home Timeline. Warranties auto-register at sign-off.",
  icon: ClipboardCheck,

  tradeAllowlist: [
    "kitchen-fitter",
    "bathroom-fitter",
    "carpenter",
    "roofer",
    "flooring-installer",
    "landscaper",
    "driveway-installer",
    "fencer",
    "decorator",
    "painter",
    "joiner",
    "electrician",
    "plumber",
    "general-builder",
    "staircase-manufacturer",
    "door-supplier",
    "window-installer"
  ] as const,

  autoInstallOnService: [] as const,

  supportedSizes: ["landscape"] as const,

  compact: false,

  requiresProductFeed: false,

  eventsConsumed: [
    "quote.accepted",       // → auto-open a job
    "spec.updated"          // → note that spec changed after sign-off
  ] as const,

  eventsPublished: [
    "job.opened",           // new: added to TimelineVerb below
    "job.checked_in",
    "job.photo_added",
    "job.milestone_hit",
    "project.signed_off",   // consumed by Reviews (App #005 later)
    "warranty.registered"   // consumed by manufacturer / Warranty Ledger
  ] as const,

  plans: [
    {
      key: "bundled",
      label: "Bundled in Merchant Pro",
      pricePence: 0,
      monthlyQuota: null,
      audience: "merchant-pro-only"
    },
    {
      key: "starter",
      label: "Starter",
      pricePence: 900,
      monthlyQuota: 5,       // 5 jobs / mo
      audience: "any"
    },
    {
      key: "growth",
      label: "Growth",
      pricePence: 1900,
      monthlyQuota: 25,
      audience: "any"
    },
    {
      key: "unlimited",
      label: "Unlimited",
      pricePence: 3900,
      monthlyQuota: null,
      audience: "any"
    }
  ] as const
} as const;

export type JobDiaryPlanKey =
  (typeof JOB_DIARY_APP_MANIFEST)["plans"][number]["key"];
