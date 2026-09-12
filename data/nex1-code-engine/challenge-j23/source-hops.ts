// J.2.3 fixture · a set of literal-producer functions used across the
// multi-hop tests. Each hop test asserts different expectations against
// these values.
export function h1(): number { return 1; }
export function h2(): number { return 2; }
export function h3(): number { return 3; }
export function h4(): number { return 4; }
export function getMode(): "on" | "off" { return "on"; }
