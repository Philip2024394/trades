// Design Platform · Primitive taxonomy + Document Tree tests.
//
// Doctrine: docs/brains/nex-phase-e1-universal-design-studio-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { listPrimitiveKinds, countNodes } from "./index";
import type { DocumentTree, TextPrimitive, ImagePrimitive, RectanglePrimitive } from "./index";

describe("Primitive taxonomy", () => {
  it("declares exactly 10 primitive kinds", () => {
    expect(listPrimitiveKinds()).toEqual([
      "rectangle", "text", "image", "video", "gradient",
      "shadow", "mask", "path", "icon", "border",
    ]);
  });
});

describe("Document Tree · counts nodes deeply", () => {
  it("counts pages/sections/containers/components/layers/primitives correctly", () => {
    const rect: RectanglePrimitive = { kind: "rectangle", id: "r1", box: { x: 0, y: 0, width: 100, height: 50 }, fill: "#111" };
    const txt: TextPrimitive = { kind: "text", id: "t1", box: { x: 10, y: 10, width: 80, height: 20 }, text: "Hi", font_style_ref: "headline_luxury", color: "#fff" };
    const img: ImagePrimitive = { kind: "image", id: "i1", box: { x: 0, y: 0, width: 100, height: 100 }, asset_ref: "hero_001" };
    const tree: DocumentTree = {
      document_id: "doc_001",
      pages: [
        {
          id: "p1", export_target: "facebook_feed", width_px: 1200, height_px: 628,
          sections: [
            {
              id: "hero", section_kind: "hero",
              containers: [
                {
                  id: "c1", layout: "absolute",
                  components: [
                    { id: "headline_block", component_kind: "headline_block", layers: [{ id: "l1", z_index: 10, primitives: [txt, rect] }] },
                    { id: "hero_image", component_kind: "hero_image", layers: [{ id: "l2", z_index: 5, primitives: [img] }] },
                  ],
                },
              ],
            },
            {
              id: "footer", section_kind: "footer",
              containers: [{ id: "c2", layout: "flex_row", components: [{ id: "contact", component_kind: "contact_box", layers: [{ id: "l3", z_index: 20, primitives: [rect] }] }] }],
            },
          ],
        },
      ],
    };
    const counts = countNodes(tree);
    expect(counts.pages).toBe(1);
    expect(counts.sections).toBe(2);
    expect(counts.containers).toBe(2);
    expect(counts.components).toBe(3);
    expect(counts.layers).toBe(3);
    expect(counts.primitives).toBe(4);
  });
});
