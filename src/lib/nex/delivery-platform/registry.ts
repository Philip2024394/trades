// Delivery Platform · registry + dispatch.
//
// New formats add a registered Exporter · never modify a switch. Registration
// is idempotent per format · re-registering replaces the prior entry (useful
// during phased upgrades from stub → shipped).
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

import type { Exporter, DeliveryFormat, DeliveryResult, DeliveryOptions } from "./types";

const REGISTRY = new Map<DeliveryFormat, Exporter<unknown>>();

export function register<Doc>(exporter: Exporter<Doc>): Exporter<Doc> {
  REGISTRY.set(exporter.format, exporter as Exporter<unknown>);
  return exporter;
}

export function unregister(format: DeliveryFormat): void { REGISTRY.delete(format); }

export function get(format: DeliveryFormat): Exporter<unknown> | undefined { return REGISTRY.get(format); }

export function list(): readonly Exporter<unknown>[] { return Array.from(REGISTRY.values()); }

export function shippedFormats(): readonly DeliveryFormat[] {
  return list().filter((e) => e.status === "shipped").map((e) => e.format);
}

export async function deliver<Doc>(format: DeliveryFormat, doc: Doc, opts?: DeliveryOptions): Promise<DeliveryResult> {
  const exp = REGISTRY.get(format);
  if (!exp) throw new Error(`No exporter registered for format: ${format}`);
  return (exp as Exporter<Doc>).export(doc, opts);
}

/** Reset the registry · test-only. */
export function clearRegistry(): void { REGISTRY.clear(); }

export function isRegistered(format: DeliveryFormat): boolean { return REGISTRY.has(format); }
