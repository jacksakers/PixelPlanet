#!/usr/bin/env node
/**
 * scripts/generate-entity-schema.js
 *
 * Generates ENTITY_SCHEMA.md — a reference document describing every JSON
 * field, condition type, action type, trigger, and operator that the
 * PixelPlanet engine understands.
 *
 * Run from the repo root:
 *   node scripts/generate-entity-schema.js
 *   node scripts/generate-entity-schema.js --output docs/ENTITY_SCHEMA.md
 *
 * The script reads the live source files to keep the schema up to date.
 * If a source file is not found it falls back to the last-known lists so
 * the document is still useful outside the repo.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── output path ─────────────────────────────────────────────────────────────
const outArg = process.argv.indexOf('--output');
const OUTPUT = outArg !== -1
  ? resolve(process.argv[outArg + 1])
  : resolve(ROOT, 'ENTITY_SCHEMA.md');

// ─── helpers ─────────────────────────────────────────────────────────────────
function tryRead(relPath) {
  try { return readFileSync(resolve(ROOT, relPath), 'utf8'); }
  catch { return null; }
}

/** Extract quoted string array from a JS `export const FOO = [...]` declaration. */
function extractJsArray(src, varName) {
  if (!src) return null;
  const re = new RegExp(`export\\s+const\\s+${varName}\\s*=\\s*\\[([^\\]]+)\\]`);
  const m = src.match(re);
  if (!m) return null;
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}

/** Extract { value, label } pairs from MODIFY_OPS array. */
function extractModifyOps(src) {
  if (!src) return null;
  const block = src.match(/export\s+const\s+MODIFY_OPS\s*=\s*\[([^\]]+)\]/s);
  if (!block) return null;
  const pairs = [...block[1].matchAll(/value:\s*'([^']+)'[^}]*label:\s*'([^']+)'/g)];
  return pairs.map(m => ({ value: m[1], label: m[2] }));
}

/** Extract C++ enum string-name pairs from types.hpp comments. */
function extractCppEnum(src, enumName) {
  if (!src) return null;
  const re = new RegExp(`enum\\s+${enumName}[^{]*\\{([^}]+)\\}`, 's');
  const m = src.match(re);
  if (!m) return null;
  // Each line looks like:  NAME = n,  // comment
  return [...m[1].matchAll(/(\w+)\s*=\s*\d+,?\s*(?:\/\/\s*(.*))?/g)]
    .map(x => ({ name: x[1], comment: (x[2] || '').trim() }));
}

// ─── read source files ───────────────────────────────────────────────────────
const defaultsJs = tryRead('ui/src/shared/defaults.js');
const typesHpp   = tryRead('engine/src/core/types.hpp');
const evaluatorCpp = tryRead('engine/src/logic/evaluator.cpp');
const parserCpp    = tryRead('engine/src/logic/parser.cpp');

// ─── fallback constants (kept up to date at Phase 3) ─────────────────────────
const FALLBACK = {
  CONDITION_TYPES: [
    'Always', 'NeighborCheck', 'PropertyCheck', 'VariableCheck',
    'NeighborCount', 'Chance', 'AND', 'OR', 'NOT',
  ],
  ACTION_TYPES: [
    'Move', 'MoveFirst', 'Transform', 'Spawn', 'Destroy', 'ModifyVariable',
    'Eat', 'EatFirst', 'Swap', 'SwapFirst', 'MoveToward', 'MoveAway',
  ],
  DIRECTIONS: [
    'up', 'down', 'left', 'right',
    'up-left', 'up-right', 'down-left', 'down-right',
    'any',
  ],
  TRIGGERS: ['OnTick', 'OnRandomTick'],
  PROPERTY_OPS: ['<', '<=', '==', '!=', '>', '>='],
  BUILT_IN_PROPS: ['density'],
  MODIFY_OPS: [
    { value: '+=',  label: 'Add' },
    { value: '-=',  label: 'Subtract' },
    { value: '*=',  label: 'Multiply' },
    { value: 'set', label: 'Set (=)' },
  ],
};

