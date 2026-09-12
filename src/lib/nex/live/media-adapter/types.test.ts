// src/lib/nex/live/media-adapter/types.test.ts
// NEX LIVE · Phase A · adapter interface conformance (structural)

import { describe, it, expect } from "vitest";
import type {
  StorageAdapter,
  ProcessingAdapter,
  StreamingAdapter,
  DeliveryAdapter,
  AdapterResult,
  MediaBinding,
} from "./types";

// Minimal stub adapters — prove the interfaces are implementable without
// tying to any provider. This is Phase A structural conformance only.

const NOW = "2026-09-06T00:00:00.000Z";

const STUB_BINDING: MediaBinding = {
  media_ref: "stub:media:1",
  kind: "video",
  mime_type: "video/mp4",
  byte_size: 100,
  duration_ms: 1000,
  width_px: 1280,
  height_px: 720,
  checksum_sha256: null,
  created_at_iso: NOW,
};

class StubStorage implements StorageAdapter {
  readonly providerId = "stub";
  async put(): Promise<AdapterResult<MediaBinding>> {
    return { ok: true, value: STUB_BINDING };
  }
  async get(): Promise<AdapterResult<MediaBinding>> {
    return { ok: true, value: STUB_BINDING };
  }
  async delete(): Promise<AdapterResult<null>> {
    return { ok: true, value: null };
  }
}

class StubProcessing implements ProcessingAdapter {
  readonly providerId = "stub";
  async transcode() {
    return { ok: true as const, value: { source_ref: "stub:media:1", outputs: [] } };
  }
}

class StubStreaming implements StreamingAdapter {
  readonly providerId = "stub";
  async openIngest() {
    return { ok: true as const, value: {
      session_id: "s1", ingest_url: "stub://ingest",
      ingest_key_ref: "opaque", playback_ref: "stub:media:1",
      expires_at_iso: NOW,
    }};
  }
  async closeIngest() { return { ok: true as const, value: null }; }
}

class StubDelivery implements DeliveryAdapter {
  readonly providerId = "stub";
  async issueUrl() {
    return { ok: true as const, value: { url: "https://stub", expires_at_iso: NOW } };
  }
}

describe("media-adapter · interface conformance", () => {
  it("StorageAdapter can be implemented without provider lock-in", async () => {
    const s: StorageAdapter = new StubStorage();
    const put = await s.put({
      uploader_nex_id: "nex:u1",
      kind: "video",
      mime_type: "video/mp4",
      byte_stream: null,
      filename_hint: null,
    });
    expect(put.ok).toBe(true);
    if (put.ok) expect(put.value.media_ref).toBe("stub:media:1");
  });
  it("ProcessingAdapter can be implemented", async () => {
    const p: ProcessingAdapter = new StubProcessing();
    const r = await p.transcode({
      source_ref: "stub:media:1", target_kind: "video", requested_variants: ["thumbnail"],
    });
    expect(r.ok).toBe(true);
  });
  it("StreamingAdapter can be implemented", async () => {
    const s: StreamingAdapter = new StubStreaming();
    const r = await s.openIngest({ owner_nex_id: "nex:u1" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.session_id).toBe("s1");
  });
  it("DeliveryAdapter can be implemented", async () => {
    const d: DeliveryAdapter = new StubDelivery();
    const r = await d.issueUrl({ ref: "stub:media:1", purpose: "public_playback", ttl_seconds: 60 });
    expect(r.ok).toBe(true);
  });
});

describe("media-adapter · explicit failure envelope (§26 no silent success)", () => {
  it("AdapterResult failure carries error code + provider ref", () => {
    const failed: AdapterResult<MediaBinding> = {
      ok: false,
      error: { code: "PROVIDER_UNAVAILABLE", message: "stub outage", provider_error_ref: "req-123" },
    };
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.error.code).toBe("PROVIDER_UNAVAILABLE");
      expect(failed.error.provider_error_ref).toBe("req-123");
    }
  });
});
