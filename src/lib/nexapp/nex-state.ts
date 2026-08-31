// Shared NEX voice/state type · Philip 2026-08-30 · Phase 1 · Reconciliation.
// Extracted from the retired NexAppHome shell so downstream components
// (OrangeParticleField · NexIdentityButton · NexBottomNav · DirectoryPanel
// · CategoryConstellation) have a canonical import source once
// NexAppHome.tsx is deleted.
//
// The union matches the pre-retirement definition byte-for-byte so any
// legacy consumers get unchanged semantics — this file is a rehousing,
// not a redesign.
export type NexState = "idle" | "listening" | "thinking" | "speaking";