// ─── live values (prefer source-parsed, fall back to constants) ───────────────
const CONDITION_TYPES = extractJsArray(defaultsJs, 'CONDITION_TYPES') ?? FALLBACK.CONDITION_TYPES;
const ACTION_TYPES    = extractJsArray(defaultsJs, 'ACTION_TYPES')    ?? FALLBACK.ACTION_TYPES;
const DIRECTIONS      = extractJsArray(defaultsJs, 'DIRECTIONS')      ?? FALLBACK.DIRECTIONS;
const TRIGGERS        = extractJsArray(defaultsJs, 'TRIGGERS')        ?? FALLBACK.TRIGGERS;
const PROPERTY_OPS    = extractJsArray(defaultsJs, 'PROPERTY_OPS')    ?? FALLBACK.PROPERTY_OPS;
const BUILT_IN_PROPS  = extractJsArray(defaultsJs, 'BUILT_IN_PROPS')  ?? FALLBACK.BUILT_IN_PROPS;
const MODIFY_OPS      = extractModifyOps(defaultsJs)                  ?? FALLBACK.MODIFY_OPS;

// C++ enum names for cross-referencing
const cppConditions = extractCppEnum(typesHpp, 'ConditionType') ?? [];
const cppActions    = extractCppEnum(typesHpp, 'ActionType')    ?? [];

// ─── source file availability note ───────────────────────────────────────────
const sourceAvailable = {
  defaults: !!defaultsJs,
  types:    !!typesHpp,
  evaluator: !!evaluatorCpp,
  parser:    !!parserCpp,
};

const sourceNote = Object.entries(sourceAvailable).map(([k, v]) =>
  `- \`${k}\`: ${v ? '✅ read from source' : '⚠️ not found — using fallback'}`
).join('\n');

// ─── build condition reference table ─────────────────────────────────────────
const CONDITION_DETAIL = {
  Always: {
    desc: 'Always evaluates to true. Use as a no-op condition when you just want the actions to always run.',
    fields: [],
    example: `{ "type": "Always" }`,
  },
  NeighborCheck: {
    desc: 'Checks whether the cell in the given direction is a specific entity type.',
    fields: [
      { name: 'dir',    type: 'Direction',              desc: 'Which neighbour to inspect.' },
      { name: 'target', type: '"EMPTY"|"ANY"|name|id', desc: '**Prefer entity name strings** (e.g. `"Water"`). Also accepts `"EMPTY"`, `"ANY"`, or a numeric ID (legacy). Name lookup is case-insensitive.' },
    ],
    example: `{ "type": "NeighborCheck", "dir": "down", "target": "Water" }`,
  },
  PropertyCheck: {
    desc: 'Checks a built-in numeric property of the entity that owns this cell.',
    fields: [
      { name: 'prop', type: 'string', desc: `One of the built-in properties: ${BUILT_IN_PROPS.join(', ')}.` },
      { name: 'op',   type: 'Op',    desc: `Comparison operator: ${PROPERTY_OPS.join(' ')}.` },
      { name: 'val',  type: 'number',desc: 'Value to compare against.' },
    ],
    example: `{ "type": "PropertyCheck", "prop": "density", "op": ">", "val": 0 }`,
  },
  VariableCheck: {
    desc: 'Checks a named per-cell variable (defined on the entity). Variables are integers 0–65535.',
    fields: [
      { name: 'varName', type: 'string', desc: 'Name of the variable as defined in entity.variables[].name.' },
      { name: 'op',      type: 'Op',    desc: `Comparison operator: ${PROPERTY_OPS.join(' ')}.` },
      { name: 'val',     type: 'number',desc: 'Value to compare against (0–65535).' },
    ],
    example: `{ "type": "VariableCheck", "varName": "lifetime", "op": "<=", "val": 0 }`,
  },
  NeighborCount: {
    desc: 'Counts how many of the 8 surrounding cells match a target type and compares that count to a threshold.',
    fields: [
      { name: 'target', type: '"EMPTY"|"ANY"|name|id', desc: '**Prefer entity name strings** (e.g. `"Algae"`). Also accepts `"EMPTY"`, `"ANY"`, or a numeric ID (legacy).' },
      { name: 'op',     type: 'Op',    desc: `Comparison operator: ${PROPERTY_OPS.join(' ')}.` },
      { name: 'val',    type: 'number',desc: 'Number to compare the count against (0–8).' },
    ],
    example: `{ "type": "NeighborCount", "target": "Algae", "op": ">=", "val": 3 }`,
  },
  Chance: {
    desc: 'Passes randomly with the given probability. Use to make behaviour non-deterministic.',
    fields: [
      { name: 'val', type: 'number (0–100)', desc: 'Probability as a percentage (e.g. 25 = 25% chance).' },
    ],
    example: `{ "type": "Chance", "val": 25 }`,
  },
  AND: {
    desc: 'All child conditions must be true. Nests recursively.',
    fields: [
      { name: 'children', type: 'Condition[]', desc: 'Array of sub-conditions, all of which must pass.' },
    ],
    example: `{ "type": "AND", "children": [\n    { "type": "NeighborCheck", "dir": "down", "target": "EMPTY" },\n    { "type": "Chance", "val": 50 }\n  ]\n}`,
  },
  OR: {
    desc: 'At least one child condition must be true.',
    fields: [
      { name: 'children', type: 'Condition[]', desc: 'Array of sub-conditions, any of which may pass.' },
    ],
    example: `{ "type": "OR", "children": [\n    { "type": "NeighborCheck", "dir": "left", "target": "EMPTY" },\n    { "type": "NeighborCheck", "dir": "right", "target": "EMPTY" }\n  ]\n}`,
  },
  NOT: {
    desc: 'Inverts a single child condition.',
    fields: [
      { name: 'child', type: 'Condition', desc: 'A single sub-condition whose result is inverted.' },
    ],
    example: `{ "type": "NOT", "child": { "type": "NeighborCheck", "dir": "up", "target": "EMPTY" } }`,
  },
};

