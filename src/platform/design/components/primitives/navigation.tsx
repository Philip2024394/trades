// Design Registry · primitives · navigation
//
// Pagination (Tabs registered in ./overlays.tsx alongside overlays
// because they share the Radix tab primitive).

"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";
import { designSystemRegistry } from "../../registry";

// ─── Pagination ───────────────────────────────────
designSystemRegistry.register({
  category: "navigation",
  version: "1.0.0",
  author: "shadcn/ui",
  supportedDevices: ["mobile", "tablet", "desktop"],
  accessibilityStatus: "wcag-aa",
  performanceCost: "low",
  compatibleThemes: ["*"],
  compatibleContainers: ["*"],
  tags: ["pagination", "shadcn", "nav"],
  id: "navigation.pagination",
  name: "Pagination",
  description:
    "Numbered page navigation with previous/next + ellipsis. aria-current on active page for a11y.",
  contentShape: "navigation",
  editableProps: [],
  themeTokensUsed: ["color.border", "color.foreground"],
  animations: ["none"],
  responsive: { mobile: "unchanged", tablet: "unchanged", desktop: "unchanged" },
  searchKeywords: ["pagination", "pages", "next", "previous"],
  defaultProps: () => ({}),
  defaultContent: () => ({ items: [] }),
  renderer: () => (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" isActive>
            1
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">2</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
});
