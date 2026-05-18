# PixelPlanet — Entity & Rule Schema Reference

> **Auto-generated** by `scripts/generate-entity-schema.js` on 2026-05-18 03:40 UTC.
> Re-run to pick up new condition types, actions, or triggers added to the codebase.

## Source file status

- `defaults`: ✅ read from source
- `types`: ✅ read from source
- `evaluator`: ✅ read from source
- `parser`: ✅ read from source

---

## Purpose

This document describes the exact JSON format expected by `engine_load_config()`.
You can paste it into a conversation with an AI assistant and ask it to generate
entity packs — collections of entity definitions and rules — in this format.

The engine is **data-driven**: everything a pixel does is described here.
There is no hardcoded physics. Adding a "Fire" entity that burns and spreads
is entirely doable by composing the primitives below.

> **Unknown types are silently ignored.**
> If the engine receives a condition type or action type it does not recognise
> it skips that condition (evaluates to `false`) or that action (no-op).
> This means bundles created for a newer engine version are safe to import into
> an older one — unknown behaviours simply don't fire.

---

## Top-level structure

```json
{
  "entities": "[ <EntityDef>, ... ]",
  "globalRules": "[ <Rule>, ... ]  // apply to ALL non-static pixels",
  "entityRules": {
    "<entityId as string>": "[ <Rule>, ... ]  // apply only to pixels with that ID"
  }
}
```

---

## Entity definition

```json
{
  "id": "number (1–254, unique)",
  "name": "string",
  "color": "[R, G, B, A]  // 0–255 each",
  "density": "number  // >0 = participates in gravity; 0 = floats/is static",
  "isStatic": "boolean  // true = never evaluated, immovable (e.g. Stone)",
  "variables": [
    {
      "name": "string  // identifier used in VariableCheck / ModifyVariable",
      "defaultVal": "number (0–65535)  // value assigned when cell is painted or spawned"
    }
  ]
}
```

**Notes:**
- Maximum **4 variables** per entity.
- Entity IDs are integers 1–254. ID 0 is reserved for EMPTY.
- `isStatic: true` entities are never touched by the rule evaluator at all —
  rules assigned to them are still stored but never run.
- `density` only matters if a global gravity rule checks `PropertyCheck density > 0`.
  New entities automatically fall if you keep the default global gravity rule.

---

## Rule structure

```json
{
  "id": "string  // unique identifier (no spaces recommended)",
  "trigger": "<Trigger>",
  "condition": "<Condition>  // single root condition (can nest AND/OR/NOT)",
  "actions": "[ <Action>, ... ]  // run in order; movement stops further actions"
}
```

### Evaluation order per cell per tick
1. Global rules are tried first (in array order). First rule that fires wins.
2. If no global rule fired, entity-specific rules are tried (in array order).
3. Within a rule: all actions run in order **unless** a movement action (Move, MoveFirst)
   succeeds — then execution stops (the cell is no longer at its original position).

---

## Triggers

Available values for the `trigger` field:

| Trigger | Description |
|---------|-------------|
| `OnTick` | Fires every simulation tick (~60 times/second). Use for continuous physics. |
| `OnRandomTick` | Fires on a random interval. Use for slow, stochastic changes (decay, spreading fire). Add `"interval": <ticks>` to set average cadence. |

---

## Conditions

Root condition for a rule. Can be any of the types below.
Nest `AND`, `OR`, and `NOT` arbitrarily to build complex logic.

### `Always` *(C++ enum: `COND_ALWAYS`)*

Always evaluates to true. Use as a no-op condition when you just want the actions to always run.

_No additional fields required._

**Example:**
```json
{ "type": "Always" }
```

---

### `NeighborCheck` *(C++ enum: `COND_NEIGHBOR`)*

Checks whether the cell in the given direction is a specific entity type.

| Field | Type | Description |
|-------|------|-------------|
| `dir` | `Direction` | Which neighbour to inspect. |
| `target` | `"EMPTY"|"ANY"|id` | "EMPTY" = empty cell, "ANY" = any non-empty cell, or an entity ID number. |

**Example:**
```json
{ "type": "NeighborCheck", "dir": "down", "target": "EMPTY" }
```

---

