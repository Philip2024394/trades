// BPJPH connector · authoritative halal certification lookup.
//
// BPJPH (Badan Penyelenggara Jaminan Produk Halal) is the Indonesian
// halal-certification authority (has held statutory authority since
// 2019, superseding MUI's certification role).
//
// Real integration requires either:
//   · a partnership + API access to halal.go.id, OR
//   · scraping (against ToS · avoid)
//
// This module ships the LOOKUP INTERFACE + a mocked-response test
// path so the entity model, phrasing, and pipeline are all wired.
// The moment a partnership lands, `lookupBPJPH()` swaps its
// implementation for the real HTTP call.
//
// Every observation produced here becomes an EntityRecord attribute
// (halal: HalalCertification) attached to a business record, with
// full provenance and freshness (`weekly` policy · cert lookups are
// stable in short windows).

import type { HalalCertification } from "./types";

export type BPJPHLookupInput = {
  /** Business identifier as it appears in NEX (used only for local
   *  telemetry · not sent to BPJPH). */
  entityId: string;
  /** Fields we can search by · at least one is required. */
  name?: string;
  address?: string;
  city?: string;
  /** BPJPH-issued certificate number if the business surfaced it. */
  certificateRef?: string;
};

export type BPJPHLookupResult = {
  input: BPJPHLookupInput;
  certification: HalalCertification;
  /** Set only in mocked-test paths so the caller can assert. */
  __mocked?: true;
};

export type BPJPHClientOptions = {
  /** Force disabled (default when unset). Real API access flips
   *  NEX_BPJPH_ENABLED=1 · gated exactly like other live sources. */
  __forceEnabled?: boolean;
  /** Test-only mock table · key = entityId. */
  __mocks?: Record<string, HalalCertification>;
  now?: () => Date;
};

export async function lookupBPJPH(input: BPJPHLookupInput, opts: BPJPHClientOptions = {}): Promise<BPJPHLookupResult> {
  const now = (opts.now ?? (() => new Date()))();
  const nowIso = now.toISOString();

  // Test / mock path.
  if (opts.__mocks && input.entityId in opts.__mocks) {
    return { input, certification: opts.__mocks[input.entityId], __mocked: true };
  }

  const enabled = opts.__forceEnabled || process.env.NEX_BPJPH_ENABLED === "1";
  if (!enabled) {
    return {
      input,
      certification: {
        status: "unknown",
        authority: "BPJPH",
        verifiedAt: nowIso,
        confidence: 0.0,
        note: "BPJPH lookup disabled (NEX_BPJPH_ENABLED not set)",
      },
    };
  }

  // Real HTTP path · reserved for post-partnership. Would call
  // https://api.halal.go.id/… here with the appropriate auth. Not
  // wired without credentials · returns unknown when reached.
  return {
    input,
    certification: {
      status: "unknown",
      authority: "BPJPH",
      verifiedAt: nowIso,
      confidence: 0.0,
      note: "BPJPH real HTTP path not yet wired · pending partnership",
    },
  };
}
