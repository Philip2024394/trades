// Shared types for credential verifiers.

export type VerifierInput = {
  number: string;
};

export type VerifierResult =
  | {
      status: "verified";
      displayLabel?: string;
      expiresAt?: string | null;
      raw?: unknown;
    }
  | {
      status: "expired" | "suspended" | "not-found";
      raw?: unknown;
    }
  | {
      status: "self-declared";
      raw?: unknown;
    }
  | {
      status: "error";
      error: string;
      raw?: unknown;
    };

export type Verifier = (input: VerifierInput) => Promise<VerifierResult>;
