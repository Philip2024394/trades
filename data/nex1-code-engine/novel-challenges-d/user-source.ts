// data/nex1-code-engine/novel-challenges-d/user-source.ts
//
// Novel-challenge fixture · Capability D generalisation · numeric field on
// different symbol shape.

export interface User {
  readonly userId: string;
  readonly displayName: string;
}

export function makeUsers(names: readonly string[]): User[] {
  return names.map((displayName, i) => ({
    userId: `u${i}`,
    displayName,
  }));
}
