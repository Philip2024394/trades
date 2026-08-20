// Browser voice provider · contract test.
//
// Vitest runs in the node environment (see vitest.config.ts), so we mock
// the browser globals (window.SpeechRecognition, window.speechSynthesis).
// The point of this test is NOT to test the browser API — it's to prove:
//
//   1. The provider emits ONLY plain-text transcripts through onFinal.
//   2. No state, store, or chat-API access is possible via this interface.
//   3. Empty / low-confidence utterances flow to onFinal as {text:'',...}
//      so the caller can trigger the "didn't catch that" fallback.
//   4. Errors that are actually normal outcomes (no-speech, aborted) do
//      NOT bubble as errors · they arrive as empty finals.
//
// This is the doctrine safety net: if someone adds a provider that
// smuggles a hidden state hook, this test won't catch it directly, but
// the interface's narrow surface makes the smuggling obvious in review.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

class FakeRecognition {
  lang = "";
  interimResults = false;
  continuous = false;
  maxAlternatives = 1;
  onresult: ((ev: any) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;
  onend: (() => void) | null = null;
  private started = false;

  start() { this.started = true; }
  stop() {
    if (!this.started) return;
    this.started = false;
    // Simulate the browser firing onend after stop.
    queueMicrotask(() => this.onend?.());
  }
  emitResult(text: string, confidence: number, isFinal: boolean) {
    this.onresult?.({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: text, confidence }], { isFinal }),
      ],
    });
  }
  emitError(kind: string) {
    this.onerror?.({ error: kind });
  }
}

let fakeRec: FakeRecognition;

beforeEach(() => {
  fakeRec = new FakeRecognition();
  // `new SpeechRecognition()` must return our fake · use a real constructor
  // (vi.fn is not newable in the way the provider needs).
  function SpeechRecognitionCtor(this: any) { return fakeRec; }
  (globalThis as any).window = {
    SpeechRecognition: SpeechRecognitionCtor,
    speechSynthesis: {
      cancel: vi.fn(),
      speak: vi.fn(),
      getVoices: vi.fn(() => []),
    },
  };
  (globalThis as any).SpeechSynthesisUtterance = class {
    text: string;
    lang = "";
    rate = 1;
    pitch = 1;
    voice: any = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(t: string) { this.text = t; }
  };
});

afterEach(() => {
  delete (globalThis as any).window;
  delete (globalThis as any).SpeechSynthesisUtterance;
  vi.resetModules();
});

async function importProvider() {
  const mod = await import("../providers/browser");
  return mod.browserVoiceProvider;
}

describe("browserVoiceProvider · contract", () => {
  it("has a stable id and detects support from globals", async () => {
    const p = await importProvider();
    expect(p.id).toBe("browser");
    expect(p.isSupported()).toBe(true);
  });

  it("emits a final transcript through onFinal with text + confidence", async () => {
    const p = await importProvider();
    const finals: any[] = [];
    p.listen({
      onFinal: (t) => finals.push(t),
      onError: () => {},
    });
    fakeRec.emitResult("I want an oak staircase", 0.92, true);
    expect(finals).toHaveLength(1);
    expect(finals[0].text).toBe("I want an oak staircase");
    expect(finals[0].confidence).toBeCloseTo(0.92, 5);
    expect(finals[0].isFinal).toBe(true);
    // Contract: onFinal receives exactly {text, confidence, isFinal}. No
    // state handle, no chat API reference, no conversation_id.
    expect(Object.keys(finals[0]).sort()).toEqual(["confidence", "isFinal", "text"]);
  });

  it("emits partial results through onPartial when configured", async () => {
    const p = await importProvider();
    const partials: any[] = [];
    p.listen({
      onPartial: (t) => partials.push(t),
      onFinal: () => {},
      onError: () => {},
    });
    fakeRec.emitResult("I want an", 0.4, false);
    fakeRec.emitResult("I want an oak", 0.6, false);
    expect(partials).toHaveLength(2);
    expect(partials[0].isFinal).toBe(false);
    expect(partials[1].text).toBe("I want an oak");
  });

  it("treats no-speech as an empty final, not an error (didn't catch that fallback)", async () => {
    const p = await importProvider();
    const finals: any[] = [];
    const errs: string[] = [];
    p.listen({
      onFinal: (t) => finals.push(t),
      onError: (m) => errs.push(m),
    });
    fakeRec.emitError("no-speech");
    expect(errs).toHaveLength(0);
    expect(finals).toHaveLength(1);
    expect(finals[0].text).toBe("");
    expect(finals[0].confidence).toBe(0);
  });

  it("surfaces real errors through onError", async () => {
    const p = await importProvider();
    const errs: string[] = [];
    p.listen({
      onFinal: () => {},
      onError: (m) => errs.push(m),
    });
    fakeRec.emitError("audio-capture");
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]).toContain("audio-capture");
  });

  it("does not expose any hook to state, store, or chat API on the provider surface", async () => {
    const p = await importProvider();
    // The provider surface is deliberately narrow. If a future edit adds
    // methods like getState/setState/postMessage/callChat, this assertion
    // fails and the reviewer must justify the widening in an ADR.
    const allowed = new Set(["id", "isSupported", "listen", "speak", "cancelSpeech"]);
    for (const key of Object.keys(p)) expect(allowed.has(key)).toBe(true);
  });

  it("speak() is a no-op on empty text (doesn't queue silence)", async () => {
    const p = await importProvider();
    await p.speak("");
    // getSpeechSynthesis().speak should NOT have been called for empty text.
    const synth = (globalThis as any).window.speechSynthesis;
    expect(synth.speak).not.toHaveBeenCalled();
  });
});