const ACTION_DETAIL = {
  Move: {
    desc: 'Moves the cell one step in a single direction if the target cell is empty. Fails silently if blocked. Use `"dir": "any"` to try all 8 directions in random order (equivalent to MoveFirst with all 8 dirs).',
    fields: [
      { name: 'dir', type: 'Direction | "any"', desc: 'Direction to move. `"any"` = try all 8 in random order.' },
    ],
    example: `{ "type": "Move", "dir": "down" }`,
  },
  MoveFirst: {
    desc: 'Tries each direction in order and moves to the first empty one. Use for diagonal spread (sand) or sideways flow (water).',
    fields: [
      { name: 'dirs',      type: 'Direction[]', desc: 'Ordered list of directions to try.' },
      { name: 'randomize', type: 'boolean',     desc: 'If true (default), shuffle the direction list each tick to remove sweep bias.' },
    ],
    example: `{ "type": "MoveFirst", "dirs": ["down-left", "down-right"], "randomize": true }`,
  },
  Transform: {
    desc: 'Replaces this cell with a different entity type in-place. Variables are reset to the new entity\'s defaults.',
    fields: [
      { name: 'targetId', type: 'name|id', desc: '**Prefer the entity name string** (e.g. `"Steam"`). Numeric ID also accepted for legacy rules.' },
    ],
    example: `{ "type": "Transform", "targetId": "Steam" }`,
  },
  Spawn: {
    desc: 'Creates a new cell of the given entity type in a neighbouring slot. Does nothing if that slot is occupied. Use `"dir": "any"` to find the first empty neighbour in a random direction — perfect for growing plants or spreading organisms.',
    fields: [
      { name: 'targetId', type: 'name|id', desc: '**Prefer the entity name string** (e.g. `"Plankton"`). Numeric ID also accepted for legacy rules.' },
      { name: 'dir',      type: 'Direction | "any"', desc: 'Which neighbouring slot to spawn into. `"any"` = first empty neighbour (random order).' },
    ],
    example: `{ "type": "Spawn", "targetId": "Plankton", "dir": "any" }`,
  },
  Destroy: {
    desc: 'Removes this cell from the grid (sets it to EMPTY).',
    fields: [],
    example: `{ "type": "Destroy" }`,
  },
  ModifyVariable: {
    desc: 'Mutates a named per-cell variable by the given amount. Clamped to 0–65535.',
    fields: [
      { name: 'varName', type: 'string',  desc: 'Name of the variable to modify (must exist in entity.variables).' },
      { name: 'op',      type: 'ModifyOp',desc: `How to modify it: ${MODIFY_OPS.map(o => `"${o.value}" (${o.label})`).join(', ')}.` },
      { name: 'val',     type: 'number',  desc: 'Amount to add/subtract/multiply/set.' },
    ],
    example: `{ "type": "ModifyVariable", "varName": "lifetime", "op": "-=", "val": 1 }`,
  },
  Eat: {
    desc: 'Moves this cell one step in a given direction **into** a cell occupied by the target entity type, consuming it. Optionally grants the eater a variable bonus and/or spawns a replacement entity at the vacated source cell.',
    fields: [
      { name: 'dir',         type: 'Direction',        desc: 'Direction of the prey.' },
      { name: 'target',      type: '"ANY"|name|id',   desc: '**Prefer entity name string** (e.g. `"Algae"`). Also accepts `"ANY"` or numeric ID.' },
      { name: 'replaceWith', type: '"EMPTY"|name|id', desc: '(optional) Entity to spawn at the source cell after eating. Omit or `"EMPTY"` to leave it empty (default). Use an entity name (e.g. `"Water"`) to fill the trail.' },
      { name: 'gainVar',     type: 'string',            desc: '(optional) Variable name on the eater to increase when eating succeeds.' },
      { name: 'gainVal',     type: 'number',            desc: '(optional) Amount to add to gainVar (default 0).' },
    ],
    example: `{ "type": "Eat", "dir": "up", "target": "Algae", "replaceWith": "Water", "gainVar": "energy", "gainVal": 20 }`,
  },
  EatFirst: {
    desc: 'Tries each direction in order and eats the first cell that matches the target type. Same as MoveFirst but for occupied cells. Supports the same replaceWith trail-fill option as Eat.',
    fields: [
      { name: 'dirs',        type: 'Direction[]',    desc: 'Ordered list of directions to try.' },
      { name: 'randomize',   type: 'boolean',        desc: 'If true (default), shuffle the direction list each tick.' },
      { name: 'target',      type: '"ANY"|name|id', desc: '**Prefer entity name string** (e.g. `"Grass"`). Also accepts `"ANY"` or numeric ID.' },
      { name: 'replaceWith', type: '"EMPTY"|name|id', desc: '(optional) Entity to place at the source cell after eating (e.g. `"Water"` to fill gaps).' },
      { name: 'gainVar',     type: 'string',         desc: '(optional) Variable to increase on successful eat.' },
      { name: 'gainVal',     type: 'number',         desc: '(optional) Amount to gain.' },
    ],
    example: `{ "type": "EatFirst", "dirs": ["up", "left", "right", "down"], "target": "Grass", "replaceWith": "Water", "randomize": true, "gainVar": "energy", "gainVal": 10 }`,
  },
  Swap: {
    desc: 'Swaps this cell\'s position with a neighbour of the given target type. Both cells and all their variables are exchanged. Used for buoyancy and swimming.',
    fields: [
      { name: 'dir',    type: 'Direction',        desc: 'Direction of the cell to swap with.' },
      { name: 'target', type: '"ANY"|name|id',   desc: '**Prefer entity name string** (e.g. `"Water"`). Also accepts `"ANY"` or numeric ID.' },
    ],
    example: `{ "type": "Swap", "dir": "up", "target": "Water" }`,
  },
  SwapFirst: {
    desc: 'Tries each direction in order and swaps with the first cell that matches the target type.',
    fields: [
      { name: 'dirs',      type: 'Direction[]',    desc: 'Ordered list of directions to try.' },
      { name: 'randomize', type: 'boolean',        desc: 'If true (default), shuffle the direction list each tick.' },
      { name: 'target',    type: '"ANY"|name|id', desc: '**Prefer entity name string** (e.g. `"Water"`). Also accepts `"ANY"` or numeric ID.' },
    ],
    example: `{ "type": "SwapFirst", "dirs": ["left", "right"], "target": "Water", "randomize": true }`,
  },
  MoveToward: {
    desc: 'Scans up to `range` cells along all 8 rays from the current cell. If a cell matching `target` is found, moves one step toward the nearest one. Does nothing if no match is found within range.',
    fields: [
      { name: 'target', type: '"EMPTY"|"ANY"|name|id', desc: '**Prefer entity name string** (e.g. `"Water"`). Also accepts `"EMPTY"`, `"ANY"`, or numeric ID.' },
      { name: 'range',  type: 'number (1–32)',           desc: 'How many cells to scan along each ray. Default 5.' },
    ],
    example: `{ "type": "MoveToward", "target": "Algae", "range": 6 }`,
  },
  MoveAway: {
    desc: 'Same scanning logic as MoveToward but moves one step **away** from the nearest match instead of toward it. Useful for prey fleeing predators.',
    fields: [
      { name: 'target', type: '"EMPTY"|"ANY"|name|id', desc: '**Prefer entity name string** (e.g. `"Predator"`). Also accepts `"EMPTY"`, `"ANY"`, or numeric ID.' },
      { name: 'range',  type: 'number (1–32)',           desc: 'How many cells to scan along each ray. Default 5.' },
    ],
    example: `{ "type": "MoveAway", "target": "Predator", "range": 8 }`,
  },
};

