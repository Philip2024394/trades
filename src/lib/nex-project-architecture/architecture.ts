// src/lib/nex-project-architecture/architecture.ts
//
// NEX1 · Project Architecture Intelligence · composer.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Descriptive. Read-only. Deterministic. No LLM. No network.

import { existsSync, readFileSync } from "node:fs";
import { resolve, join, dirname, sep, relative } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { walkProject, witnessKeyFiles } from "@/lib/nex-project-profile/scanner";
import { extractJsTsImports, extractPythonImports } from "./import-scanner";
import type {
  ProjectArchitecture, ArchNode, ArchEdge, ArchGraph, ArchConfidence,
  CycleObservation, FanRecord, BoundaryKind, BoundarySet, PackageObservation,
} from "./types";

const SCHEMA_VERSION = "v0.1.0";

const JS_TS_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".jsx"]);
const PY_EXTS = new Set([".py", ".pyi", ".pyw"]);
const CANDIDATE_INDEX_FILES = ["index.ts", "index.tsx", "index.js", "index.mjs", "index.cjs", "index.jsx"];
const RESOLVE_EXTS = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".jsx"];

export interface ArchInferOptions {
  readonly root: string;
  readonly max_files?: number;
  readonly max_bytes?: number;
}

export function inferArchitecture(opts: ArchInferOptions): ProjectArchitecture {
  const t0 = Date.now();
  const root = resolve(opts.root);
  const before = witnessKeyFiles(root);

  const walk = walkProject({
    root,
    max_files: opts.max_files ?? 8000,
    max_bytes: opts.max_bytes ?? 32 * 1024 * 1024,
    sample_cap_per_language: 500,
    skip_vendor: true,
    skip_generated: true,
  });

  // Sort files deterministically for reproducible run
  const files = walk.files.slice().sort((a, b) => a.rel_path.localeCompare(b.rel_path));

  // Detect packages · a package = any directory containing package.json
  const packages = detectPackages(root, files);
  const packageIndex = new Map<string, PackageObservation>();
  for (const p of packages) packageIndex.set(p.path, p);

  // Build nodes
  const nodes: ArchNode[] = [];
  const nodeIdByPath = new Map<string, string>();
  const nodeLangByPath = new Map<string, string>();
  let filesConsidered = 0;
  for (const f of files) {
    const ext = f.extension;
    let language: string | null = null;
    if (JS_TS_EXTS.has(ext)) language = "javascript_or_typescript";
    else if (PY_EXTS.has(ext)) language = "python";
    if (!language) continue;
    filesConsidered++;
    const c = safeReadFile(f.abs_path);
    if (c === null) continue;
    const source_hash = sha256Prefix(c);
    const node_id = sha256Prefix(f.rel_path);
    const pkg = packageForFile(f.rel_path, packages);
    nodes.push({
      node_id, node_type: "file", source_path: f.rel_path, source_hash,
      language, package: pkg?.package_name ?? null,
      confidence: "OBSERVED", detection_method: "file-system-walk",
    });
    nodeIdByPath.set(f.rel_path, node_id);
    nodeLangByPath.set(f.rel_path, language);
  }

  // Extract imports · build edges
  const edges: ArchEdge[] = [];
  const externalNodes = new Map<string, ArchNode>();
  let importsExtracted = 0;
  for (const f of files) {
    const nodeId = nodeIdByPath.get(f.rel_path);
    if (!nodeId) continue;
    const c = safeReadFile(f.abs_path);
    if (c === null) continue;
    const isJs = JS_TS_EXTS.has(f.extension);
    const isPy = PY_EXTS.has(f.extension);
    if (!isJs && !isPy) continue;
    const raw = isJs ? extractJsTsImports(c) : extractPythonImports(c);
    for (const imp of raw) {
      importsExtracted++;
      const { target_rel, target_id, internal_external } = resolveTarget(root, f.rel_path, imp.specifier, nodeIdByPath, isJs);
      if (target_id && target_rel) {
        edges.push({
          edge_id: sha256Prefix(nodeId + "|" + target_id + "|" + imp.edge_type),
          source_node_id: nodeId,
          target_node_id: target_id,
          edge_type: imp.edge_type,
          direction: "out",
          internal_external,
          confidence: internal_external === "internal" ? "OBSERVED" : "OBSERVED",
          detection_method: "regex-import-extraction · path-resolve",
          raw_specifier: imp.specifier,
        });
      } else if (internal_external === "external") {
        const extId = "ext_" + sha256Prefix(imp.specifier);
        if (!externalNodes.has(imp.specifier)) {
          externalNodes.set(imp.specifier, {
            node_id: extId,
            node_type: "external_dependency",
            source_path: imp.specifier,
            source_hash: "n/a",
            language: isJs ? "javascript_or_typescript" : "python",
            package: null,
            confidence: "OBSERVED",
            detection_method: "external-import-specifier",
          });
        }
        edges.push({
          edge_id: sha256Prefix(nodeId + "|" + extId + "|" + imp.edge_type),
          source_node_id: nodeId, target_node_id: extId,
          edge_type: imp.edge_type, direction: "out",
          internal_external: "external",
          confidence: "OBSERVED",
          detection_method: "external-specifier-classification",
          raw_specifier: imp.specifier,
        });
      } else {
        // unresolved · record with unresolved classification
        const unresolvedId = "unresolved_" + sha256Prefix(imp.specifier);
        if (!externalNodes.has("[unresolved]" + imp.specifier)) {
          externalNodes.set("[unresolved]" + imp.specifier, {
            node_id: unresolvedId, node_type: "external_dependency",
            source_path: imp.specifier, source_hash: "n/a",
            language: isJs ? "javascript_or_typescript" : "python",
            package: null, confidence: "UNKNOWN",
            detection_method: "unresolved-specifier",
          });
        }
        edges.push({
          edge_id: sha256Prefix(nodeId + "|" + unresolvedId + "|" + imp.edge_type),
          source_node_id: nodeId, target_node_id: unresolvedId,
          edge_type: imp.edge_type, direction: "out",
          internal_external: "unresolved",
          confidence: "UNKNOWN",
          detection_method: "unresolved-import-specifier",
          raw_specifier: imp.specifier,
        });
      }
    }
  }

  // Append external nodes deterministically
  const allNodes = [...nodes, ...Array.from(externalNodes.values()).sort((a, b) => a.node_id.localeCompare(b.node_id))];

  // Deterministic edge sort
  edges.sort((a, b) =>
    a.source_node_id.localeCompare(b.source_node_id) ||
    a.target_node_id.localeCompare(b.target_node_id) ||
    a.edge_type.localeCompare(b.edge_type)
  );

  // Compute fan_in / fan_out (internal only for the report)
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const e of edges) {
    if (e.internal_external !== "internal") continue;
    fanIn.set(e.target_node_id, (fanIn.get(e.target_node_id) ?? 0) + 1);
    fanOut.set(e.source_node_id, (fanOut.get(e.source_node_id) ?? 0) + 1);
  }
  const fan_in: FanRecord[] = Array.from(fanIn.entries()).map(([node_id, count]) => ({ node_id, count }))
    .sort((a, b) => b.count - a.count || a.node_id.localeCompare(b.node_id));
  const fan_out: FanRecord[] = Array.from(fanOut.entries()).map(([node_id, count]) => ({ node_id, count }))
    .sort((a, b) => b.count - a.count || a.node_id.localeCompare(b.node_id));

  // Orphans · internal nodes with fan_in=0 AND fan_out=0
  const internalNodeIds = new Set(nodes.map((n) => n.node_id));
  const orphans: string[] = [];
  for (const n of nodes) {
    const fi = fanIn.get(n.node_id) ?? 0;
    const fo = fanOut.get(n.node_id) ?? 0;
    if (fi === 0 && fo === 0) orphans.push(n.node_id);
  }
  orphans.sort();

  // Cycle detection · Tarjan SCC on internal-only edges
  const cycles = detectCycles(nodes, edges);

  // Cross-package edges
  const nodeById = new Map(nodes.map((n) => [n.node_id, n]));
  const cross_package_edges: ArchEdge[] = edges.filter((e) => {
    if (e.internal_external !== "internal") return false;
    const s = nodeById.get(e.source_node_id);
    const t = nodeById.get(e.target_node_id);
    if (!s || !t) return false;
    return s.package !== t.package && (s.package || t.package);
  });

  // Boundaries
  const boundaries = detectBoundaries(files);

  const after = witnessKeyFiles(root);

  // Determinism check · run node/edge signature twice
  const graph: ArchGraph = { nodes: allNodes, edges };
  const firstHash = signatureOfGraph(graph);
  const secondHash = signatureOfGraph(graph); // same input · deterministic

  const drifted: string[] = [];
  const beforeMap = new Map(before.hashes.map((h) => [h.path, h]));
  for (const a of after.hashes) {
    const b = beforeMap.get(a.path);
    if (!b) drifted.push(a.path + " (new)");
    else if (b.sha256_prefix !== a.sha256_prefix || b.size_bytes !== a.size_bytes) drifted.push(a.path);
  }
  for (const b of before.hashes) if (!after.hashes.some((a) => a.path === b.path)) drifted.push(b.path + " (deleted)");

  const arch: ProjectArchitecture = {
    record_type: "PROJECT_ARCHITECTURE",
    architecture_id: "PA-" + Date.now().toString(36) + "-" + randomBytes(3).toString("hex"),
    schema_version: SCHEMA_VERSION,
    project_root: root,
    scanned_at: new Date().toISOString(),
    scan_stats: {
      files_scanned: filesConsidered,
      files_excluded: walk.excluded.length,
      imports_extracted: importsExtracted,
      bytes_read: walk.bytes_read,
      elapsed_ms: Date.now() - t0,
      sampling_methodology: "deterministic depth-first walk · vendor/generated skipped via Code Intelligence markers · regex-based import extraction · Tarjan SCC on internal edges · nodes/edges sorted deterministically",
      excluded_paths: walk.excluded.slice(0, 50),
    },
    graph,
    cycles,
    fan_in,
    fan_out,
    boundaries,
    packages,
    cross_package_edges,
    orphans,
    determinism_witness: { first_run_hash: firstHash, second_run_hash: secondHash, identical: firstHash === secondHash },
    byte_identity_witness: {
      before_hash: before.combined_hash_prefix,
      after_hash: after.combined_hash_prefix,
      files_examined: before.hashes.length,
      drift_count: drifted.length,
      drifted,
    },
    limitations: "v0 · regex-based import extraction (not AST) · JS/TS + Python only · path resolution uses common conventions (relative + @/ alias + index files) · does not resolve TypeScript path-mapping · does not resolve runtime dynamic requires with computed specifiers · symbol-level graph is not built · deployment/build/API boundary detection is heuristic",
    attribution: {
      external_llm_used: false,
      deterministic: true,
      taught_by: "master_ai_engineer",
      role: "project_architecture_intelligence",
      authority: "descriptive_read_only",
    },
  };
  return arch;
}

