/**
 * generatorWorker.js
 *
 * Runs maze generation to completion on a background thread so the main
 * thread (and therefore the UI) is never blocked, even for large grids or
 * slow algorithms like Aldous-Broder on a 100×100 grid.
 *
 * Protocol
 * ────────
 * Main → Worker  postMessage({ cols, rows, maskFlat, generatorType, seed })
 *   maskFlat : Uint8Array (transferred, zero-copy) — flat row-major mask,
 *              1 = cell included, 0 = cell excluded
 *
 * Worker → Main  postMessage({ buf, cps }, [buf.buffer])
 *   buf : Int16Array (transferred, zero-copy) — packed cell state,
 *         5 Int16 values per cell: [col, row, stateCode, wallBits, regionIndex]
 *         stateCode : 0=OUT  1=IN  2=EXCLUDED
 *         wallBits  : bit3=north  bit2=south  bit1=east  bit0=west (1=wall present)
 *   cps : number — cells added per second (for display in the status bar)
 */

import MazeGrid             from '../core/MazeGrid.js';
import { mulberry32 }       from '../core/prng.js';
import PrimsGenerator       from '../generators/PrimsGenerator.js';
import DFSGenerator         from '../generators/DFSGenerator.js';
import AldousBroderGenerator from '../generators/AldousBroderGenerator.js';
import WilsonsGenerator     from '../generators/WilsonsGenerator.js';
import KruskalGenerator     from '../generators/KruskalGenerator.js';
import BinaryTreeGenerator  from '../generators/BinaryTreeGenerator.js';
import SidewinderGenerator  from '../generators/SidewinderGenerator.js';

const GENERATOR_MAP = {
  prims:      (grid) => new PrimsGenerator(grid),
  dfs:        (grid) => new DFSGenerator(grid),
  aldous:     (grid) => new AldousBroderGenerator(grid),
  wilsons:    (grid) => new WilsonsGenerator(grid),
  kruskal:    (grid) => new KruskalGenerator(grid),
  binarytree: (grid) => new BinaryTreeGenerator(grid),
  sidewinder: (grid) => new SidewinderGenerator(grid),
};

// stateCode lookup — mirrors CELL_STATES in constants.js
const STATE_CODE = { out: 0, in: 1, excluded: 2 };

self.onmessage = function({ data }) {
  const { cols, rows, maskFlat, generatorType, seed } = data;

  // Reconstruct 2D boolean mask from the flat Uint8Array
  const mask = [];
  for (let row = 0; row < rows; row++) {
    mask[row] = [];
    for (let col = 0; col < cols; col++) {
      mask[row][col] = maskFlat[row * cols + col] === 1;
    }
  }

  // Build grid and apply mask
  const grid = new MazeGrid(cols, rows);
  grid.applyMask(mask);

  // Create generator and inject the seeded PRNG
  const factory = GENERATOR_MAP[generatorType] ?? GENERATOR_MAP.prims;
  const gen     = factory(grid);
  const rng     = mulberry32(seed);
  gen.rng       = rng;

  // Run maze to completion using the seeded picker
  const pickIndex = (arr) => Math.floor(rng() * arr.length);
  gen.init();
  gen.complete(pickIndex);

  // Pack all cell states into a transferable Int16Array.
  // 5 values per cell: [col, row, stateCode, wallBits, regionIndex]
  const buf = new Int16Array(cols * rows * 5);
  let   idx = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell     = grid.getCell(col, row);
      const wallBits = (cell.walls.north ? 8 : 0)
                     | (cell.walls.south ? 4 : 0)
                     | (cell.walls.east  ? 2 : 0)
                     | (cell.walls.west  ? 1 : 0);

      buf[idx++] = col;
      buf[idx++] = row;
      buf[idx++] = STATE_CODE[cell.state] ?? 0;
      buf[idx++] = wallBits;
      buf[idx++] = cell.regionIndex;
    }
  }

  // Transfer buf.buffer (zero-copy) back to the main thread
  self.postMessage({ buf, cps: gen.cellsPerSecond }, [buf.buffer]);
};