// ─── unknown-type handling note ───────────────────────────────────────────────
const UNKNOWN_NOTE = `
> **Unknown types are silently ignored.**
> If the engine receives a condition type or action type it does not recognise
> it skips that condition (evaluates to \`false\`) or that action (no-op).
> This means bundles created for a newer engine version are safe to import into
> an older one — unknown behaviours simply don't fire.
`.trim();

// ─── build the markdown ───────────────────────────────────────────────────────
function codeBlock(lang, str) {
  return `\`\`\`${lang}\n${str}\n\`\`\``;
}

function fieldsTable(fields) {
  if (!fields.length) return '_No additional fields required._';
  const rows = fields.map(f =>
    `| \`${f.name}\` | \`${f.type}\` | ${f.desc} |`
  );
  return [
    '| Field | Type | Description |',
    '|-------|------|-------------|',
    ...rows,
  ].join('\n');
}

function conditionSection(name) {
  const d = CONDITION_DETAIL[name];
  const cppEntry = cppConditions.find(c =>
    c.name.toLowerCase().includes(name.toLowerCase().replace(/check|count/,''))
  );
  const cppNote = cppEntry ? ` *(C++ enum: \`${cppEntry.name}\`)*` : '';
  if (!d) {
    return `### \`${name}\`${cppNote}\n\n_No detailed documentation yet. Fields: unknown._\n`;
  }
  return [
    `### \`${name}\`${cppNote}`,
    '',
    d.desc,
    '',
    fieldsTable(d.fields),
    '',
    '**Example:**',
    codeBlock('json', d.example),
  ].join('\n');
}

