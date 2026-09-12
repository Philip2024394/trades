// data/nex1-code-engine/mini-repo-f/src/callers/bar/index.ts
import type { User } from "../../types/deep/user";
export function buildBarUsers(names: readonly string[]): User[] {
  return names.map((displayName, i) => ({ userId: `bar-${i}`, displayName }));
}
