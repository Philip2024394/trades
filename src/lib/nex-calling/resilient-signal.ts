// src/lib/nex-calling/resilient-signal.ts
//
// NEX Internal Calling · Resilient signalling client · Philip 2026-08-27.
//
// Wraps EventSource with:
//   · Exponential backoff reconnect on error (1s → 2s → 4s → ... capped at 30s)
//   · Automatic re-hello + presence request on reconnect so identity comes
//     back online with fresh SSE stream
//   · Optional callback for connection-state changes so the UI can show
//     "reconnecting…" / "offline" / "online" indicators
//   · Silent shutdown when the caller intentionally close()s (no reconnect)
//
// This is the resilience layer for bad signal / interference on the
// SIGNALLING channel. WebRTC media resilience lives in webrtc-client.ts
// (ICE restart, quality adaptation, voice-only fallback).

export type SignalConnState = "connecting" | "open" | "reconnecting" | "closed";

export interface ResilientSignalOptions {
  identity: string;
  signalBase: string;
  onMessage: (msg: Record<string, unknown>) => void | Promise<void>;
  onConnectionState?: (state: SignalConnState) => void;
  onError?: (err: string) => void;
}

const RECONNECT_INITIAL_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_BACKOFF_FACTOR = 2;
const JITTER_MS = 500;

export class ResilientSignal {
  private opts: ResilientSignalOptions;
  private es: EventSource | null = null;
  private state: SignalConnState = "connecting";
  private closed = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: ResilientSignalOptions) {
    this.opts = opts;
    this.connect();
  }

  private setState(next: SignalConnState) {
    if (this.state === next) return;
    this.state = next;
    this.opts.onConnectionState?.(next);
  }

  private connect() {
    if (this.closed) return;
    this.setState(this.reconnectAttempt === 0 ? "connecting" : "reconnecting");

    // Re-hello so the server's in-memory presence map includes this identity
    // even after signalling server restart or process replacement.
    fetch(`${this.opts.signalBase}/hello`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identity: this.opts.identity }),
    }).catch(() => { /* silent · SSE will surface the real problem */ });

    const url = `${this.opts.signalBase}/stream/${encodeURIComponent(this.opts.identity)}`;
    this.es = new EventSource(url);

    this.es.onopen = () => {
      this.reconnectAttempt = 0;
      this.setState("open");
    };
    this.es.onmessage = async (evt: MessageEvent) => {
      try {
        const msg = JSON.parse(String(evt.data));
        await this.opts.onMessage(msg);
      } catch (e) {
        this.opts.onError?.(`onmessage parse: ${(e as Error).message}`);
      }
    };
    this.es.onerror = () => {
      // Browser EventSource auto-reconnects, but we tear down and manage it
      // ourselves so we can add jittered exponential backoff, notify UI, and
      // re-hello on every attempt.
      if (this.closed) return;
      try { this.es?.close(); } catch { /* ignore */ }
      this.es = null;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.closed) return;
    this.setState("reconnecting");
    const base = Math.min(RECONNECT_MAX_MS, RECONNECT_INITIAL_MS * RECONNECT_BACKOFF_FACTOR ** this.reconnectAttempt);
    const jitter = Math.floor(Math.random() * JITTER_MS);
    const wait = base + jitter;
    this.reconnectAttempt += 1;
    this.opts.onError?.(`signalling reconnect in ${Math.round(wait/1000)}s (attempt ${this.reconnectAttempt})`);
    this.reconnectTimer = setTimeout(() => this.connect(), wait);
  }

  /** Current connection state — for UI indicators. */
  getState(): SignalConnState { return this.state; }

  /** Explicitly close · does NOT reconnect. */
  close(): void {
    this.closed = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    try { this.es?.close(); } catch { /* ignore */ }
    this.es = null;
    this.setState("closed");
  }
}
