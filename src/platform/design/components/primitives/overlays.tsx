// Design Registry · primitives · overlays
//
// Catalogue: Dialog, Sheet, Popover, Drawer, DropdownMenu, Tooltip,
// Tabs. Each renderer is a static preview — the interactive
// primitives live in @/components/ui/*.

"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { designSystemRegistry } from "../../registry";

const SHARED = {
  category: "overlays" as const,
  version: "1.0.0",
  author: "shadcn/ui + Radix",
  supportedDevices: ["mobile", "tablet", "desktop"] as const,
  accessibilityStatus: "wcag-aa" as const,
  performanceCost: "medium" as const,
  compatibleThemes: ["*"],
  compatibleContainers: ["*"],
  tags: ["overlay", "shadcn", "radix", "modal"]
};

// ─── Dialog ───────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "overlays.dialog",
  name: "Dialog",
  description:
    "Modal dialog with focus trap, escape-to-close, and aria-labelled title. Use for confirmations, small forms, detail panels.",
  contentShape: "container",
  editableProps: [],
  themeTokensUsed: ["color.background", "color.border"],
  animations: ["fade-in", "zoom-in"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["dialog", "modal", "popup", "alert"],
  defaultProps: () => ({}),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: () => (
    <Dialog>
      <DialogTrigger className="text-body-sm underline">Open dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog title</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
});

// ─── Sheet ────────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "overlays.sheet",
  name: "Sheet",
  description:
    "Side-anchored drawer. Configurable side (left/right/top/bottom). Use for mobile nav, filter panels, side-panel forms.",
  contentShape: "container",
  editableProps: [],
  themeTokensUsed: ["color.background", "color.border"],
  animations: ["slide-in", "fade-in"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["sheet", "drawer", "sidebar", "mobile-nav"],
  defaultProps: () => ({}),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: () => (
    <Sheet>
      <SheetTrigger className="text-body-sm underline">Open sheet</SheetTrigger>
      <SheetContent />
    </Sheet>
  )
});

// ─── Popover ──────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "overlays.popover",
  name: "Popover",
  description:
    "Small floating panel anchored to a trigger. Use for date pickers, inline hints, quick actions.",
  contentShape: "container",
  editableProps: [],
  themeTokensUsed: ["color.background", "color.border"],
  animations: ["fade-in", "zoom-in"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["popover", "floating", "hint"],
  defaultProps: () => ({}),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: () => (
    <Popover>
      <PopoverTrigger className="text-body-sm underline">Open</PopoverTrigger>
      <PopoverContent>Content</PopoverContent>
    </Popover>
  )
});

// ─── DropdownMenu ─────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "overlays.dropdown-menu",
  name: "Dropdown Menu",
  description:
    "Contextual menu with items, submenus, checkboxes, radio items. The kitchen sink of context menus.",
  contentShape: "navigation",
  editableProps: [],
  themeTokensUsed: ["color.background", "color.border", "color.accent"],
  animations: ["fade-in", "zoom-in"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["dropdown", "menu", "context", "actions"],
  defaultProps: () => ({}),
  defaultContent: () => ({ items: [] }),
  renderer: () => (
    <DropdownMenu>
      <DropdownMenuTrigger className="text-body-sm underline">Menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Item 1</DropdownMenuItem>
        <DropdownMenuItem>Item 2</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
});

// ─── Tooltip ──────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  id: "overlays.tooltip",
  name: "Tooltip",
  description:
    "Small caption revealed on hover / focus. Use only for supplementary info — never for critical UX.",
  contentShape: "typography",
  editableProps: [],
  themeTokensUsed: ["color.foreground", "color.background"],
  animations: ["fade-in", "zoom-in"],
  performanceCost: "low",
  responsive: { mobile: "hide", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["tooltip", "hover", "caption", "hint"],
  defaultProps: () => ({}),
  defaultContent: () => ({ text: "Tip" }),
  renderer: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="text-body-sm underline">Hover me</TooltipTrigger>
        <TooltipContent>Tooltip</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
});

// ─── Tabs ─────────────────────────────────────────
designSystemRegistry.register({
  ...SHARED,
  category: "navigation" as const,
  performanceCost: "low",
  id: "navigation.tabs",
  name: "Tabs",
  description:
    "Horizontal tab list + content panels. Keyboard-accessible via Radix.",
  contentShape: "navigation",
  editableProps: [],
  themeTokensUsed: ["color.muted", "color.background"],
  animations: ["fade-in"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["tabs", "tab", "sections", "panels"],
  defaultProps: () => ({}),
  defaultContent: () => ({ items: [] }),
  renderer: () => (
    <Tabs defaultValue="a">
      <TabsList>
        <TabsTrigger value="a">A</TabsTrigger>
        <TabsTrigger value="b">B</TabsTrigger>
      </TabsList>
    </Tabs>
  )
});
