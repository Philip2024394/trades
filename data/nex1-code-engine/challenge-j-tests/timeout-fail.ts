// J.1 fixture · intentional timeout (testTimeout=2000ms in config).
import { describe, it } from "vitest";
describe("j-timeout", () => {
  it("hangs forever", async () => {
    await new Promise(() => { /* never resolves */ });
  });
});
