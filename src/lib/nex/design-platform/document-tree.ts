// Design Platform · DesignDocument tree structure (Philip 2026-08-04).
//
// DesignDocument → Page → Section → Container → Component → Layer → Primitive.
// The tree is universal · a BannerDocument · WebsiteDocument · BrochureDocument
// · QuoteDocument · RoomDocument all use it. Only content and target format
// vary.
//
// Doctrine: docs/brains/nex-phase-e1-universal-design-studio-philip-2026-08-04.md

import type { Primitive } from "./primitives";

export type ContainerLayout = "absolute" | "flex_row" | "flex_column" | "grid";

export type LayerNode = {
  id: string;
  z_index: number;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  primitives: readonly Primitive[];      // leaf drawing elements
};

export type ComponentNode = {
  id: string;
  component_kind: string;                // e.g. "headline_block" · "contact_box" · "cta_button" · "feature_list"
  layers: readonly LayerNode[];
};

export type ContainerNode = {
  id: string;
  layout: ContainerLayout;
  box?: { x: number; y: number; width: number; height: number };
  components: readonly ComponentNode[];
};

export type SectionNode = {
  id: string;
  section_kind: "hero" | "features" | "cta" | "footer" | "gallery" | "testimonial" | "content" | "spacer";
  containers: readonly ContainerNode[];
};

export type PageNode = {
  id: string;
  export_target: string;                 // e.g. "facebook_feed" · references design-sizes registry
  width_px: number;
  height_px: number;
  sections: readonly SectionNode[];
};

export type DocumentTree = {
  document_id: string;
  pages: readonly PageNode[];
};

/** Count every node in a document tree · useful for the render manifest. */
export function countNodes(tree: DocumentTree): { pages: number; sections: number; containers: number; components: number; layers: number; primitives: number } {
  let sections = 0, containers = 0, components = 0, layers = 0, primitives = 0;
  for (const p of tree.pages) {
    sections += p.sections.length;
    for (const s of p.sections) {
      containers += s.containers.length;
      for (const c of s.containers) {
        components += c.components.length;
        for (const co of c.components) {
          layers += co.layers.length;
          for (const l of co.layers) {
            primitives += l.primitives.length;
          }
        }
      }
    }
  }
  return { pages: tree.pages.length, sections, containers, components, layers, primitives };
}
