# PixelPlanet

A highly scalable, programmable **cellular automata sandbox** built on a C++/WebAssembly physics engine and a React/Vite frontend.

Users define custom pixel entities with unique properties and behaviour rules through a visual, node-based scripting interface. Complex emergent ecosystems — weather cycles, simple organisms, geological formations — arise from simple user-defined local and global rules.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                     Browser                          │
│                                                      │
│  ┌─────────────────────┐   ┌──────────────────────┐  │
│  │  Frontend (React)   │   │  Engine (WASM)        │  │
│  │  - Canvas/WebGL     │◄──►  - Grid / Chunks      │  │
│  │  - Visual editor    │   │  - Rule evaluator     │  │
│  │  - UI state         │   │  - Deterministic RNG  │  │
│  └─────────────────────┘   └──────────────────────┘  │
└──────────────────────────────────────────────────────┘
         ▲                           ▲
    HTML/CSS/JS                  C++ → emcc → .wasm
```

**Engine** (`engine/`) — C++17 compiled to WebAssembly via Emscripten. Owns the grid, memory management, rule evaluation, and multithreading (Phase 4+).

**UI** (`ui/`) — Vite + React. Owns Canvas rendering, the visual node editor (Phase 5), and UI state. Communicates with the engine through a thin JS wrapper.

**Shared** (`shared/`) — JSON schemas for the Rule AST passed between the two layers.

---

## Tech Stack

| Layer   | Technology |
|---------|------------|
| Engine  | C++17, Emscripten, WebAssembly |
| UI      | React 18, Vite 5 |
| Render  | HTML5 Canvas → WebGL (Phase 4+) |

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) | ≥ 3.1 | Provides `emcc` |
| [Node.js](https://nodejs.org/) | ≥ 18 | Needed for Vite / npm |

---

## Project Structure

```
pixel-planet/
├── engine/
│   ├── src/
│   │   └── main.cpp        ← C++ engine (Phase 1: falling sand)
│   ├── build.ps1           ← Engine build script (Windows/Emscripten)
│   └── CMakeLists.txt      ← Alternative CMake build
│
├── ui/
│   ├── public/
│   │   └── wasm/           ← Compiled pixel_planet.{js,wasm} (gitignored)
│   ├── src/
│   │   ├── engine/
│   │   │   └── loader.js   ← WASM module loader
│   │   ├── components/
│   │   │   ├── SimCanvas.jsx
│   │   │   └── Toolbar.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── docs/
│   ├── design.txt          ← Technical design document
│   └── implementation.txt  ← Phased implementation plan
│
├── scripts/
│   ├── dev.ps1             ← Build engine + start UI (one command)
│   ├── build-engine.ps1    ← Engine-only build
│   └── rebuild-and-reload.ps1  ← Fast rebuild during engine iteration
│
├── README.md
└── QUICKSTART.md
```

---

## Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| **1** | High-performance WASM foundation + falling sand demo | ✅ **Done** |
| **2** | Data-driven engine — JSON rule AST parser | ✅ **Done** |
| **3** | Variables, lifetimes, boolean logic, Eat/Swap/MoveToward/MoveAway actions, Pack Manager, rule labels, JSON editors, rule reordering | ✅ **Done** |
| **3.5** | OnClick & OnButtonPress triggers, score/game-loop actions, navigate tool mode, mobile D-pad controller, score overlay | ✅ **Done** |
| 4 | Chunking, multithreading, double buffering | 🔲 Planned |
| 5 | Visual scripting UI (Scratch-like node editor) | 🔲 Planned |
| 6 | Ecosystem sharing, serialisation, blueprints | 🔲 Planned |

---

## Quick Reference

```powershell
# First time setup & run
.\scripts\dev.ps1

# Skip engine rebuild (engine unchanged)
.\scripts\dev.ps1 -SkipBuild

# Recompile engine only (Vite stays running, auto-reloads)
.\scripts\rebuild-and-reload.ps1

# Build engine only (no UI)
.\scripts\build-engine.ps1
```

See [QUICKSTART.md](QUICKSTART.md) for full step-by-step setup.

---

## Core Design Principles

- **Data-Oriented Design** — flat arrays (SoA) in the C++ engine for CPU cache efficiency.
- **Agnostic Engine** — the backend knows only cell IDs and rules; "Sand", "Water" are UI concepts.
- **Deterministic RNG** — seeded Xorshift-32 ensures saves replay identically on any machine.
- **Double Buffering** — simulation reads from buffer A and writes to buffer B each tick; swap is O(1).

---

## Trigger reference

| Trigger | When it fires |
|---------|--------------|
| `OnTick` | Every simulation tick (default). |
| `OnRandomTick` | Randomly, approximately once every N ticks (configurable interval). |
| `OnClick` | When the user clicks/taps the cell while in **Navigate** tool mode. |
| `OnButtonPress` | Every tick while the specified direction key (up/down/left/right) is held. |

---

## Action reference (summary)

| Action | Description |
|--------|-------------|
| `Move` | Move one step in a fixed direction if the target cell is empty. |
| `MoveFirst` | Try a list of directions; move to the first empty one. |
| `MoveToward` | Scan up to `range` cells in all 8 directions; move one step toward the nearest matching entity. |
| `MoveAway` | Same scan; move one step **away** from the nearest match. |
| `Transform` | Replace self with a different entity type. |
| `Spawn` | Create a new cell of a given type in a neighbouring slot. |
| `Destroy` | Remove self (set to EMPTY). |
| `ModifyVariable` | Add / subtract / multiply / set a per-cell variable. |
| `AddScore` | Add a value to the global score counter (only while game is active). |
| `SetScore` | Set the global score counter to a fixed value (only while game is active). |
| `StartGame` | Reset score to 0 and start the game loop (activates AddScore/SetScore). |
| `EndGame` | End the current game session and display the final score overlay. |
| `Eat` / `EatFirst` | Move into a neighbouring cell of a given type, consuming it. |
| `Swap` / `SwapFirst` | Swap positions with a neighbouring cell of a given type. |

---

## Pack Manager

The **⚙ Settings** tab contains the Pack Manager. Packs are named snapshots of your
entire simulation config (all entities + all rules). They are stored locally in
`localStorage` under the key `pixelplanet_packs_v1`.

| Action | How |
|--------|-----|
| Save | Type a name and press **Save** (or Enter). |
| Load | Click **Load** on any row — replaces the current config instantly. |
| Delete | Click **✕** then confirm. |
