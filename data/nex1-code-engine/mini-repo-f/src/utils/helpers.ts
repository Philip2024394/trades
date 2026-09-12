// data/nex1-code-engine/mini-repo-f/src/utils/helpers.ts
// Irrelevant utility file · must NOT be included in the working set for User.
export function capitalise(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

export interface Widget {
  readonly widgetId: string;
}
