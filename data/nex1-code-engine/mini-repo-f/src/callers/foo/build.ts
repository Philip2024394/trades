// data/nex1-code-engine/mini-repo-f/src/callers/foo/build.ts
import type { User } from "../../types/deep/user";
export function buildFooUsers(names: readonly string[]): User[] {
  return names.map((displayName, i) => ({ userId: `foo-${i}`, displayName }));
}
