// Design Registry · primitives · feedback
//
// Alert, Toast, Progress.

"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { designSystemRegistry } from "../../registry";

const SHARED = {
  category: "feedback" as const,
  version: "1.0.0",
  author: "shadcn/ui + Radix",
  supportedDevices: ["mobile", "tablet", "desktop"] as const,
  accessibilityStatus: "wcag-aa" as const,
  performanceCost: "low" as const,
  compatibleThemes: ["*"],
  compatibleContainers: ["*"],
  tags: ["feedback", "shadcn", "status"]
};

// ─── Alert ────────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "feedback.alert",
  name: "Alert",
  description:
    "Inline alert box with variants (default, destructive, success, warning, info). Use for form-level or page-level status.",
  contentShape: "section",
  editableProps: [],
  themeTokensUsed: ["color.border", "color.foreground"],
  animations: ["fade-in"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["alert", "notice", "warning", "status", "banner"],
  defaultProps: () => ({}),
  defaultContent: () => ({ heading: "", body: "" }),
  renderer: () => (
    <Alert>
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>Some inline status text.</AlertDescription>
    </Alert>
  )
});

// ─── Toast ────────────────────────────────────────
// Toast requires a provider mount + state — its preview is a rendered
// example without the provider. Full runtime usage documented in the
// component file.
designSystemRegistry.register({
  ...SHARED,
  id: "feedback.toast",
  name: "Toast",
  description:
    "Ephemeral notification anchored to the viewport corner. Auto-dismiss + swipe-to-dismiss on mobile.",
  contentShape: "section",
  editableProps: [],
  themeTokensUsed: ["color.background", "color.border"],
  animations: ["slide-in", "fade-out"],
  performanceCost: "medium",
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["toast", "notification", "snackbar", "flash"],
  defaultProps: () => ({}),
  defaultContent: () => ({ heading: "", body: "" }),
  renderer: () => (
    <div className="rounded-md border border-border bg-background px-3 py-2 text-body-sm shadow">
      Toast preview
    </div>
  )
});

// ─── Progress ─────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "feedback.progress",
  name: "Progress",
  description:
    "Horizontal progress bar. Use for indeterminate loads or determinate multi-step flows.",
  contentShape: "section",
  editableProps: [],
  themeTokensUsed: ["color.muted", "color.primary"],
  animations: ["slide"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["progress", "loading", "bar"],
  defaultProps: () => ({}),
  defaultContent: () => ({ heading: "", body: "" }),
  renderer: () => <Progress value={50} />
});
