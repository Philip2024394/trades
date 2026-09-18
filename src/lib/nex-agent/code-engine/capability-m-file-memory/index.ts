// src/lib/nex-agent/code-engine/capability-m-file-memory/index.ts
//
// NEX1 · CAPABILITY M-1 · FILE MEMORY INDEX · public API.

export { createFileMemoryStore } from "./store";
export { detectLanguage } from "./language-detect";
export type {
  CreateFileMemoryStoreInput,
  FileMemoryStore,
  ForgetRecord,
  ListFilesFilter,
  ListFilesResult,
  Nex1FileMemoryEntry,
  PersistenceRecord,
  RecallResult,
  RememberFileInput,
  RememberOk,
  RememberRecord,
  RememberRefusalCode,
  RememberRefused,
  RememberResult,
} from "./types";
export {
  NEX1_FM_MAX_FILE_BYTES,
  NEX1_FM_MAX_SUMMARY_CHARS,
  NEX1_FM_MAX_TAGS,
  NEX1_FM_MAX_LIST_LIMIT,
  NEX1_FM_DEFAULT_LIST_LIMIT,
} from "./types";
