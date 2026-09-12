// data/nex1-code-engine/novel-challenge/widget-source.ts
//
// Novel-challenge fixture for NEX1 Capability A independence measurement.
// Different symbols, different file, different type shape from Sprint 2.5.
// This file is authored as the challenge target; NEX1's authoring loop
// is expected to close the ripple entirely on its own (no teacher edits).

export interface Widget {
  readonly id: string;
  readonly label: string;
}

export function makeWidgets(labels: readonly string[]): Widget[] {
  return labels.map((label, i) => ({
    id: `w${i}`,
    label,
  }));
}
