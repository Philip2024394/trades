// data/nex1-code-engine/duplicate-f/module-b/vehicle.ts
// The OTHER Vehicle declaration · the consumer does NOT import this one.
// Structurally different from module-a on purpose · a naive scanner that
// picks either declaration risks wrong repairs.
export interface Vehicle {
  readonly serial: number;
  readonly nickname: string;
}
