// src/lib/nex-hq/city-category-observability.test.ts
//
// Diagnosis-precedence proof · Philip 2026-08-24 truthful-reporting doctrine.
// Priority order (highest first):
//   1 · running                (in flight)
//   2 · aborted                (zombie reconciled)
//   3 · productive             (provider SUCCESS + persisted > 0)
//   4 · deduped-zero-persisted (provider SUCCESS + returned > 0 + persisted = 0)
//   5 · provider-error         (provider itself failed)
//   6 · failed                 (status=failed AND provider did not return candidates)
//   7 · processed-zero-provider (provider SUCCESS + returned = 0)
//
// The KEY rule under test: a secondary error (errors_count > 0) MUST NOT
// override a successful primary discovery. This is the Solo Market case that
// motivated the fix.

import { describe, it, expect } from "vitest";
import { diagnose } from "./city-category-observability";

interface Row {
  status: string | null;
  processed: number | null;
  newCandidates: number | null;
  persisted: number | null;
  errors: number | null;
  providerError: string | null;
  providerStatus: string | null;
  providerReturned: number | null;
  reconcilerReason: string | null;
  finishedAt: Date | null;
}

function base(overrides: Partial<Row> = {}): Row {
  return {
    status: "completed",
    processed: 0,
    newCandidates: 0,
    persisted: 0,
    errors: 0,
    providerError: null,
    providerStatus: null,
    providerReturned: null,
    reconcilerReason: null,
    finishedAt: new Date(),
    ...overrides,
  };
}

describe("diagnose · precedence ladder", () => {
  it("🔵 running when status=running", () => {
    expect(diagnose(base({ status: "running", finishedAt: null })).diagnosis).toBe("running");
  });

  it("🔵 running when status is null and finished_at is null (in flight before status wrote)", () => {
    expect(diagnose(base({ status: null, finishedAt: null })).diagnosis).toBe("running");
  });

  it("🟠 aborted (zombie reconciled) trumps error signals · Yogyakarta Market case", () => {
    const r = diagnose(base({
      status: "aborted",
      processed: null,
      persisted: null,
      errors: 0,
      reconcilerReason: "exceeded_configured_timeout",
    }));
    expect(r.diagnosis).toBe("aborted");
    expect(r.text).toContain("Zombie reconciled");
    expect(r.text).toContain("exceeded_configured_timeout");
  });

  it("🟢 productive when provider SUCCESS and persisted > 0 · Denpasar Food case", () => {
    const r = diagnose(base({
      status: "completed",
      processed: 2521,
      persisted: 2521,
      errors: 0,
      providerStatus: "SUCCESS",
      providerReturned: 2521,
    }));
    expect(r.diagnosis).toBe("productive");
    expect(r.text).toContain("2521");
  });

  // ── THE HERO TEST · Solo Market · Philip 2026-08-24 ─────────────────────
  it("🟡 all deduped when Nominatim SUCCESS returned 48 · persisted 0 · errors=1 · status=failed · Solo Market case", () => {
    const r = diagnose(base({
      status: "failed",              // secondary persist error made it fail
      processed: 48,
      persisted: 0,
      errors: 1,                     // secondary warning · MUST NOT dominate
      providerStatus: "SUCCESS",     // Nominatim call was fine
      providerReturned: 48,
    }));
    expect(r.diagnosis).toBe("deduped-zero-persisted");
    expect(r.text).toContain("48");
    expect(r.text).toContain("deduped");
  });

  it("🟡 all deduped also fires when provider_status is null but processed > 0 (older walker summaries)", () => {
    const r = diagnose(base({
      status: "completed",
      processed: 100,
      persisted: 0,
      errors: 0,
      providerStatus: null,          // walker didn't emit provider_results[0].status
      providerReturned: null,
    }));
    expect(r.diagnosis).toBe("deduped-zero-persisted");
  });

  it("🔴 provider-error when unexpected_error present AND no candidates returned · Overpass 500 case", () => {
    const r = diagnose(base({
      status: "failed",
      processed: 0,
      persisted: 0,
      errors: 1,
      providerError: "https://overpass.private.coffee/api/interpreter: 500",
      providerStatus: null,
      providerReturned: 0,
    }));
    expect(r.diagnosis).toBe("provider-error");
    expect(r.text).toContain("Provider error");
  });

  it("🔴 failed when status=failed and provider did not return candidates", () => {
    const r = diagnose(base({
      status: "failed",
      processed: 0,
      persisted: 0,
      errors: 2,
      providerStatus: null,
      providerReturned: null,
    }));
    expect(r.diagnosis).toBe("failed");
    expect(r.text).toContain("errors=2");
  });

  it("⚪ provider-empty when provider SUCCESS but returned zero", () => {
    const r = diagnose(base({
      status: "completed",
      processed: 0,
      persisted: 0,
      errors: 0,
      providerStatus: "SUCCESS",
      providerReturned: 0,
    }));
    expect(r.diagnosis).toBe("processed-zero-provider");
  });

  it("🟢 productive beats deduped when even one row persisted (partial success)", () => {
    const r = diagnose(base({
      status: "completed",
      processed: 50,
      persisted: 1,
      errors: 0,
      providerStatus: "SUCCESS",
      providerReturned: 50,
    }));
    expect(r.diagnosis).toBe("productive");
  });

  it("🟠 aborted precedence beats a successful provider signal (reconciler stopped a genuine zombie)", () => {
    // If a cycle got aborted, whatever counters it emitted mid-run are unreliable.
    // Reconciled zombies stay 🟠 regardless.
    const r = diagnose(base({
      status: "aborted",
      processed: 500,
      persisted: 0,
      providerStatus: "SUCCESS",
      providerReturned: 500,
      reconcilerReason: "exceeded_configured_timeout",
    }));
    expect(r.diagnosis).toBe("aborted");
  });

  it("🔵 running beats everything · even a stale successful provider_returned", () => {
    const r = diagnose(base({
      status: "running",
      finishedAt: null,
      processed: 100,
      persisted: 5,
      providerStatus: "SUCCESS",
      providerReturned: 100,
    }));
    expect(r.diagnosis).toBe("running");
  });
});
