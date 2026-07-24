import { describe, expect, it } from "vitest";
import { scaffoldManifest, scaffoldModule } from "./_scaffold";
import { BrainManifestSchema, MODULE_SCHEMAS, V1_MODULE_NAMES } from "@/lib/nex/brains/_schema";

describe("scaffold", () => {
  it("scaffoldManifest passes BrainManifestSchema", () => {
    const m = scaffoldManifest({
      slug: "staircase",
      name: "Staircase Brain",
      author_id: "author-1",
      author_name: "Test Author",
      author_creds: "Test Creds",
      supported_countries: ["UK"],
      version: "0.1.0"
    });
    const parsed = BrainManifestSchema.safeParse(m);
    expect(parsed.success).toBe(true);
  });

  it("every V1 module scaffold passes its Zod schema", () => {
    for (const name of V1_MODULE_NAMES) {
      const payload = scaffoldModule(name, { author_id: "author-1", version: "0.1.0" });
      const parsed = MODULE_SCHEMAS[name].safeParse(payload);
      expect(parsed.success, `${name} scaffold parse`).toBe(true);
    }
  });
});
