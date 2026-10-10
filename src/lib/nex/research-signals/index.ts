// src/lib/nex/research-signals/index.ts
//
// UWI · Wave 4 · Research-signals public API.
// Founder-authorised programme.

export * from "./types";
export { detectBursts, DEFAULT_KLEINBERG, type KleinbergConfig } from "./kleinberg-burst";
export { runCusum, type CusumConfig } from "./cusum";
export { decomposeStlLite, type StlLiteConfig } from "./stl-lite";
export { simhashText, simhash64, hammingDistance64, toHex64, fnv1a64 } from "./simhash";
export { tokenise, charShingles, wordShingles, jaccard } from "./token-jaccard";
export {
  minhashSignature,
  estimatedJaccardFromMinHash,
  MinHashLshIndex,
  lshBandKeys,
} from "./minhash-lsh";
export { classifyWardley, positionalKey, type WardleyInput } from "./wardley-classifier";
export {
  SourceReliabilityLedger,
  DEFAULT_LEDGER,
  type LedgerConfig,
} from "./source-reliability-ledger";
export {
  DedupCascade,
  DEFAULT_DEDUP_CASCADE,
  sha256Hex,
  type DedupCandidate,
  type DedupCascadeConfig,
} from "./dedup-cascade";
