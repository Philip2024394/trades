// filterVisible — the last-mile permission guard.

import { describe, it, expect } from "vitest";
import { filterVisible, type ViewerType } from "./types";

describe("filterVisible", () => {
  type Row = { name: string; visible_to?: ViewerType[] };
  const items: Row[] = [
    { name: "public" },
    { name: "homeowner_only", visible_to: ["homeowner"] },
    { name: "merchant_only",  visible_to: ["merchant"] },
    { name: "both",           visible_to: ["homeowner", "merchant"] }
  ];

  it("keeps unspecified visibility for every viewer", () => {
    expect(filterVisible(items, "homeowner").map((x) => x.name)).toContain("public");
    expect(filterVisible(items, "merchant").map((x) => x.name)).toContain("public");
  });

  it("homeowner sees homeowner_only + both, not merchant_only", () => {
    const seen = filterVisible(items, "homeowner").map((x) => x.name);
    expect(seen).toEqual(["public", "homeowner_only", "both"]);
  });

  it("merchant sees merchant_only + both, not homeowner_only", () => {
    const seen = filterVisible(items, "merchant").map((x) => x.name);
    expect(seen).toEqual(["public", "merchant_only", "both"]);
  });
});
