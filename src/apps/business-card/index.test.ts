// Business Card Studio — smoke tests per doc checklist.

import { describe, it, expect } from "vitest";
import { StudioAppManifestSchema } from "@/lib/design/trade-os/manifest";
import { manifest } from "./manifest";
import bcModule from "./index";

describe("Business Card Studio", () => {
  it("manifest passes StudioAppManifestSchema", () => {
    expect(() => StudioAppManifestSchema.parse(manifest)).not.toThrow();
  });

  it("module exports a generator function", () => {
    expect(typeof bcModule.generator).toBe("function");
  });
});
