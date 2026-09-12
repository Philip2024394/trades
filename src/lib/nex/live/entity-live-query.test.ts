// src/lib/nex/live/entity-live-query.test.ts
//
// NEX LIVE · Phase 3 · Entity Live query tests
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase 3
//
// Tests the pure-logic paths that require no filesystem:
//   · unknown ref_id → no_mock_alias (short-circuits before I/O)
//   · known alias for Gaotama Hotel · known truth
//
// The full mock_alias_matched happy path exercises fs + real store I/O
// and is proven by the browser journey in the master experience proof.

import { describe, it, expect } from "vitest";
import { queryEntityLiveCards } from "./entity-live-query";

describe("queryEntityLiveCards · pure alias short-circuit (§41)", () => {
  it("unknown ref_id returns no_mock_alias without any I/O", async () => {
    const r = await queryEntityLiveCards({
      entity_ref_id: "#DEFINITELY-NOT-A-REAL-REF",
      entity_name: "Nonexistent Entity",
    });
    expect(r.reason).toBe("no_mock_alias");
    expect(r.cards).toEqual([]);
    expect(r.resolved_mock_entity_id).toBeNull();
    expect(r.entity_ref_id).toBe("#DEFINITELY-NOT-A-REAL-REF");
  });

  it("preserves the caller-supplied entity_name for downstream honest copy", async () => {
    const r = await queryEntityLiveCards({
      entity_ref_id: "#ANOTHER-UNKNOWN",
      entity_name: "Sesame Street",
    });
    expect(r.entity_name).toBe("Sesame Street");
  });

  it("Gaotama Hotel real ref_id resolves to its known mock alias", async () => {
    // §41 truth · mock_entity_gaotama_hotel is the deliberately wired
    // demo companion for real WorldRecord #AC-2026-0000D. Whether the
    // sidecar/fixtures/declarations are present at test time is
    // environment-dependent — we only assert the alias resolved.
    const r = await queryEntityLiveCards({
      entity_ref_id: "#AC-2026-0000D",
      entity_name: "Gaotama Hotel",
    });
    expect(r.resolved_mock_entity_id).toBe("mock_entity_gaotama_hotel");
    // reason may be mock_alias_matched OR no_timing_sidecar OR
    // no_fixtures_for_entity depending on env — never no_mock_alias.
    expect(r.reason).not.toBe("no_mock_alias");
  });
});
