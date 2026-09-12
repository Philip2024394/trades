// src/lib/nex-project-architecture/types.ts
//
// NEX1 · PROJECT ARCHITECTURE INTELLIGENCE · Phase 2B · types only.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// DESCRIPTIVE · not prescriptive. Read-only. Deterministic.

export type ArchConfidence = "OBSERVED" | "STRONGLY_INFERRED" | "WEAKLY_INFERRED" | "UNKNOWN" | "CONFLICTING";

export type NodeType = "file" | "package" | "module" | "symbol" | "external_dependency";

export type EdgeType = "import" | "require" | "dynamic_import" | "reexport" | "symbol_reference";

export type InternalExternal = "internal" | "external" | "unresolved";

export interface ArchNode {
  readonly node_id: string;              // sha256_prefix(source_path) · deterministic
  readonly node_type: NodeType;
  readonly source_path: string;
  readonly source_hash: string;
  readonly language: string;
  readonly package: string | null;
  readonly confidence: ArchConfidence;
  readonly detection_method: string;
}

export interface ArchEdge {
  readonly edge_id: string;              // sha256_prefix(source|target|edge_type)
  readonly source_node_id: string;
  readonly target_node_id: string;
  readonly edge_type: EdgeType;
  readonly direction: "out";              // always out from source to target
  readonly internal_external: InternalExternal;
  readonly confidence: ArchConfidence;
  readonly detection_method: string;
  readonly raw_specifier: string;
}

export interface ArchGraph {
  readonly nodes: readonly ArchNode[];
  readonly edges: readonly ArchEdge[];
}

export type BoundaryKind = "test" | "api" | "configuration" | "build" | "deployment" | "generated" | "vendor";

export interface BoundarySet {
  readonly boundary_kind: BoundaryKind;
  readonly files: readonly string[];
  readonly detection_method: string;
  readonly confidence: ArchConfidence;
}

export interface CycleObservation {
  readonly cycle_id: string;
  readonly members: readonly string[];   // sorted node_ids
  readonly size: number;
  readonly confidence: ArchConfidence;
  readonly raw_paths: readonly string[]; // actual cycle order (source paths)
}

export interface PackageObservation {
  readonly package_id: string;
  readonly package_name: string;
  readonly path: string;                 // relative root of the package
  readonly manifest_path: string | null;
  readonly file_count: number;
  readonly confidence: ArchConfidence;
}

export interface FanRecord {
  readonly node_id: string;
  readonly count: number;
}

export interface ArchScanStats {
  readonly files_scanned: number;
  readonly files_excluded: number;
  readonly imports_extracted: number;
  readonly bytes_read: number;
  readonly elapsed_ms: number;
  readonly sampling_methodology: string;
  readonly excluded_paths: readonly string[];
}

export interface DeterminismWitness {
  readonly first_run_hash: string;
  readonly second_run_hash: string;
  readonly identical: boolean;
}

export interface ByteIdentityWitness {
  readonly before_hash: string;
  readonly after_hash: string;
  readonly files_examined: number;
  readonly drift_count: number;
  readonly drifted: readonly string[];
}

export interface ProjectArchitecture {
  readonly record_type: "PROJECT_ARCHITECTURE";
  readonly architecture_id: string;
  readonly schema_version: string;
  readonly project_root: string;
  readonly scanned_at: string;
  readonly scan_stats: ArchScanStats;
  readonly graph: ArchGraph;
  readonly cycles: readonly CycleObservation[];
  readonly fan_in: readonly FanRecord[];
  readonly fan_out: readonly FanRecord[];
  readonly boundaries: Readonly<Record<BoundaryKind, BoundarySet>>;
  readonly packages: readonly PackageObservation[];
  readonly cross_package_edges: readonly ArchEdge[];
  readonly orphans: readonly string[];   // node_ids with fan_in=0 AND fan_out=0
  readonly determinism_witness: DeterminismWitness;
  readonly byte_identity_witness: ByteIdentityWitness;
  readonly limitations: string;
  readonly attribution: {
    readonly external_llm_used: false;
    readonly deterministic: true;
    readonly taught_by: "master_ai_engineer";
    readonly role: "project_architecture_intelligence";
    readonly authority: "descriptive_read_only";
  };
}
