// Shared TypeScript interfaces that mirror the Rust rule AST.
// Used by the UI to construct entity/rule JSON sent to the WASM engine.

export interface EntityDef {
  id: number
  name: string
  /** RGBA, each channel 0-255 */
  color: [number, number, number, number]
  density: number
}

export type Direction =
  | 'Up' | 'Down' | 'Left' | 'Right'
  | 'UpLeft' | 'UpRight' | 'DownLeft' | 'DownRight'

export type Condition =
  | { type: 'NeighborCheck'; dir: Direction; target_id: number }
  | { type: 'Chance';        probability: number }
  | { type: 'And';           checks: Condition[] }
  | { type: 'Or';            checks: Condition[] }
  | { type: 'Not';           check: Condition }

export type Action =
  | { type: 'Swap';      dir: Direction }
  | { type: 'Transform'; target_id: number }
  | { type: 'Destroy' }

export interface Rule {
  entity_id: number
  trigger: 'OnTick'
  condition: Condition | null
  actions: Action[]
}
