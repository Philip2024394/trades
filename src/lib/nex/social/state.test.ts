// Post state machine — allowed-transition matrix.
// These test the pure ALLOWED_TRANSITIONS graph without hitting the DB.

import { describe, it, expect } from "vitest";
import { ALLOWED_TRANSITIONS, POST_STATES, type PostState } from "./types";

describe("Post state machine", () => {
  it("draft can go to awaiting_approval or rejected", () => {
    expect(ALLOWED_TRANSITIONS.draft).toEqual(expect.arrayContaining(["awaiting_approval", "rejected"]));
  });

  it("published is terminal", () => {
    expect(ALLOWED_TRANSITIONS.published).toEqual([]);
  });

  it("rejected is terminal", () => {
    expect(ALLOWED_TRANSITIONS.rejected).toEqual([]);
  });

  it("cannot jump from awaiting_approval straight to published", () => {
    expect(ALLOWED_TRANSITIONS.awaiting_approval).not.toContain("published");
  });

  it("failed can be re-approved for retry", () => {
    expect(ALLOWED_TRANSITIONS.failed).toContain("approved");
  });

  it("publishing → published or failed only", () => {
    expect(ALLOWED_TRANSITIONS.publishing.sort()).toEqual(["failed", "published"]);
  });

  it("every state has an entry in the graph", () => {
    for (const s of POST_STATES) expect(ALLOWED_TRANSITIONS[s as PostState]).toBeDefined();
  });
});