function actionSection(name) {
  const d = ACTION_DETAIL[name];
  const cppEntry = cppActions.find(a =>
    a.name.toLowerCase().includes(name.toLowerCase().replace('variable','').replace('first','').replace('modify',''))
  );
  const cppNote = cppEntry ? ` *(C++ enum: \`${cppEntry.name}\`)*` : '';
  if (!d) {
    return `### \`${name}\`${cppNote}\n\n_No detailed documentation yet. Fields: unknown._\n`;
  }
  return [
    `### \`${name}\`${cppNote}`,
    '',
    d.desc,
    '',
    fieldsTable(d.fields),
    '',
    '**Example:**',
    codeBlock('json', d.example),
  ].join('\n');
}

// ─── entity example ───────────────────────────────────────────────────────────
const ORGANISM_EXAMPLE = {
  entities: [
    {
      id: 10,
      name: 'Lava',
      color: [255, 80, 10, 255],
      density: 2.5,
      isStatic: false,
      variables: [
        { name: 'heat', defaultVal: 200 },
      ],
    },
    {
      id: 11,
      name: 'Spark',
      color: [255, 220, 50, 200],
      density: 0,
      isStatic: false,
      variables: [
        { name: 'lifetime', defaultVal: 30 },
      ],
    },
  ],
  globalRules: [],
  entityRules: {
    '10': [
      {
        id: 'lava_cool',
        trigger: 'OnRandomTick',
        condition: { type: 'Always' },
        actions: [
          { type: 'ModifyVariable', varName: 'heat', op: '-=', val: 1 },
        ],
      },
      {
        id: 'lava_spawn_spark',
        trigger: 'OnTick',
        condition: {
          type: 'AND',
          children: [
            { type: 'VariableCheck', varName: 'heat', op: '>', val: 100 },
            { type: 'Chance', val: 5 },
            { type: 'NeighborCheck', dir: 'up', target: 'EMPTY' },
          ],
        },
        actions: [
          { type: 'Spawn', targetId: 'Spark', dir: 'up' },
        ],
      },
    ],
    '11': [
      {
        id: 'spark_die',
        trigger: 'OnTick',
        condition: { type: 'VariableCheck', varName: 'lifetime', op: '<=', val: 0 },
        actions: [
          { type: 'Destroy' },
        ],
      },
      {
        id: 'spark_age',
        trigger: 'OnTick',
        condition: { type: 'Always' },
        actions: [
          { type: 'ModifyVariable', varName: 'lifetime', op: '-=', val: 1 },
          { type: 'Move', dir: 'up' },
        ],
      },
    ],
  },
};

