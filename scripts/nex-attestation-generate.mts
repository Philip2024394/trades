// Generate a one-time NEX substrate-attestation Ed25519 keypair.
//
// Usage:  npx tsx scripts/nex-attestation-generate.mts
//
// This script is expected to be run ONCE by the founder. It:
//   1. Generates a fresh Ed25519 keypair.
//   2. Prints the PUBLIC key DER hex (paste into wo13-attestation.ts).
//   3. Prints the PRIVATE key PKCS8 hex (save OFFLINE, e.g. USB key + safe).
//
// The private key must never enter the repository.
// If you re-run this script, the previous key is invalidated; you must
// re-sign every founder-key manifest and the substrate integrity table.

import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const public_der_hex  = (publicKey.export({ type: "spki",  format: "der" }) as Buffer).toString("hex");
const private_p8_hex  = (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex");

console.log("=== NEX substrate-attestation keypair ===");
console.log("");
console.log("PUBLIC KEY (paste into src/lib/nex1-orchestrator/wo13-attestation.ts):");
console.log(public_der_hex);
console.log("");
console.log("PRIVATE KEY (SAVE OFFLINE — NEVER COMMIT):");
console.log(private_p8_hex);
console.log("");
console.log("After committing the public key, save the private key somewhere");
console.log("that never touches the repo (USB key, encrypted vault, HSM).");
