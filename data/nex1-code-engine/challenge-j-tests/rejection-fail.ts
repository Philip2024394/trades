// J.1 fixture · unhandled rejection.
import { describe, it } from "vitest";
describe("j-rejection", () => {
  it("has an unawaited rejection", async () => {
    // Return a rejected promise · vitest reports as failure
    return Promise.reject(new TypeError("intentional-reject"));
  });
});
