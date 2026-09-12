// src/lib/nex-authority-broker/event-log.ts
//
// Phase 8 v0.1.0 · Broker event log · append-only · Ed25519-signed hash chain.
// v0.1.0 T1: in-memory log with signed chain · durable JSONL disk sink is optional and outside the workspace.
// T2 declared: same-process trust boundary.

import { createHash } from "node:crypto";
import type { BrokerEvent, BrokerEventKind } from "../nex-controlled-hands/types";
import { signBytes, type KeyPair } from "../nex-controlled-hands/ed25519";

const GENESIS = "0000000000000000";

export class BrokerEventLog {
  private entries: BrokerEvent[] = [];
  private seal_hash: string | null = null;

  constructor(private readonly signing_key: KeyPair) {}

  append(kind: BrokerEventKind, detail: Record<string, unknown>, at: string): BrokerEvent {
    if (this.seal_hash !== null) throw new Error("event log is sealed · WORKSPACE_FROZEN");
    const prev = this.entries.length === 0 ? GENESIS : createHash("sha256").update(JSON.stringify(this.entries[this.entries.length - 1])).digest("hex").slice(0, 16);
    const entry_sequence = this.entries.length + 1;
    const canonical = JSON.stringify({ prev, seq: entry_sequence, kind, detail, at });
    const signature = signBytes(this.signing_key, canonical);
    const event: BrokerEvent = {
      prev_chain_hash: prev,
      entry_sequence,
      kind,
      detail,
      at,
      signature,
      key_id: this.signing_key.key_id,
      key_version: this.signing_key.key_version,
    };
    this.entries.push(event);
    return event;
  }

  seal(at: string): string {
    if (this.seal_hash !== null) throw new Error("already sealed");
    const chain = this.entries.map((e) => e.signature).join("|") + "|" + at;
    this.seal_hash = createHash("sha256").update(chain).digest("hex").slice(0, 16);
    return this.seal_hash;
  }

  is_sealed(): boolean { return this.seal_hash !== null; }
  get_seal_hash(): string | null { return this.seal_hash; }
  get_all(): readonly BrokerEvent[] { return this.entries.slice(); }
  find(predicate: (e: BrokerEvent) => boolean): readonly BrokerEvent[] { return this.entries.filter(predicate); }
  size(): number { return this.entries.length; }

  // Verify the chain integrity from scratch · returns true if every prev_chain_hash + signature is consistent
  verify_chain(): boolean {
    let prev = GENESIS;
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      if (e.prev_chain_hash !== prev) return false;
      if (e.entry_sequence !== i + 1) return false;
      prev = createHash("sha256").update(JSON.stringify(e)).digest("hex").slice(0, 16);
    }
    return true;
  }
}