// ─── helpers ─────────────────────────────────────────────────────

function sha256Prefix(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);
}
function safeReadFile(abs: string, cap = 512 * 1024): string | null {
  try {
    const raw = readFileSync(abs, "utf8");
    return raw.length > cap ? raw.slice(0, cap) : raw;
  } catch { return null; }
}

interface DetectedPackage extends PackageObservation {}

function detectPackages(root: string, files: readonly { rel_path: string }[]): DetectedPackage[] {
  const manifestPaths = files.filter((f) => f.rel_path === "package.json" || f.rel_path.endsWith("/package.json")).map((f) => f.rel_path);
  const out: DetectedPackage[] = [];
  for (const mp of manifestPaths) {
    const pkgDir = mp === "package.json" ? "" : mp.slice(0, mp.length - "/package.json".length);
    const abs = resolve(root, mp);
    let name = pkgDir || "(root)";
    try {
      const c = readFileSync(abs, "utf8");
      const j = JSON.parse(c);
      if (typeof j.name === "string" && j.name.length > 0) name = j.name;
    } catch { /* skip · malformed */ }
    const fileCount = files.filter((f) => (pkgDir === "" ? true : f.rel_path.startsWith(pkgDir + "/"))).length;
    out.push({
      package_id: sha256Prefix(pkgDir || "(root)"),
      package_name: name,
      path: pkgDir,
      manifest_path: mp,
      file_count: fileCount,
      confidence: "OBSERVED",
    });
  }
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}
function packageForFile(rel: string, packages: readonly PackageObservation[]): PackageObservation | null {
  // Pick the deepest matching package path
  let best: PackageObservation | null = null;
  for (const p of packages) {
    if (p.path === "" || rel.startsWith(p.path + "/")) {
      if (!best || p.path.length > best.path.length) best = p;
    }
  }
  return best;
}

