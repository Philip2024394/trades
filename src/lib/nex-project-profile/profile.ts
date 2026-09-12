// src/lib/nex-project-profile/profile.ts
//
// NEX1 · PROJECT PROFILE · composer.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// READ-ONLY. Composes a full ProjectProfile from deterministic detectors.
// Reuses Code Intelligence generated/vendor definitions via scanner.

import { randomBytes } from "node:crypto";
import type { ProjectProfile } from "./types";
import { walkProject, witnessKeyFiles } from "./scanner";
import {
  detectProjectType,
  detectRepositoryStructure,
  detectLanguages,
  detectFrameworks,
  detectPackageManagers,
  detectBuildSystems,
  detectOrganisation,
  detectTooling,
  detectStyleSignals,
  detectStructureSignals,
} from "./detectors";

const SCHEMA_VERSION = "v0.1.0";
const DEFAULT_MAX_FILES = 8000;
const DEFAULT_MAX_BYTES = 32 * 1024 * 1024; // 32 MB budget for content-sniff
const DEFAULT_SAMPLE_CAP = 200;

export interface InferOptions {
  readonly root: string;
  readonly max_files?: number;
  readonly max_bytes?: number;
  readonly sample_cap_per_language?: number;
}

export function inferProfile(opts: InferOptions): ProjectProfile {
  const t0 = Date.now();
  const before = witnessKeyFiles(opts.root);
  const walk = walkProject({
    root: opts.root,
    max_files: opts.max_files ?? DEFAULT_MAX_FILES,
    max_bytes: opts.max_bytes ?? DEFAULT_MAX_BYTES,
    sample_cap_per_language: opts.sample_cap_per_language ?? DEFAULT_SAMPLE_CAP,
    skip_vendor: true,
    skip_generated: true,
  });
  const project_type       = detectProjectType(walk.files, opts.root);
  const repo_structure     = detectRepositoryStructure(walk.files, opts.root);
  const langs              = detectLanguages(walk.files);
  const frameworks         = detectFrameworks(walk.files, opts.root);
  const pkg_mgrs           = detectPackageManagers(walk.files, opts.root);
  const build_systems      = detectBuildSystems(walk.files, opts.root);
  const org                = detectOrganisation(walk.files, walk.excluded);
  const tooling            = detectTooling(walk.files, opts.root);
  const style              = detectStyleSignals(walk.files, opts.sample_cap_per_language ?? DEFAULT_SAMPLE_CAP);
  const structure          = detectStructureSignals(walk.files);
  const after = witnessKeyFiles(opts.root);
  const drifted: string[] = [];
  const beforeMap = new Map(before.hashes.map((h) => [h.path, h]));
  for (const a of after.hashes) {
    const b = beforeMap.get(a.path);
    if (!b) drifted.push(a.path + " (new)");
    else if (b.sha256_prefix !== a.sha256_prefix || b.size_bytes !== a.size_bytes) drifted.push(a.path);
  }
  for (const b of before.hashes) if (!after.hashes.some((a) => a.path === b.path)) drifted.push(b.path + " (deleted)");
  const conflicts: Array<{ topic: string; signals: readonly string[]; notes: string }> = [];
  const styleObj = style;
  for (const [k, v] of Object.entries(styleObj) as [keyof typeof styleObj, any][]) {
    if (v?.state === "CONFLICTING") conflicts.push({ topic: `style.${k}`, signals: [], notes: `supporting=${v.supporting_count} counter=${v.counter_count}` });
  }
  return {
    record_type: "PROJECT_PROFILE",
    profile_id: "PP-" + Date.now().toString(36) + "-" + randomBytes(3).toString("hex"),
    schema_version: SCHEMA_VERSION,
    project_root: opts.root,
    scanned_at: new Date().toISOString(),
    scan_stats: {
      files_scanned: walk.files.length,
      files_excluded: walk.excluded.length,
      sample_caps: { code_files: opts.sample_cap_per_language ?? DEFAULT_SAMPLE_CAP },
      sampling_methodology: "deterministic depth-first walk · vendor/generated markers reused from Code Intelligence · content-sniff capped at 4KB per file · style samples capped at 100-200 code files",
      excluded_paths: walk.excluded.slice(0, 50),
      scanned_bytes: walk.bytes_read,
      elapsed_ms: Date.now() - t0,
    },
    identity: {
      project_type,
      repository_structure: repo_structure,
      primary_languages: langs.primary,
      secondary_languages: langs.secondary,
      detected_frameworks: frameworks,
      detected_build_systems: build_systems,
      detected_package_managers: pkg_mgrs,
    },
    organisation: {
      source_directories: org.source,
      test_directories: org.tests,
      configuration_directories: org.config,
      generated_directories: org.generated,
      vendor_directories: org.vendor,
      asset_directories: org.assets,
    },
    tooling: {
      package_manager: tooling.package_manager,
      build_command_declared: tooling.build_command,
      test_command_declared: tooling.test_command,
      lint_configuration: tooling.lint_config,
      formatter_configuration: tooling.formatter_config,
      type_checker_configuration: tooling.type_checker_config,
      framework_configuration: tooling.framework_config,
    },
    style_signals: {
      indentation: style.indentation,
      quote_convention: style.quote_convention,
      semicolon_convention: style.semicolon_convention,
      file_naming_pattern: style.file_naming_pattern,
      test_naming_pattern: style.test_naming_pattern,
    },
    structure_signals: {
      top_level_directory_counts: structure.top_level_dirs,
      typical_source_file_location: structure.typical_source_location,
      typical_test_file_location: structure.typical_test_location,
      detected_index_files: structure.index_files,
      detected_barrel_files: structure.barrel_files,
    },
    conflicts,
    limitations: "v0 · sampling-based style detection · generated/vendor detection reuses Code Intelligence markers · does not parse JS/TS AST for naming (regex on basenames only) · does not follow symlinks · does not scan into vendor/build/dist/node_modules · file size sniff capped at 4KB",
    byte_identity_witness: {
      before_hash_prefix: before.combined_hash_prefix,
      after_hash_prefix: after.combined_hash_prefix,
      identical: drifted.length === 0,
      drifted,
    },
    attribution: {
      external_llm_used: false,
      deterministic: true,
      taught_by: "master_ai_engineer",
      role: "project_profile_scanner",
      authority: "descriptive_read_only",
    },
  };
}
