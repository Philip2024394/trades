// J.1 fixture · intentional thrown error.
import { describe, it } from "vitest";
describe("j-throw", () => {
  it("throws a custom error", () => {
    throw new Error("intentional-boom");
  });
});