### `PropertyCheck` *(C++ enum: `COND_PROPERTY`)*

Checks a built-in numeric property of the entity that owns this cell.

| Field | Type | Description |
|-------|------|-------------|
| `prop` | `string` | One of the built-in properties: density. |
| `op` | `Op` | Comparison operator: < <= == != > >=. |
| `val` | `number` | Value to compare against. |

**Example:**
```json
{ "type": "PropertyCheck", "prop": "density", "op": ">", "val": 0 }
```

---

### `VariableCheck` *(C++ enum: `COND_VARIABLE`)*

Checks a named per-cell variable (defined on the entity). Variables are integers 0–65535.

| Field | Type | Description |
|-------|------|-------------|
| `varName` | `string` | Name of the variable as defined in entity.variables[].name. |
| `op` | `Op` | Comparison operator: < <= == != > >=. |
| `val` | `number` | Value to compare against (0–65535). |

**Example:**
```json
{ "type": "VariableCheck", "varName": "lifetime", "op": "<=", "val": 0 }
```

---

### `NeighborCount` *(C++ enum: `COND_NEIGHBOR`)*

Counts how many of the 8 surrounding cells match a target type and compares that count to a threshold.

| Field | Type | Description |
|-------|------|-------------|
| `target` | `"EMPTY"|"ANY"|id` | Cell type to count. |
| `op` | `Op` | Comparison operator: < <= == != > >=. |
| `val` | `number` | Number to compare the count against (0–8). |

**Example:**
```json
{ "type": "NeighborCount", "target": "ANY", "op": ">=", "val": 3 }
```

---

### `Chance` *(C++ enum: `COND_CHANCE`)*

Passes randomly with the given probability. Use to make behaviour non-deterministic.

| Field | Type | Description |
|-------|------|-------------|
| `val` | `number (0–100)` | Probability as a percentage (e.g. 25 = 25% chance). |

**Example:**
```json
{ "type": "Chance", "val": 25 }
```

---

### `AND` *(C++ enum: `COND_AND`)*

All child conditions must be true. Nests recursively.

| Field | Type | Description |
|-------|------|-------------|
| `children` | `Condition[]` | Array of sub-conditions, all of which must pass. |

**Example:**
```json
{ "type": "AND", "children": [
    { "type": "NeighborCheck", "dir": "down", "target": "EMPTY" },
    { "type": "Chance", "val": 50 }
  ]
}
```

---

### `OR` *(C++ enum: `COND_NEIGHBOR`)*

At least one child condition must be true.

| Field | Type | Description |
|-------|------|-------------|
| `children` | `Condition[]` | Array of sub-conditions, any of which may pass. |

**Example:**
```json
{ "type": "OR", "children": [
    { "type": "NeighborCheck", "dir": "left", "target": "EMPTY" },
    { "type": "NeighborCheck", "dir": "right", "target": "EMPTY" }
  ]
}
```

---

### `NOT` *(C++ enum: `COND_NOT`)*

Inverts a single child condition.

| Field | Type | Description |
|-------|------|-------------|
| `child` | `Condition` | A single sub-condition whose result is inverted. |

**Example:**
```json
{ "type": "NOT", "child": { "type": "NeighborCheck", "dir": "up", "target": "EMPTY" } }
```

---

## Actions

### `Move` *(C++ enum: `ACTION_MOVE`)*

Moves the cell one step in a single direction if the target cell is empty. Fails silently if blocked.

| Field | Type | Description |
|-------|------|-------------|
| `dir` | `Direction` | Direction to move. |

**Example:**
```json
{ "type": "Move", "dir": "down" }
```

---

### `MoveFirst` *(C++ enum: `ACTION_MOVE`)*

Tries each direction in order and moves to the first empty one. Use for diagonal spread (sand) or sideways flow (water).

| Field | Type | Description |
|-------|------|-------------|
| `dirs` | `Direction[]` | Ordered list of directions to try. |
| `randomize` | `boolean` | If true (default), shuffle the direction list each tick to remove sweep bias. |

**Example:**
```json
{ "type": "MoveFirst", "dirs": ["down-left", "down-right"], "randomize": true }
```

---

### `Transform` *(C++ enum: `ACTION_TRANSFORM`)*

