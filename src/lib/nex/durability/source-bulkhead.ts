// src/lib/nex/durability/source-bulkhead.ts
//
// UWI · Wave 2 · D5 · Source-class bulkhead (~80 LOC)
// Founder-authorised programme.
//
// Path B lesson generalised: a slow source class must not starve
// resources from healthy classes. Each source class (BMKG · OSM ·
// Wikidata · Overpass · Kemenparekraf · etc.) gets its own bulkhead
// with a bounded concurrency limit and a bounded overflow queue.
// Beyond queue_limit, calls fail-fast with BulkheadSaturatedError
// rather than accumulate unbounded backpressure.

export interface BulkheadConfig {
  /** Maximum concurrent in-flight calls for this source class. */
  readonly max_concurrent: number;
  /** Maximum queued calls waiting for a slot. 0 = fail-fast when saturated. */
  readonly queue_limit: number;
}

export class BulkheadSaturatedError extends Error {
  readonly source_class: string;
  readonly in_flight: number;
  readonly queued: number;
  constructor(source_class: string, in_flight: number, queued: number) {
    super(
      `bulkhead saturated for source class '${source_class}' (in_flight=${in_flight}, queued=${queued})`,
    );
    this.name = "BulkheadSaturatedError";
    this.source_class = source_class;
    this.in_flight = in_flight;
    this.queued = queued;
  }
}

export class SourceBulkhead {
  private in_flight = 0;
  private queue: Array<() => void> = [];

  constructor(public readonly source_class: string, public readonly config: BulkheadConfig) {
    if (config.max_concurrent <= 0) throw new Error("Bulkhead max_concurrent must be > 0");
    if (config.queue_limit < 0) throw new Error("Bulkhead queue_limit must be >= 0");
  }

  /** Run `fn` under bulkhead protection. Throws BulkheadSaturatedError
   *  if both in-flight and queue slots are exhausted. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.in_flight >= this.config.max_concurrent) {
      if (this.queue.length >= this.config.queue_limit) {
        throw new BulkheadSaturatedError(this.source_class, this.in_flight, this.queue.length);
      }
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.in_flight += 1;
    try {
      return await fn();
    } finally {
      this.in_flight -= 1;
      const next = this.queue.shift();
      if (next) next();
    }
  }

  snapshot(): { source_class: string; in_flight: number; queued: number } {
    return {
      source_class: this.source_class,
      in_flight: this.in_flight,
      queued: this.queue.length,
    };
  }
}

/** Registry that lazily creates a bulkhead per source class. */
export class SourceBulkheadRegistry {
  private bulkheads = new Map<string, SourceBulkhead>();

  constructor(public readonly defaultConfig: BulkheadConfig) {}

  get(source_class: string, config: BulkheadConfig = this.defaultConfig): SourceBulkhead {
    let b = this.bulkheads.get(source_class);
    if (!b) {
      b = new SourceBulkhead(source_class, config);
      this.bulkheads.set(source_class, b);
    }
    return b;
  }

  async run<T>(
    source_class: string,
    fn: () => Promise<T>,
    config?: BulkheadConfig,
  ): Promise<T> {
    return this.get(source_class, config).run(fn);
  }

  snapshotAll(): Array<{ source_class: string; in_flight: number; queued: number }> {
    return Array.from(this.bulkheads.values()).map((b) => b.snapshot());
  }
}
