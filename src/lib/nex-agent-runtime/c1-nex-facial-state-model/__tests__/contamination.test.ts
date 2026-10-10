// C1 · contamination.test.ts · MAI-supplied test scaffold per Capability Lab §12.
// C1 is contract-only · blind to visual assets · §14.3 of C1 Build Gate v1.2.
// Any visual-reference contamination in the 5 capability files is a governance failure.

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";

const LAB_DIR = path.join(__dirname, "..");
const C1_FILES = ["ranges.ts", "refusal.ts", "facial-state.ts", "validator.ts", "serialiser.ts"] as const;

// Master image SHA-256 (locked · verified against founder-signed record)
const MASTER_FRONTAL_SHA = "5af9455104a48ec83174c406ec51e6f0df7dec3ff31eb6ab71462ac394d628f0";
const MASTER_SIDE_VIEWS_SHA = "39020c57db74bfddc1026f08803ab8f3de817a6a2a3633884eca8b9e86e9e74a";

const FORBIDDEN_SUBSTRINGS = [
  // Visual asset paths
  "nex-visual-master",
  "assets/",
  "docs/NEX1/assets",
  // Pixel-space vocabulary that would imply visual coupling
  "pixel",
  "bitmap",
  "sprite",
  "texture",
  "shader",
  "mesh",
  "polygon",
  "vertex",
  "framebuffer",
  "canvas",
  "webgl",
  "png",
  "jpg",
  "svg",
  "webp",
  "rgb",
  "rgba",
  // External viseme systems that would violate the NEX-owned vocabulary rule
  "arkit",
  "ARKit",
  "MediaPipe",
  "mediapipe",
  "blendshape",
  "morph_target",
  // Runtime code that shouldn't appear in typed_data_contract output
  "eval(",
  "Function(",
  "require(",
  "process.",
  "fs.",
  "child_process",
];

function shaOfFile(absPath: string): string {
  return createHash("sha256").update(fs.readFileSync(absPath)).digest("hex");
}

describe("C1 · contamination guard · no visual/pixel references", () => {
  for (const file of C1_FILES) {
    it(`CG-${file} · no forbidden substring in ${file}`, () => {
      const abs = path.join(LAB_DIR, file);
      const content = fs.readFileSync(abs, "utf8");
      const lowerContent = content.toLowerCase();
      for (const bad of FORBIDDEN_SUBSTRINGS) {
        expect(lowerContent.includes(bad.toLowerCase()), `${file} contains forbidden substring "${bad}"`).toBe(false);
      }
    });
  }
});

describe("C1 · master image assets integrity", () => {
  it("MI-1 · master frontal reference SHA-256 unchanged", () => {
    const abs = path.join(__dirname, "..", "..", "..", "..", "..", "docs", "NEX1", "assets", "nex-visual-master-reference.png");
    expect(shaOfFile(abs)).toBe(MASTER_FRONTAL_SHA);
  });

  it("MI-2 · master side-views reference SHA-256 unchanged", () => {
    const abs = path.join(__dirname, "..", "..", "..", "..", "..", "docs", "NEX1", "assets", "nex-visual-master-side-views-reference.png");
    expect(shaOfFile(abs)).toBe(MASTER_SIDE_VIEWS_SHA);
  });
});