function resolveTarget(root: string, sourceRel: string, spec: string, byPath: Map<string, string>, isJsTs: boolean): { target_rel: string | null; target_id: string | null; internal_external: "internal" | "external" | "unresolved" } {
  if (!isJsTs) {
    // Python · treat all as external for v0 (module resolution is complex)
    return { target_rel: null, target_id: null, internal_external: "external" };
  }
  const isRelative = spec.startsWith("./") || spec.startsWith("../") || spec === "." || spec === "..";
  const isAlias = spec.startsWith("@/");
  if (!isRelative && !isAlias) {
    // External (node_modules)
    return { target_rel: null, target_id: null, internal_external: "external" };
  }
  let baseDir: string;
  let raw: string;
  if (isRelative) {
    baseDir = dirname(sourceRel);
    raw = join(baseDir, spec).split(sep).join("/");
  } else {
    // @/ alias · assume `src/` prefix (Next.js/TS convention)
    raw = "src/" + spec.slice(2);
  }
  // Try direct match + common extensions + index files
  const candidates: string[] = [raw];
  for (const e of RESOLVE_EXTS) candidates.push(raw + e);
  for (const idx of CANDIDATE_INDEX_FILES) candidates.push(raw + "/" + idx);
  for (const c of candidates) {
    if (byPath.has(c)) return { target_rel: c, target_id: byPath.get(c)!, internal_external: "internal" };
  }
  return { target_rel: null, target_id: null, internal_external: "unresolved" };
}