Replaces this cell with a different entity type in-place. Variables are reset to the new entity's defaults.

| Field | Type | Description |
|-------|------|-------------|
| `targetId` | `number (entity ID)` | The ID of the entity to become. |

**Example:**
```json
{ "type": "Transform", "targetId": 4 }
```

---

### `Spawn` *(C++ enum: `ACTION_SPAWN`)*

Creates a new cell of the given entity type in a neighbouring slot. Does nothing if that slot is occupied.

| Field | Type | Description |
|-------|------|-------------|
| `targetId` | `number (entity ID)` | Entity type to spawn. |
| `dir` | `Direction` | Which neighbouring slot to spawn into. |

**Example:**
```json
{ "type": "Spawn", "targetId": 5, "dir": "up" }
```

---

### `Destroy` *(C++ enum: `ACTION_DESTROY`)*

Removes this cell from the grid (sets it to EMPTY).

_No additional fields required._

**Example:**
```json
{ "type": "Destroy" }
```

---

### `ModifyVariable` *(C++ enum: `ACTION_MOVE`)*

Mutates a named per-cell variable by the given amount. Clamped to 0–65535.

| Field | Type | Description |
|-------|------|-------------|
| `varName` | `string` | Name of the variable to modify (must exist in entity.variables). |
| `op` | `ModifyOp` | How to modify it: "+=" (Add (+)), "-=" (Subtract (-)), "*=" (Multiply (×)), "set" (Set (=)). |
| `val` | `number` | Amount to add/subtract/multiply/set. |

**Example:**
```json
{ "type": "ModifyVariable", "varName": "lifetime", "op": "-=", "val": 1 }
```

---

### `Eat` *(C++ enum: `ACTION_EAT`)*

Moves this cell one step in a given direction **into** a cell occupied by the target entity type, consuming it. Optionally grants the eater a variable bonus.

| Field | Type | Description |
|-------|------|-------------|
| `dir` | `Direction` | Direction of the prey. |
| `target` | `"ANY"|id` | Entity ID to eat, or "ANY" for any non-empty cell. |
| `gainVar` | `string` | (optional) Variable name on the eater to increase when eating succeeds. |
| `gainVal` | `number` | (optional) Amount to add to gainVar (default 0). |

**Example:**
```json
{ "type": "Eat", "dir": "up", "target": 5, "gainVar": "energy", "gainVal": 20 }
```

---

### `EatFirst` *(C++ enum: `ACTION_EAT`)*

Tries each direction in order and eats the first cell that matches the target type. Same as MoveFirst but for occupied cells.

| Field | Type | Description |
|-------|------|-------------|
| `dirs` | `Direction[]` | Ordered list of directions to try. |
| `randomize` | `boolean` | If true (default), shuffle the direction list each tick. |
| `target` | `"ANY"|id` | Entity ID to eat, or "ANY". |
| `gainVar` | `string` | (optional) Variable to increase on successful eat. |
| `gainVal` | `number` | (optional) Amount to gain. |

**Example:**
```json
{ "type": "EatFirst", "dirs": ["up", "left", "right", "down"], "target": 3, "randomize": true, "gainVar": "energy", "gainVal": 10 }
```

---

### `Swap` *(C++ enum: `ACTION_SWAP`)*

Swaps this cell's position with a neighbour of the given target type. Both cells and all their variables are exchanged. Used for buoyancy and swimming.

| Field | Type | Description |
|-------|------|-------------|
| `dir` | `Direction` | Direction of the cell to swap with. |
| `target` | `"ANY"|id` | Entity ID to swap with, or "ANY" for any non-empty cell. |

**Example:**
```json
{ "type": "Swap", "dir": "up", "target": 2 }
```

---

### `SwapFirst` *(C++ enum: `ACTION_SWAP`)*

Tries each direction in order and swaps with the first cell that matches the target type.

| Field | Type | Description |
|-------|------|-------------|
| `dirs` | `Direction[]` | Ordered list of directions to try. |
| `randomize` | `boolean` | If true (default), shuffle the direction list each tick. |
| `target` | `"ANY"|id` | Entity ID to swap with, or "ANY". |

**Example:**
```json
{ "type": "SwapFirst", "dirs": ["left", "right"], "target": 2, "randomize": true }
```

