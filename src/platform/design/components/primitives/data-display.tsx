// Design Registry · primitives · data-display
//
// Card (shadcn component), Badge, Accordion, Avatar, Separator,
// Skeleton, Reveal.

"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Reveal } from "@/components/ui/reveal";
import { designSystemRegistry } from "../../registry";

const SHARED = {
  category: "data-display" as const,
  version: "1.0.0",
  author: "shadcn/ui + Radix",
  supportedDevices: ["mobile", "tablet", "desktop"] as const,
  accessibilityStatus: "wcag-aa" as const,
  performanceCost: "low" as const,
  compatibleThemes: ["*"],
  compatibleContainers: ["*"],
  tags: ["display", "shadcn"]
};

// ─── Card ─────────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "data-display.card",
  name: "Card",
  description:
    "shadcn Card component — header + content + footer slots. Distinct from containers.card which is a layout wrapper.",
  contentShape: "card",
  editableProps: [],
  themeTokensUsed: ["color.border", "color.background"],
  animations: ["fade-in", "hover-lift"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["card", "shadcn", "header", "footer"],
  defaultProps: () => ({}),
  defaultContent: () => ({ title: "Title", body: "Body" }),
  renderer: () => (
    <Card>
      <CardHeader>
        <CardTitle>Card title</CardTitle>
        <CardDescription>Card description</CardDescription>
      </CardHeader>
      <CardContent>Content</CardContent>
    </Card>
  )
});

// ─── Badge ────────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "data-display.badge",
  name: "Badge",
  description:
    "Small pill for status, category, count. Variants: default, secondary, destructive, outline, accent.",
  contentShape: "typography",
  editableProps: [],
  themeTokensUsed: ["color.background", "color.foreground"],
  animations: ["none"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["badge", "chip", "pill", "tag", "status"],
  defaultProps: () => ({}),
  defaultContent: () => ({ text: "Badge" }),
  renderer: () => <Badge>Badge</Badge>
});

// ─── Accordion ────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "data-display.accordion",
  name: "Accordion",
  description:
    "Expandable Q&A / details list on Radix Accordion. Keyboard-accessible.",
  contentShape: "container",
  editableProps: [],
  themeTokensUsed: ["color.border"],
  animations: ["expand", "collapse"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["accordion", "faq", "expandable", "collapse"],
  defaultProps: () => ({}),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: () => (
    <Accordion type="single" collapsible>
      <AccordionItem value="a">
        <AccordionTrigger>Question</AccordionTrigger>
        <AccordionContent>Answer</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
});

// ─── Avatar ───────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "data-display.avatar",
  name: "Avatar",
  description:
    "Rounded profile image with fallback initials. Use for team members, review authors, message senders.",
  contentShape: "media",
  editableProps: [],
  themeTokensUsed: ["color.muted"],
  animations: ["none"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["avatar", "profile", "photo", "user"],
  defaultProps: () => ({}),
  defaultContent: () => ({ url: "", alt: "" }),
  renderer: () => (
    <Avatar>
      <AvatarImage src="" alt="" />
      <AvatarFallback>AB</AvatarFallback>
    </Avatar>
  )
});

// ─── Separator ────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "data-display.separator",
  name: "Separator",
  description:
    "Horizontal or vertical dividing line. aria-hidden by default.",
  contentShape: "section",
  editableProps: [],
  themeTokensUsed: ["color.border"],
  animations: ["none"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["separator", "divider", "rule", "hr"],
  defaultProps: () => ({}),
  defaultContent: () => ({ heading: "", body: "" }),
  renderer: () => <Separator />
});

// ─── Skeleton ─────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "data-display.skeleton",
  name: "Skeleton",
  description: "Pulsing placeholder for loading states.",
  contentShape: "section",
  editableProps: [],
  themeTokensUsed: ["color.muted"],
  animations: ["pulse"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["skeleton", "loading", "placeholder", "shimmer"],
  defaultProps: () => ({}),
  defaultContent: () => ({ heading: "", body: "" }),
  renderer: () => <Skeleton className="h-4 w-32" />
});

// ─── Reveal ───────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "data-display.reveal",
  name: "Reveal",
  description:
    "Framer Motion entrance wrapper. Fade + slide-up when the child enters the viewport. Respects prefers-reduced-motion.",
  contentShape: "container",
  editableProps: [],
  themeTokensUsed: [],
  animations: ["fade-up", "reveal"],
  performanceCost: "medium",
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["reveal", "fade", "motion", "entrance"],
  defaultProps: () => ({}),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: () => <Reveal>Revealed content</Reveal>
});