// ─── assemble doc ─────────────────────────────────────────────────────────────
const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

const doc = `# PixelPlanet — Entity & Rule Schema Reference

> **Auto-generated** by \`scripts/generate-entity-schema.js\` on ${timestamp}.
> Re-run to pick up new condition types, actions, or triggers added to the codebase.

## Source file status

${sourceNote}

---

## Purpose

This document describes the exact JSON format expected by \`engine_load_config()\`.
You can paste it into a conversation with an AI assistant and ask it to generate
entity packs — collections of entity definitions and rules — in this format.

The engine is **data-driven**: everything a pixel does is described here.
There is no hardcoded physics. Adding a "Fire" entity that burns and spreads
is entirely doable by composing the primitives below.

${UNKNOWN_NOTE}

---

## Top-level structure

${codeBlock('json', JSON.stringify({
  entities: '[ <EntityDef>, ... ]',
  globalRules: '[ <Rule>, ... ]  // apply to ALL non-static pixels',
  entityRules: {
    '<entityId as string>': '[ <Rule>, ... ]  // apply only to pixels with that ID',
  },
}, null, 2))}

---

## Entity definition

${codeBlock('json', JSON.stringify({
  id: 'number (1–254, unique)',
  name: 'string',
  color: '[R, G, B, A]  // 0–255 each',
  density: 'number  // >0 = participates in gravity; 0 = floats/is static',
  isStatic: 'boolean  // true = never evaluated, immovable (e.g. Stone)',
  lifespan: 'number (0–65535)  // 0 = immortal; >0 = cell auto-dies after this many ticks',
  variables: [
    {
      name: 'string  // identifier used in VariableCheck / ModifyVariable',
      defaultVal: 'number (0–65535)  // value assigned when cell is painted or spawned',
    },
  ],
}, null, 2))}

**Notes:**
- Maximum **4 user variables** per entity.
- Entity IDs are integers 1–254. ID 0 is reserved for EMPTY.
- \`isStatic: true\` entities are never touched by the rule evaluator at all —
  rules assigned to them are still stored but never run.
- \`density\` only matters if a global gravity rule checks \`PropertyCheck density > 0\`.
  New entities automatically fall if you keep the default global gravity rule.

---

## Rule structure

${codeBlock('json', JSON.stringify({
  id: 'string  // unique identifier (no spaces recommended)',
  trigger: '<Trigger>',
  condition: '<Condition>  // single root condition (can nest AND/OR/NOT)',
  actions: '[ <Action>, ... ]  // run in order; movement stops further actions',
}, null, 2))}

### Evaluation order per cell per tick
1. Global rules are tried first (in array order). First rule that fires wins.
2. If no global rule fired, entity-specific rules are tried (in array order).
3. Within a rule: all actions run in order **unless** a movement action (Move, MoveFirst, MoveToward, MoveAway, Eat, EatFirst, Swap, SwapFirst)
   succeeds — then execution stops (the cell is no longer at its original position).

---

## Triggers

Available values for the \`trigger\` field:

| Trigger | Description |
|---------|-------------|
${TRIGGERS.map(t => {
  const desc = {
    OnTick: 'Fires every simulation tick (~60 times/second). Use for continuous physics.',
    OnRandomTick: 'Fires on a random interval. Use for slow, stochastic changes (decay, spreading fire). Add `"interval": <ticks>` to set average cadence.',
  }[t] ?? '_No description yet._';
  return `| \`${t}\` | ${desc} |`;
}).join('\n')}

