import { beforeEach, describe, expect, it } from "vitest";
import { brainRegistry, loadBrain } from "./_loader";
import { BrainBootError } from "./_types";
import { fixtureBrainPack } from "./__tests__/_fixture_only";

beforeEach(() => brainRegistry.clear());

describe("loadBrain", () => {
  it("loads a valid pack and registers it", () => {
    const pack = fixtureBrainPack({ slug: "fixture_a" });
    const loaded = loadBrain(pack);
    expect(loaded.manifest.slug).toBe("fixture_a");
    brainRegistry.register(loaded);
    expect(brainRegistry.has("fixture_a")).toBe(true);
    expect(brainRegistry.size()).toBe(1);
  });

  it("rejects a pack missing a V1 module", () => {
    const pack = fixtureBrainPack({ slug: "fixture_b" });
    delete pack.modules.regulations;
    expect(() => loadBrain(pack)).toThrow(BrainBootError);
  });

  it("rejects an invalid manifest", () => {
    const pack = fixtureBrainPack({ slug: "fixture_c" });
    (pack.manifest as { slug: string }).slug = "INVALID SLUG WITH SPACES";
    expect(() => loadBrain(pack)).toThrow(BrainBootError);
  });

  it("rejects an invalid module schema", () => {
    const pack = fixtureBrainPack({ slug: "fixture_d" });
    // Break defects — remove required symptoms field.
    (pack.modules.defects as { defects: { symptoms: string[] }[] }).defects[0].symptoms = [];
    expect(() => loadBrain(pack)).toThrow(BrainBootError);
  });

  it("carries V2 module payloads via optionalModules", () => {
    const pack = fixtureBrainPack({ slug: "fixture_e" });
    pack.modules.tools = { anything: "goes at V1" };
    const loaded = loadBrain(pack);
    expect(loaded.optionalModules.tools).toEqual({ anything: "goes at V1" });
  });
});
