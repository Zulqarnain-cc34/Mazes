import MazeGrid from '../core/MazeGrid.js';

// Abstract base class for all maze solvers.
//
// Subclasses must implement:
//   init(startCell, endCell)  — reset and prepare
//   step()                    — advance one search step
//
// Public state for rendering:
//   visitedSet   — Set<Cell> of all explored cells
//   path         — Cell[] solution route (empty until found)
//   pathIndexMap — Map<Cell, index> for O(1) path membership checks
//   found        — true when the path exists
//   done         — true when search is finished (found or exhausted)
//   lastVisited  — most recently dequeued cell (for "frontier dot")
export default class MazeSolver {
  constructor(grid) {
    if (!(grid instanceof MazeGrid)) {
      throw new TypeError("MazeSolver requires a MazeGrid.");
    }
    this.grid         = grid;
    this.startCell    = null;
    this.endCell      = null;
    this.done         = false;
    this.found        = false;
    this.path         = [];
    this.pathIndexMap = new Map();
    this.visitedSet   = new Set();
    this.lastVisited  = null;
  }

  init()     { throw new Error(`${this.constructor.name}.init() is not implemented.`); }
  step()     { throw new Error(`${this.constructor.name}.step() is not implemented.`); }
  isDone()   { return this.done; }
  complete() { while (!this.done) this.step(); }
}
