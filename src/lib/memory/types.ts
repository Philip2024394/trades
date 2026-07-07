// Memory records — the durable, structured business archive.
//
// Facets shape is per record_type. Common conventions the projection
// handlers follow:
//
//   record_type = 'job':
//     facets: {
//       trade: string,
//       service: string,
//       materials?: string[],
//       colours?: string[],
//       techniques?: string[],
//       cost_band?: 'small' | 'medium' | 'large' | 'premium',
//       started_at?: iso,
//       completed_at?: iso,
//       customer_name?: string,
//       photos?: { url: string, tags: string[] }[],
//       review_summary?: string
//     }
//
//   record_type = 'customer':
//     facets: {
//       name, contact, first_job_at, last_job_at, total_jobs, ...
//     }
//
//   record_type = 'material_used':
//     facets: { name, category, supplier?, first_seen_at, uses_count, ... }

export const MEMORY_RECORD_TYPES = [
  "job",
  "customer",
  "material_used",
  "technique",
  "certification",
  "staff_member",
  "service",
  "vehicle",
  "service_area"
] as const;

export type MemoryRecordType = (typeof MEMORY_RECORD_TYPES)[number];

export type MemoryRecord = {
  id: string;
  merchantId: string;
  recordType: MemoryRecordType;
  facets: Record<string, unknown>;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  linkedEventIds: string[];
  createdAt: string;
  updatedAt: string;
};

/** Filter shape for structured Archive queries. All fields optional;
 *  omitted fields are unfiltered. */
export type MemoryQuery = {
  merchantId: string;
  recordType?: MemoryRecordType;
  /** Structured facet filter — matched via jsonb `@>` containment.
   *  Example: { trade: 'roofer', materials: ['slate'] } */
  facetMatch?: Record<string, unknown>;
  /** Postcode prefix — matches records whose postcode starts with. */
  postcodeStartsWith?: string;
  updatedSince?: string;
  limit?: number;
};
