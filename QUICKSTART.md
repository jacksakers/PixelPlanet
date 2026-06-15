# PixelPlanet - Quick Start Guide

Get from zero to a running falling-sand simulation in your browser.

---

## Step 1 - Install prerequisites

### 1a. Node.js (≥ 18)

Download and install from https://nodejs.org/  
Verify:
```powershell
node -v   # should print v18.x or higher
npm -v
```

### 1b. Emscripten SDK

Emscripten provides `emcc`, the C++ → WebAssembly compiler.

```powershell
# Clone the SDK somewhere permanent (e.g. C:\Users\USER\Documents\side\emsdk)
git clone https://github.com/emscripten-core/emsdk.git C:\Users\USER\Documents\side\emsdk
cd C:\Users\USER\Documents\side\emsdk

# Install and activate the latest stable version
.\emsdk.bat install latest
.\emsdk.bat activate latest
```

**Every new terminal session** you need to activate the environment:
```powershell
& "C:\Users\USER\Documents\side\emsdk\emsdk_env.ps1"
```

Verify:
```powershell
emcc -v   # should print Emscripten 3.x.x
```

> **Tip:** Add `& "C:\Users\USER\Documents\side\emsdk\emsdk_env.ps1"` to your PowerShell profile
> (`$PROFILE`) so it runs automatically.

---

## Step 2 - Clone / open the project

```powershell
cd C:\path\to\PixelPlanet
```

---

## Step 3 - Run everything with one command

```powershell
.\scripts\dev.ps1
```

OR on linux Run this:

chmod +x engine/build.sh
source source "/home/jack/src/emsdk/emsdk_env.sh" # Activate Emscripten
./engine/build.sh

This script:
1. Compiles `engine/src/main.cpp` → `ui/public/wasm/pixel_planet.{js,wasm}`
2. Runs `npm install` in `ui/` (first time only)
3. Starts the Vite dev server at **http://localhost:5173**

Open http://localhost:5173 in your browser. You should see the sandbox with a dark canvas.

---

## Step 4 - Draw pixels

| Action | Result |
|--------|--------|
| Click / drag | Paint with selected pixel type |
| Key `1` | Select **Sand** (yellow, piles up) |
| Key `2` | Select **Water** (blue, flows sideways) |
| Key `3` | Select **Stone** (grey, immovable) |
| Key `4` | Select **Erase** (remove pixels) |

---

## Day-to-day workflow

### UI changes only (no engine changes)

```powershell
.\scripts\dev.ps1 -SkipBuild
```

Vite hot-reloads React changes instantly.

### Engine changes

After editing anything in `engine/src/`:

```powershell
# In a second terminal (keep Vite running in the first)
.\scripts\rebuild-and-reload.ps1
```

Vite detects the updated `public/wasm/` files and triggers a full browser reload.

### Build engine only

```powershell
.\scripts\build-engine.ps1
```

---

## Troubleshooting

### "WASM engine not compiled" overlay in the browser

The `ui/public/wasm/pixel_planet.js` file is missing. Run:
```powershell
& "C:\Users\USER\Documents\side\emsdk\emsdk_env.ps1"   # activate Emscripten first
.\scripts\build-engine.ps1
```

### `emcc` not found

Emscripten is not activated. Run `& "C:\Users\USER\Documents\side\emsdk\emsdk_env.ps1"` in your terminal first.

### `npm run dev` fails with `ENOENT`

Dependencies not installed. Run:
```powershell
cd ui
npm install
```

### Canvas is black but no overlay

The engine initialised successfully but the grid is empty — just start drawing!

### Simulation runs slowly

The 500×500 grid at 60 FPS is light work for modern hardware. If you see drops,
check that you are not running with browser DevTools open (they add overhead).
Chunking and multithreading arrive in **Phase 4**.

---

## What's inside Phase 1

| Component | Location | Description |
|-----------|----------|-------------|
| C++ engine | `engine/src/main.cpp` | Flat 1-D grid, double-buffering, Xorshift-32 RNG |
| WASM loader | `ui/src/engine/loader.js` | Wraps Emscripten module, exposes typed JS API |
| Canvas renderer | `ui/src/components/SimCanvas.jsx` | ImageData pixel-push at 60 FPS |
| Toolbar | `ui/src/components/Toolbar.jsx` | Pixel type selector with keyboard shortcuts |
| Build script | `engine/build.ps1` | `emcc` invocation with correct Emscripten flags |

The engine exports four functions:

```
engine_init(w, h)            allocate grid
engine_get_cells()           pointer → Uint8Array view in WASM memory
engine_set_pixel(x, y, type) paint one cell
engine_update()              advance simulation one tick
```

The JS side reads the cell buffer directly from WASM linear memory (zero-copy
`Uint8Array` view) and maps types to RGBA colours in a tight loop before
calling `ctx.putImageData()`.