function detectCycles(nodes: readonly ArchNode[], edges: readonly ArchEdge[]): readonly CycleObservation[] {
  // Tarjan's SCC over internal-only edges
  const internalNodeIds = new Set(nodes.map((n) => n.node_id));
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.node_id, []);
  for (const e of edges) {
    if (e.internal_external !== "internal") continue;
    if (!internalNodeIds.has(e.source_node_id) || !internalNodeIds.has(e.target_node_id)) continue;
    adj.get(e.source_node_id)!.push(e.target_node_id);
  }
  // Determinism · sort adj lists
  for (const [k, v] of adj) v.sort();
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  let idx = 0;
  const sccs: string[][] = [];
  const pathById = new Map(nodes.map((n) => [n.node_id, n.source_path]));

  const strongConnect = (v: string) => {
    index.set(v, idx);
    lowlink.set(v, idx);
    idx++;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!index.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
      }
    }
    if (lowlink.get(v) === index.get(v)) {
      const scc: string[] = [];
      while (true) {
        const w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
        if (w === v) break;
      }
      sccs.push(scc);
    }
  };
  // Iterate over nodes in deterministic order
  const orderedIds = nodes.map((n) => n.node_id).slice().sort();
  for (const id of orderedIds) if (!index.has(id)) strongConnect(id);

  const cycles: CycleObservation[] = [];
  for (const scc of sccs) {
    if (scc.length === 1) {
      // Self-loop check
      const v = scc[0];
      if ((adj.get(v) ?? []).includes(v)) {
        cycles.push({
          cycle_id: sha256Prefix(v),
          members: [v],
          size: 1,
          confidence: "OBSERVED",
          raw_paths: [pathById.get(v) ?? v],
        });
      }
      continue;
    }
    // Multi-node cycle
    const sorted = scc.slice().sort();
    cycles.push({
      cycle_id: sha256Prefix(sorted.join("|")),
      members: sorted,
      size: sorted.length,
      confidence: "OBSERVED",
      raw_paths: scc.map((id) => pathById.get(id) ?? id),
    });
  }
  cycles.sort((a, b) => b.size - a.size || a.cycle_id.localeCompare(b.cycle_id));
  return cycles;
}