---

## Conditions

Root condition for a rule. Can be any of the types below.
Nest \`AND\`, \`OR\`, and \`NOT\` arbitrarily to build complex logic.

${CONDITION_TYPES.map(conditionSection).join('\n\n---\n\n')}

---

## Actions

${ACTION_TYPES.map(actionSection).join('\n\n---\n\n')}

---

## Directions

Valid string values for any \`dir\` or \`dirs\` field:

| Value | Meaning |
|-------|---------|
${DIRECTIONS.map(d => `| \`"${d}"\` | ${d.replace('-', ' → ')} |`).join('\n')}

---

## Comparison operators

Used in \`PropertyCheck\`, \`VariableCheck\`, and \`NeighborCount\`:

${PROPERTY_OPS.map(op => `- \`"${op}"\``).join('  \n')}

---

## Variable modify operators

Used in the \`ModifyVariable\` action:

| Value | Meaning |
|-------|---------|
${MODIFY_OPS.map(o => `| \`"${o.value}"\` | ${o.label} |`).join('\n')}

---

## C++ enum cross-reference

These are the internal engine names. Useful if you're reading \`evaluator.cpp\`
or \`parser.cpp\` alongside this document.

### ConditionType
${cppConditions.length
  ? cppConditions.map(c => `- \`${c.name}\`${c.comment ? ` — ${c.comment}` : ''}`).join('\n')
  : '_Source file not available. Run from repo root to see live values._'}

### ActionType
${cppActions.length
  ? cppActions.map(a => `- \`${a.name}\`${a.comment ? ` — ${a.comment}` : ''}`).join('\n')
  : '_Source file not available. Run from repo root to see live values._'}

---

## Full example — Lava + Spark entity pack

This is a ready-to-import bundle. It defines:
- **Lava**: a dense liquid that cools over time and randomly spawns Sparks upward.
- **Spark**: a lightweight particle that rises and dies when its lifetime reaches 0.

${codeBlock('json', JSON.stringify(ORGANISM_EXAMPLE, null, 2))}

Paste this into the **Settings → Import** textarea in the PixelPlanet sidebar and
click **Merge (add)** to add Lava and Spark to your sandbox.

---

## Tips for AI-generated entity packs

