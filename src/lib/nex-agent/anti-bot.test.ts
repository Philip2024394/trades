// src/lib/nex-agent/anti-bot.test.ts

import { describe, it, expect } from "vitest";
import { checkRateLimit, detectBotUA, honeypotTriggered } from "./anti-bot";

describe("checkRateLimit", () => {
  it("allows first N requests · rejects N+1", () => {
    const k = "test-rl-1-" + Date.now();
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit(k, { windowMs: 60_000, maxRequests: 3 });
      expect(r.allowed).toBe(true);
    }
    const r4 = checkRateLimit(k, { windowMs: 60_000, maxRequests: 3 });
    expect(r4.allowed).toBe(false);
    expect(r4.reason).toContain("sec.rate_limit_exceeded");
  });

  it("resets after window expires", () => {
    const k = "test-rl-2-" + Date.now();
    checkRateLimit(k, { windowMs: 1, maxRequests: 1 });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const r = checkRateLimit(k, { windowMs: 1, maxRequests: 1 });
        expect(r.allowed).toBe(true);
        resolve();
      }, 5);
    });
  });
});

describe("detectBotUA", () => {
  it("flags curl", () => {
    expect(detectBotUA("curl/7.79.1").isBot).toBe(true);
  });
  it("flags python-requests", () => {
    expect(detectBotUA("python-requests/2.31.0").isBot).toBe(true);
  });
  it("flags empty UA", () => {
    expect(detectBotUA("").isBot).toBe(true);
    expect(detectBotUA(null).isBot).toBe(true);
  });
  it("flags GPTBot", () => {
    expect(detectBotUA("Mozilla/5.0 (compatible; GPTBot/1.0)").isBot).toBe(true);
  });
  it("flags ClaudeBot", () => {
    expect(detectBotUA("Mozilla/5.0 (compatible; ClaudeBot/1.0)").isBot).toBe(true);
  });
  it("flags HeadlessChrome", () => {
    expect(detectBotUA("Mozilla/5.0 HeadlessChrome/122").isBot).toBe(true);
  });
  it("allows real Chrome", () => {
    expect(detectBotUA("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36").isBot).toBe(false);
  });
  it("allows real Safari", () => {
    expect(detectBotUA("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15").isBot).toBe(false);
  });
});

describe("honeypotTriggered", () => {
  it("bots fill honeypot", () => {
    expect(honeypotTriggered({ prompt: "hi", website_hp: "http://spam" })).toBe(true);
    expect(honeypotTriggered({ url_hp: "hi" })).toBe(true);
  });
  it("humans leave honeypot empty", () => {
    expect(honeypotTriggered({ prompt: "hi" })).toBe(false);
    expect(honeypotTriggered({})).toBe(false);
  });
  it("null body is not triggering", () => {
    expect(honeypotTriggered(null)).toBe(false);
    expect(honeypotTriggered(undefined)).toBe(false);
  });
});
