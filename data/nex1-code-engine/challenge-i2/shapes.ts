// I.2 fixture · one interface exposing every field type the negative-proof
// synthesiser is expected to handle plus one it must refuse.

export interface ShapesSettings {
  readonly a: number;
  readonly b: string;
}

export interface Shapes {
  readonly ageNum: number;
  readonly nameStr: string;
  readonly activeBool: boolean;
  readonly tagsArr: readonly string[];
  readonly kindUnion: "widget" | "gadget";
  readonly settingsComplex: ShapesSettings;
}
