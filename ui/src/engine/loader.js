/**
 * engine/loader.js
 *
 * Thin wrapper around the Emscripten-generated PixelPlanetEngine module.
 *
 * The Emscripten glue script is loaded as a regular <script> tag in
 * index.html and sets window.PixelPlanetEngine to a factory function.
 * Calling that factory returns a Promise<Module> where Module exposes
 * the C exports via Module._engine_* and Module.HEAPU8.
 *
 * All functions here are pure - they receive `mod` explicitly so that
 * React components never hold a global reference to the module object.
 */

let _initPromise = null;

/**
 * Load and initialise the Emscripten module.
 * Idempotent - multiple calls return the same Promise.
 * @returns {Promise<object>} Emscripten module
 */
export function loadEngine() {
  if (_initPromise) return _initPromise;

  _initPromise = new Promise((resolve, reject) => {
    if (typeof window.PixelPlanetEngine !== 'function') {
      reject(new Error(
        'WASM engine not compiled.\n\n' +
        'Run:  .\\scripts\\build-engine.ps1\n' +
        'Then refresh this page.'
      ));
      return;
    }

    window.PixelPlanetEngine().then(resolve).catch(reject);
  });

  return _initPromise;
}

/**
 * Allocate the grid inside WASM memory.
 * @param {object} mod   - Emscripten module
 * @param {number} w     - grid width  (pixels)
 * @param {number} h     - grid height (pixels)
 */
export function engineInit(mod, w, h) {
  mod._engine_init(w, h);
}

/**
 * Returns a live Uint8Array view into WASM memory.
 * The view is valid until the next call to engineUpdate() that grows memory
 * (unlikely in Phase 1 with ALLOW_MEMORY_GROWTH - but callers should not
 * cache this across ticks).
 * @param {object} mod
 * @param {number} w
 * @param {number} h
 * @returns {Uint8Array}
 */
export function engineGetCells(mod, w, h) {
  const ptr = mod._engine_get_cells();
  return new Uint8Array(mod.HEAPU8.buffer, ptr, w * h);
}

/**
 * Paint a single cell.
 * @param {object} mod
 * @param {number} x
 * @param {number} y
 * @param {number} type  - 0 EMPTY | 1 SAND | 2 WATER | 3 STONE
 */
export function engineSetPixel(mod, x, y, type) {
  mod._engine_set_pixel(x, y, type);
}

/**
 * Load (or reload) the entity registry and rule set into the engine.
 *
 * The full config object is serialised to JSON and passed as a UTF-8 string
 * via Emscripten ccall, which handles allocation/deallocation automatically.
 *
 * @param {object} mod     - Emscripten module
 * @param {object} config  - { entities, globalRules, entityRules }
 * @returns {boolean}      - true if the engine accepted the config
 */
export function engineLoadConfig(mod, config) {
  const json = JSON.stringify(config);
  return mod.ccall('engine_load_config', 'number', ['string'], [json]) === 1;
}

/**
 * Reset the deterministic RNG seed.
 * @param {object} mod
 * @param {number} seed  - unsigned 32-bit integer; 0 resets to default
 */
export function engineSetSeed(mod, seed) {
  mod._engine_set_seed(seed >>> 0);
}

/**
 * Advance the simulation one tick.
 * @param {object} mod
 */
export function engineUpdate(mod) {
  mod._engine_update();
}