> ⚠️ **Always use entity name strings for \`target\` and \`targetId\` fields.**
> Write \`"target": "Water"\` not \`"target": 2\`. The engine resolves names to IDs at
> runtime, so name-based rules stay correct even if IDs change or entities are
> reordered. Numeric IDs are still accepted for backward compatibility but are
> **error-prone** and strongly discouraged in new bundles.

1. **Give each entity a unique ID** that doesn't conflict with existing ones (IDs 1–3
   are Sand/Water/Stone by default). Start at ID 10+ for custom entities.

2. **Declare variables before using them.** A \`VariableCheck\` or \`ModifyVariable\`
   on a variable not in \`entity.variables[]\` silently does nothing.

3. **Rule ordering matters for death conditions.**
   The engine evaluates entity rules in list order. After a rule with a movement
   action succeeds, no further rules fire for that cell this tick.
   **Always place kill/death rules BEFORE movement rules.** For example:
   - Rule 1: \`VariableCheck lifetime <= 0\` → Destroy  *(checked first)*
   - Rule 2: \`Always\` → [ModifyVariable lifetime -= 1, Move]  *(fires only if still alive)*

   If you put the movement rule first, the death check is never reached while
   the cell is in motion, and the cell only dies when it can no longer move.

4. **Use \`Chance\` to add randomness.** Wrapping an action block in a \`Chance: 5\`
   condition makes it fire ~5% of ticks — good for decay, mutation, and rare events.

5. **\`OnRandomTick\` for slow processes.** Lifetime decay, fire spreading, and disease
   propagation look more natural with \`OnRandomTick\` than \`OnTick\`.

6. **Organism movement pattern.** To make a pixel "seek" food:
   - Store energy in a variable (\`energy\`, default 100).
   - Rule 1 (death): \`VariableCheck energy <= 0\` → Destroy
   - Rule 2 (seek + age): \`Always\` → [ModifyVariable energy -= 1, Move toward food]

7. **Eating for survival.** Combine \`Eat\` with energy gain and starvation death:
   - Give the predator an \`energy\` variable (default e.g. 200).
   - Rule 1: \`VariableCheck energy <= 0\` → Destroy  *(starve)*
   - Rule 2: \`NeighborCheck dir:up target:<prey>\` → EatFirst + gainVar:energy gainVal:50
   - Rule 3: \`Always\` → ModifyVariable energy -= 1  *(passive drain)*

8. **Swimming / buoyancy through liquid.** Use \`Swap\` or \`SwapFirst\` with the liquid entity ID:
   - A fish swimming sideways: \`SwapFirst dirs:[left,right] target:<water ID>\`
   - A bubble floating up: \`Swap dir:up target:<water ID>\`
   - Combine with a \`NeighborCheck\` condition to only swim when submerged.

9. **Photosynthesis.** Give a plant an \`energy\` variable. On \`OnRandomTick\`:
   - Condition: \`NeighborCheck dir:up target:<sunlight ID>\` (or \`Chance\` if no explicit sun)
   - Action: \`ModifyVariable energy += 5\`
   - Separate rule: \`VariableCheck energy >= 100\` + \`Chance 10\` → Spawn self in a neighbour slot

10. **Water cycle.** Model evaporation/condensation with Transform + Spawn:
    - Water on \`OnRandomTick\` + \`Chance 1\` + \`NeighborCheck up EMPTY\` → Transform to Steam
    - Steam moves up (\`Move up\`); when it reaches the top it has no EMPTY above → \`NeighborCount EMPTY < 1\` → Transform to Cloud
    - Cloud on \`OnRandomTick\` + \`Chance 5\` + \`NeighborCheck down EMPTY\` → Spawn Water below

11. **Flocking / grouping.** Use \`NeighborCount target:<self ID> op:< val:2\` to make a
    pixel move toward others of its kind (moves only when isolated, stops when grouped).

12. **The bundle format is portable.** Any bundle generated for this schema version can
    be imported into any PixelPlanet instance running the same engine phase.

---

_This document was generated from the live source files. Re-run
\`node scripts/generate-entity-schema.js\` after adding new condition types,
action types, or triggers to keep it current._
`;

writeFileSync(OUTPUT, doc, 'utf8');
console.log(`Schema written to: ${OUTPUT}`);