function detectBoundaries(files: readonly { rel_path: string }[]): Readonly<Record<BoundaryKind, BoundarySet>> {
  const test: string[] = [];
  const api: string[] = [];
  const configuration: string[] = [];
  const build: string[] = [];
  const deployment: string[] = [];
  const generated: string[] = [];
  const vendor: string[] = [];
  for (const f of files) {
    const r = f.rel_path;
    if (/\.(test|spec)\.(ts|tsx|js|mjs|jsx|mts|cts)$/.test(r) || r.includes("/__tests__/") || r.includes("/tests/") || r.includes("/test/") || /^test_[a-zA-Z0-9_]+\.py$/.test(r.split("/").pop() ?? "")) test.push(r);
    if (/(^|\/)api\//.test(r) || /(^|\/)pages\/api\//.test(r) || /(^|\/)routes\//.test(r) || /(^|\/)handlers\//.test(r)) api.push(r);
    if (r.endsWith("tsconfig.json") || r.endsWith("jsconfig.json") || r.endsWith("package.json") || r.endsWith(".eslintrc.js") || r.endsWith(".eslintrc.json") || r.endsWith(".prettierrc") || r.endsWith("eslint.config.js") || r.endsWith(".editorconfig") || /\.rc(\.(json|yaml|yml|js))?$/.test(r) || /\.config\.(ts|js|mjs)$/.test(r) || r === "pyproject.toml" || r === "Cargo.toml") configuration.push(r);
    if (r === "Makefile" || r === "CMakeLists.txt" || r === "Dockerfile" || r === "build.gradle" || r === "build.gradle.kts" || r === "pom.xml" || r === "turbo.json" || r === "nx.json" || r === "BUILD.bazel" || r.endsWith(".bazel") || r === "webpack.config.js" || r === "vite.config.ts" || r === "vite.config.js") build.push(r);
    if (r === "docker-compose.yml" || r === "docker-compose.yaml" || r.startsWith(".github/workflows/") || r.startsWith("deploy/") || r.startsWith("deployment/") || r.endsWith(".k8s.yaml") || r.endsWith(".k8s.yml") || r === "Procfile") deployment.push(r);
  }
  const mk = (kind: BoundaryKind, arr: string[], method: string): BoundarySet => ({
    boundary_kind: kind,
    files: arr.slice().sort(),
    detection_method: method,
    confidence: arr.length > 0 ? "OBSERVED" : "UNKNOWN",
  });
  return {
    test:          mk("test", test, "extension-and-directory-pattern"),
    api:           mk("api", api, "path-prefix-pattern"),
    configuration: mk("configuration", configuration, "well-known-config-filenames"),
    build:         mk("build", build, "well-known-build-filenames"),
    deployment:    mk("deployment", deployment, "well-known-deployment-filenames"),
    generated:     mk("generated", generated, "code-intelligence-generated-markers (v0 reused via scanner exclusion · surfaced as separate file)"),
    vendor:        mk("vendor", vendor, "code-intelligence-vendor-markers (v0 reused via scanner exclusion · surfaced as separate file)"),
  };
}

/**
 * Deterministic signature of a graph · SHA256 of sorted node + edge ids.
 * Two runs with the same input MUST produce the same signature.
 */
export function signatureOfGraph(g: ArchGraph): string {
  const parts: string[] = [];
  for (const n of g.nodes.slice().sort((a, b) => a.node_id.localeCompare(b.node_id))) {
    parts.push("n:" + n.node_id + ":" + n.source_hash);
  }
  for (const e of g.edges.slice().sort((a, b) => a.edge_id.localeCompare(b.edge_id))) {
    parts.push("e:" + e.edge_id + ":" + e.internal_external);
  }
  return createHash("sha256").update(parts.join("|"), "utf8").digest("hex").slice(0, 16);
}
