import MazeGrid from '../core/MazeGrid.js';

// Abstract base class for all maze generators.
//
// Subclasses must implement:
//   init()           — reset and seed the first cell
//   step(pickIndex)  — advance one cell, using pickIndex to select from candidates
//
// The base class provides:
//   isDone()         — completion guard
//   complete()       — drain all remaining steps at once
//   cellsPerSecond   — live throughput counter
//
// Shared rendering properties exposed to the renderer:
//   frontier         — the "active" cell list; interpretation depends on subclass
//   lastAddedCell    — the most recently visited cell (yellow dot in renderer)
export default class MazeGenerator {
  constructor(grid) {
    if (!(grid instanceof MazeGrid)) {
      throw new TypeError("MazeGenerator requires a MazeGrid.");
    }
    this.grid               = grid;
    this.frontier           = [];
    this.lastAddedCell      = null;
    this.done               = false;
    this.currentRegionIndex = 0;
    this._stepCount         = 0;
    this._startTime         = null;
  }

  // Reset and seed the first cell. Must be called before step().
  init() {
    throw new Error(`${this.constructor.name}.init() is not implemented.`);
  }

  // Advance one generation step.
  // pickIndex(candidates) → integer: selects which candidate to use.
  step() {
    throw new Error(`${this.constructor.name}.step() is not implemented.`);
  }

  isDone() {
    return this.done;
  }

  // Runs all remaining steps in one call (instant mode).
  // pickIndex signature: (candidateArray) → integer index
  complete(pickIndex = (arr) => Math.floor(Math.random() * arr.length)) {
    while (!this.done) this.step(pickIndex);
  }

  // Cells added per second since init() was called.
  get cellsPerSecond() {
    if (!this._startTime || this._stepCount === 0) return 0;
    const elapsed = (Date.now() - this._startTime) / 1000;
    return elapsed > 0.01 ? Math.round(this._stepCount / elapsed) : 0;
  }
}