---

## Directions

Valid string values for any `dir` or `dirs` field:

| Value | Meaning |
|-------|---------|
| `"up"` | up |
| `"down"` | down |
| `"left"` | left |
| `"right"` | right |
| `"up-left"` | up → left |
| `"up-right"` | up → right |
| `"down-left"` | down → left |
| `"down-right"` | down → right |

---

## Comparison operators

Used in `PropertyCheck`, `VariableCheck`, and `NeighborCount`:

- `"<"`  
- `"<="`  
- `"=="`  
- `"!="`  
- `">"`  
- `">="`

---

## Variable modify operators

Used in the `ModifyVariable` action:

| Value | Meaning |
|-------|---------|
| `"+="` | Add (+) |
| `"-="` | Subtract (-) |
| `"*="` | Multiply (×) |
| `"set"` | Set (=) |

---

## C++ enum cross-reference

These are the internal engine names. Useful if you're reading `evaluator.cpp`
or `parser.cpp` alongside this document.

### ConditionType
- `COND_ALWAYS` — Always true
- `COND_NEIGHBOR` — Check neighbouring cell type
- `COND_PROPERTY` — Check entity built-in property (density)
- `COND_CHANCE` — Random probability gate
- `COND_AND` — All children must pass
- `COND_OR` — Any child must pass
- `COND_NOT` — Invert single child
- `COND_VARIABLE` — Check per-cell variable (Phase 3)
- `COND_NEIGHBOR_COUNT` — Count matching neighbours (Phase 3)

### ActionType
- `ACTION_MOVE` — Move to one direction if EMPTY
- `ACTION_MOVE_FIRST` — Try each dir in list; move to first EMPTY
- `ACTION_TRANSFORM` — Replace self with another entity type
- `ACTION_SPAWN` — Create a new cell in a neighbouring slot
- `ACTION_DESTROY` — Remove self (set to EMPTY)
- `ACTION_MODIFY_VARIABLE` — Mutate a per-cell variable (Phase 3)
- `ACTION_EAT` — Move into neighbour of target type, consuming it
- `ACTION_EAT_FIRST` — Try each dir; eat first matching target
- `ACTION_SWAP` — Swap positions with a neighbour of target type
- `ACTION_SWAP_FIRST` — Try each dir; swap with first matching target

---

## Full example — Lava + Spark entity pack

This is a ready-to-import bundle. It defines:
- **Lava**: a dense liquid that cools over time and randomly spawns Sparks upward.
- **Spark**: a lightweight particle that rises and dies when its lifetime reaches 0.

```json
{
  "entities": [
    {
      "id": 10,
      "name": "Lava",
      "color": [
        255,
        80,
        10,
        255
      ],
      "density": 2.5,
      "isStatic": false,
      "variables": [
        {
          "name": "heat",
          "defaultVal": 200
        }
      ]
    },
    {
      "id": 11,
      "name": "Spark",
      "color": [
        255,
        220,
        50,
        200
      ],
      "density": 0,
      "isStatic": false,
      "variables": [
        {
          "name": "lifetime",
          "defaultVal": 30
        }
      ]
    }
  ],
  "globalRules": [],
  "entityRules": {
    "10": [
      {
        "id": "lava_cool",
        "trigger": "OnRandomTick",
        "condition": {
          "type": "Always"
        },
        "actions": [
          {
            "type": "ModifyVariable",
            "varName": "heat",
            "op": "-=",
            "val": 1
          }
        ]
      },
      {
        "id": "lava_spawn_spark",
        "trigger": "OnTick",
        "condition": {
          "type": "AND",
          "children": [
            {
              "type": "VariableCheck",
              "varName": "heat",
              "op": ">",
              "val": 100
            },
            {
              "type": "Chance",
              "val": 5
            },
            {
              "type": "NeighborCheck",
              "dir": "up",
              "target": "EMPTY"
            }
          ]
        },
        "actions": [
          {
            "type": "Spawn",
            "targetId": 11,
            "dir": "up"
          }
        ]
      }
    ],
    "11": [
      {
        "id": "spark_die",
        "trigger": "OnTick",
        "condition": {
          "type": "VariableCheck",
          "varName": "lifetime",
          "op": "<=",
          "val": 0
        },
        "actions": [
          {
            "type": "Destroy"
          }
        ]
      },
      {
        "id": "spark_age",
        "trigger": "OnTick",
        "condition": {
          "type": "Always"
        },
        "actions": [
          {
            "type": "ModifyVariable",
            "varName": "lifetime",
            "op": "-=",
            "val": 1
          },
          {
            "type": "Move",
            "dir": "up"
          }
        ]
      }
    ]
  }
}
```

