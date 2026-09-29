// src/lib/nex-native/calls/ringtone.ts
//
// Bridge 89a · Synthesized ringtone via Web Audio.
// ------------------------------------------------
// No asset file, no CDN fetch, no autoplay-policy gymnastics beyond
// the initial user-gesture requirement. The oscillator alternates
// between 800Hz and 1000Hz on 100ms slices — the classic two-tone
// telephone ring — for a 1.2s ring segment, then rests 0.8s, then
// repeats. Stops cleanly when the caller answers / declines / times
// out.
//
// Autoplay caveat: modern browsers require a user gesture before
// AudioContext can start. Incoming-call rings arrive without a
// gesture · the AudioContext will be created in "suspended" state
// and .resume() will fail silently until the user interacts. That's
// acceptable degradation: users on the calling tab or a recent
// interaction hear the ring; users with the tab in the background
// see only the visual overlay + browser tab title change (future).

"use client";

const TONE_A_HZ = 800;
const TONE_B_HZ = 1000;
const SLICE_MS = 100;
const RING_ON_MS = 1200;
const RING_OFF_MS = 800;

export interface Ringtone {
  start(): void;
  stop(): void;
}

/**
 * Create a ring loop. Returns a handle · start()/stop() are safe to
 * call multiple times. A single instance can be reused across
 * successive calls · call stop() then start() again.
 */
export function createRingtone(): Ringtone {
  let ctx: AudioContext | null = null;
  let osc: OscillatorNode | null = null;
  let gain: GainNode | null = null;
  let sliceTimer: ReturnType<typeof setTimeout> | null = null;
  let cycleTimer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let tone: "a" | "b" = "a";

  const ensureContext = (): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (ctx) return ctx;
    const AC = window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    gain = ctx.createGain();
    gain.gain.value = 0.15; // gentle · 15% volume
    gain.connect(ctx.destination);
    return ctx;
  };

  const startTone = (freq: number) => {
    if (!ctx || !gain) return;
    stopTone();
    osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start();
  };
  const stopTone = () => {
    if (osc) {
      try { osc.stop(); } catch { /* ignore */ }
      try { osc.disconnect(); } catch { /* ignore */ }
      osc = null;
    }
  };

  const tickSlice = () => {
    if (!running) return;
    tone = tone === "a" ? "b" : "a";
    startTone(tone === "a" ? TONE_A_HZ : TONE_B_HZ);
    sliceTimer = setTimeout(tickSlice, SLICE_MS);
  };

  const startCycle = () => {
    if (!running) return;
    tone = "a";
    startTone(TONE_A_HZ);
    sliceTimer = setTimeout(tickSlice, SLICE_MS);
    cycleTimer = setTimeout(() => {
      stopTone();
      if (sliceTimer) { clearTimeout(sliceTimer); sliceTimer = null; }
      cycleTimer = setTimeout(() => {
        if (running) startCycle();
      }, RING_OFF_MS);
    }, RING_ON_MS);
  };

  return {
    start(): void {
      if (running) return;
      running = true;
      const c = ensureContext();
      if (!c) { running = false; return; }
      // If the context is suspended (no prior user gesture), attempt a
      // resume. Silent fail is acceptable — visual ring still fires.
      void c.resume().catch(() => { /* silent */ });
      startCycle();
    },
    stop(): void {
      running = false;
      if (sliceTimer) { clearTimeout(sliceTimer); sliceTimer = null; }
      if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }
      stopTone();
    },
  };
}
