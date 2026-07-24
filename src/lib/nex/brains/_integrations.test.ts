import { beforeEach, describe, expect, it } from "vitest";
import { brainRegistry, loadBrain } from "./_loader";
import { estimateWithBrain } from "./_integrations";
import { fixtureBrainPack } from "./__tests__/_fixture_only";

beforeEach(() => brainRegistry.clear());

describe("estimateWithBrain", () => {
  it("resolves a matching rule with national default multiplier", () => {
    const brain = loadBrain(fixtureBrainPack({ slug: "fixture_est" }));
    brainRegistry.register(brain);

    const result = estimateWithBrain({
      brain,
      scope: { rule_key: "fixture.per_unit", quantity: 3 }
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.line.base_value).toBe(100);
    expect(result.line.regional_multiplier).toBe(1);
    expect(result.line.computed).toBe(300);
  });

  it("applies regional multiplier when region matches", () => {
    const brain = loadBrain(fixtureBrainPack({ slug: "fixture_est" }));
    brainRegistry.register(brain);

    const result = estimateWithBrain({
      brain,
      scope: { rule_key: "fixture.per_unit", quantity: 2, region: "UK-LON" }
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.line.regional_multiplier).toBe(1.2);
    expect(result.line.computed).toBe(240);
  });

  it("returns rule_not_found for an unknown key", () => {
    const brain = loadBrain(fixtureBrainPack({ slug: "fixture_est" }));
    brainRegistry.register(brain);

    const result = estimateWithBrain({
      brain,
      scope: { rule_key: "does.not.exist", quantity: 1 }
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("rule_not_found");
  });
});
