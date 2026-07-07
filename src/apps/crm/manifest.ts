// crm — App #005 manifest.
//
// One contact per (merchant × person). Consumes every event that means
// "someone did something involving this contact"; publishes contact
// lifecycle + follow-up events.

import { Users } from "lucide-react";

export const CRM_APP_MANIFEST = {
  slug: "crm",
  name: "Contacts (CRM)",
  category: "sales" as const,
  version: "1.0.0",
  description:
    "One page per person. Every render, quote, job, review, WhatsApp reply — all in one timeline. When a customer's gone quiet, the follow-up message is already drafted. No 'did we ever get back to them?' ever again.",
  icon: Users,

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
    "kitchen-showroom",
    "bathroom-showroom",
    "building-merchant",
    "builders-supplies",
    "tile-supplier",
    "door-supplier",
    "window-installer",
    "staircase-manufacturer"
  ] as const,

  autoInstallOnService: [] as const,
  supportedSizes: ["landscape"] as const,
  compact: false,
  requiresProductFeed: false,

  eventsConsumed: [
    "render.completed",
    "quote.drafted",
    "quote.sent",
    "quote.viewed",
    "quote.accepted",
    "quote.rejected",
    "job.opened",
    "job.checked_in",
    "job.milestone_hit",
    "warranty.registered",
    "review.posted",
    "review.responded"
  ] as const,

  eventsPublished: [
    "contact.created",
    "contact.stage_changed",
    "task.due",
    "follow_up.due"
  ] as const,

  plans: [
    {
      key: "bundled",
      label: "Bundled with any paid Suite",
      pricePence: 0,
      monthlyQuota: null,
      audience: "any"
    }
  ] as const
} as const;

export type CrmPlanKey = (typeof CRM_APP_MANIFEST)["plans"][number]["key"];
