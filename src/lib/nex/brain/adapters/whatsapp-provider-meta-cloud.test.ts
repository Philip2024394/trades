// src/lib/nex/brain/adapters/whatsapp-provider-meta-cloud.test.ts
//
// Stage 3.38 · Meta Cloud provider shape · request/response mapping.
// No real network · fetch is injected.

import { describe, expect, it } from "vitest";
import { makeMetaCloudProvider } from "./whatsapp-provider-meta-cloud";

function fakeFetch(response: {
  status?: number;
  ok?: boolean;
  json?: unknown;
}) {
  return async (_url: string, _init: unknown) => ({
    ok: response.ok ?? (response.status ?? 200) < 400,
    status: response.status ?? 200,
    json: async () => response.json,
    text: async () => JSON.stringify(response.json ?? null),
  });
}

const creds = { phoneNumberId: "PN123", accessToken: "TOK_TEST" };

describe("meta cloud · request mapping", () => {
  it("posts to the phone-number-id messages endpoint · body contains recipient without leading +", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    const p = makeMetaCloudProvider({
      credentials: creds,
      fetchImpl: async (url, init) => {
        capturedUrl = url;
        capturedBody = init.body;
        return {
          ok: true, status: 200,
          json: async () => ({ messages: [{ id: "wamid.abc" }] }),
          text: async () => "",
        };
      },
    });
    const r = await p.send({ toE164: "+6281234567890", body: "hello", idempotencyKey: "corr_1" });
    expect(capturedUrl).toContain("/v20.0/PN123/messages");
    const parsed = JSON.parse(capturedBody);
    expect(parsed.to).toBe("6281234567890");           // stripped leading +
    expect(parsed.text.body).toBe("hello");
    expect(parsed.messaging_product).toBe("whatsapp");
    expect(r.kind).toBe("accepted");
    if (r.kind === "accepted") expect(r.providerMessageId).toBe("wamid.abc");
  });
});

describe("meta cloud · response mapping", () => {
  it("2xx with messages[].id → accepted (never delivered)", async () => {
    const p = makeMetaCloudProvider({
      credentials: creds,
      fetchImpl: fakeFetch({ status: 200, json: { messages: [{ id: "wamid.xyz" }] } }),
    });
    const r = await p.send({ toE164: "+62812", body: "hi", idempotencyKey: "c" });
    // CONSTITUTIONAL: even a 2xx response is only "accepted" · never rounded up
    expect(r.kind).toBe("accepted");
  });

  it("4xx with error payload → rejected · reason includes provider error text", async () => {
    const p = makeMetaCloudProvider({
      credentials: creds,
      fetchImpl: fakeFetch({
        status: 400, ok: false,
        json: { error: { message: "Invalid recipient phone number", code: 131009 } },
      }),
    });
    const r = await p.send({ toE164: "+62812", body: "hi", idempotencyKey: "c" });
    expect(r.kind).toBe("rejected");
    if (r.kind === "rejected") {
      expect(r.reason).toContain("Invalid recipient");
      expect(r.reason).toContain("131009");
    }
  });

  it("5xx → unreachable (never rejected · we don't know if the message queued)", async () => {
    const p = makeMetaCloudProvider({
      credentials: creds,
      fetchImpl: fakeFetch({ status: 503, ok: false, json: { error: { message: "upstream" } } }),
    });
    const r = await p.send({ toE164: "+62812", body: "hi", idempotencyKey: "c" });
    expect(r.kind).toBe("unreachable");
  });

  it("2xx without message id → unreachable (never fabricate a message id)", async () => {
    const p = makeMetaCloudProvider({
      credentials: creds,
      fetchImpl: fakeFetch({ status: 200, json: { messages: [] } }),
    });
    const r = await p.send({ toE164: "+62812", body: "hi", idempotencyKey: "c" });
    expect(r.kind).toBe("unreachable");
  });

  it("fetch throws → unreachable (never rejected)", async () => {
    const p = makeMetaCloudProvider({
      credentials: creds,
      fetchImpl: async () => { throw new Error("dns"); },
    });
    const r = await p.send({ toE164: "+62812", body: "hi", idempotencyKey: "c" });
    expect(r.kind).toBe("unreachable");
    if (r.kind === "unreachable") expect(r.reason).toContain("fetch threw");
  });
});

describe("meta cloud · idempotency + getStatus discipline", () => {
  it("supportsIdempotencyKey is FALSE for Meta (endpoint has no idempotency header)", () => {
    const p = makeMetaCloudProvider({
      credentials: creds,
      fetchImpl: fakeFetch({ status: 200, json: { messages: [{ id: "x" }] } }),
    });
    expect(p.supportsIdempotencyKey).toBe(false);
  });

  it("getStatus returns unknown until webhook reconciliation lands (never fabricates status)", async () => {
    const p = makeMetaCloudProvider({
      credentials: creds,
      fetchImpl: fakeFetch({ status: 200, json: { messages: [{ id: "x" }] } }),
    });
    const s = await p.getStatus?.("wamid.probe");
    expect(s?.kind).toBe("unknown");
    if (s?.kind === "unknown") expect(s.reason).toContain("webhook reconciliation");
  });
});