Paste this into the **Settings → Import** textarea in the PixelPlanet sidebar and
click **Merge (add)** to add Lava and Spark to your sandbox.

---

## Tips for AI-generated entity packs

1. **Give each entity a unique ID** that doesn't conflict with existing ones (IDs 1–3
   are Sand/Water/Stone by default). Start at ID 10+ for custom entities.

2. **Declare variables before using them.** A `VariableCheck` or `ModifyVariable`
   on a variable not in `entity.variables[]` silently does nothing.

3. **Rule ordering matters for death conditions.**
   The engine evaluates entity rules in list order. After a rule with a movement
   action succeeds, no further rules fire for that cell this tick.
   **Always place kill/death rules BEFORE movement rules.** For example:
   - Rule 1: `VariableCheck lifetime <= 0` → Destroy  *(checked first)*
   - Rule 2: `Always` → [ModifyVariable lifetime -= 1, Move]  *(fires only if still alive)*

   If you put the movement rule first, the death check is never reached while
   the cell is in motion, and the cell only dies when it can no longer move.

4. **Use `Chance` to add randomness.** Wrapping an action block in a `Chance: 5`
   condition makes it fire ~5% of ticks — good for decay, mutation, and rare events.

5. **`OnRandomTick` for slow processes.** Lifetime decay, fire spreading, and disease
   propagation look more natural with `OnRandomTick` than `OnTick`.

6. **Organism movement pattern.** To make a pixel "seek" food:
   - Store energy in a variable (`energy`, default 100).
   - Rule 1 (death): `VariableCheck energy <= 0` → Destroy
   - Rule 2 (seek + age): `Always` → [ModifyVariable energy -= 1, Move toward food]

7. **Eating for survival.** Combine `Eat` with energy gain and starvation death:
   - Give the predator an `energy` variable (default e.g. 200).
   - Rule 1: `VariableCheck energy <= 0` → Destroy  *(starve)*
   - Rule 2: `NeighborCheck dir:up target:<prey>` → EatFirst + gainVar:energy gainVal:50
   - Rule 3: `Always` → ModifyVariable energy -= 1  *(passive drain)*

8. **Swimming / buoyancy through liquid.** Use `Swap` or `SwapFirst` with the liquid entity ID:
   - A fish swimming sideways: `SwapFirst dirs:[left,right] target:<water ID>`
   - A bubble floating up: `Swap dir:up target:<water ID>`
   - Combine with a `NeighborCheck` condition to only swim when submerged.

9. **Photosynthesis.** Give a plant an `energy` variable. On `OnRandomTick`:
   - Condition: `NeighborCheck dir:up target:<sunlight ID>` (or `Chance` if no explicit sun)
   - Action: `ModifyVariable energy += 5`
   - Separate rule: `VariableCheck energy >= 100` + `Chance 10` → Spawn self in a neighbour slot

10. **Water cycle.** Model evaporation/condensation with Transform + Spawn:
    - Water on `OnRandomTick` + `Chance 1` + `NeighborCheck up EMPTY` → Transform to Steam
    - Steam moves up (`Move up`); when it reaches the top it has no EMPTY above → `NeighborCount EMPTY < 1` → Transform to Cloud
    - Cloud on `OnRandomTick` + `Chance 5` + `NeighborCheck down EMPTY` → Spawn Water below

11. **Flocking / grouping.** Use `NeighborCount target:<self ID> op:< val:2` to make a
    pixel move toward others of its kind (moves only when isolated, stops when grouped).

12. **The bundle format is portable.** Any bundle generated for this schema version can
    be imported into any PixelPlanet instance running the same engine phase.

---

_This document was generated from the live source files. Re-run
`node scripts/generate-entity-schema.js` after adding new condition types,
action types, or triggers to keep it current._
