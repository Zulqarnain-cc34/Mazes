import Cell from '../core/Cell.js';
import MazeSolver from './MazeSolver.js';

// Not a pathfinder but a visual elimination technique.
// Repeatedly floods dead ends (cells with only one open passage)
// until only the true solution corridor remains.
//
// Unlike BFS/A*, this solver works backwards — it removes what is
// NOT the solution rather than searching for what IS.
// The result is visually satisfying: dead-end branches progressively
// "fill up" until the solution corridor is the last thing standing.
export default class DeadEndFillSolver extends MazeSolver {
  constructor(grid) {
    super(grid);
    this.showVisitedAlways = true; // filled cells stay visible after solution is found
    this._filledSet        = new Set();
    this._queue            = [];
  }

  init(startCell, endCell) {
    if (!(startCell instanceof Cell) || !(endCell instanceof Cell)) {
      throw new TypeError("DeadEndFillSolver.init() requires two Cell instances.");
    }
    this.startCell    = startCell;
    this.endCell      = endCell;
    this.done         = false;
    this.found        = false;
    this.path         = [];
    this.pathIndexMap = new Map();
    this.visitedSet   = new Set();
    this.lastVisited  = null;
    this._filledSet   = new Set();
    this._queue       = [];

    for (let row = 0; row < this.grid.rows; row++) {
      for (let col = 0; col < this.grid.cols; col++) {
        const c = this.grid.getCell(col, row);
        if (c.isIn() && c !== startCell && c !== endCell && this._isDeadEnd(c)) {
          this._queue.push(c);
        }
      }
    }
  }

  _isDeadEnd(cell) {
    if (this._filledSet.has(cell) || cell === this.startCell || cell === this.endCell) return false;
    let open = 0;
    for (const nb of this.grid.getPassableNeighbors(cell.col, cell.row)) {
      if (!this._filledSet.has(nb)) open++;
    }
    return open <= 1;
  }

  step() {
    if (this.done) return;

    while (this._queue.length) {
      const cell = this._queue.shift();
      if (this._filledSet.has(cell) || !this._isDeadEnd(cell)) continue;

      this._filledSet.add(cell);
      this.visitedSet.add(cell);
      this.lastVisited = cell;

      // Filling this cell might expose new dead ends in its neighbours.
      for (const nb of this.grid.getPassableNeighbors(cell.col, cell.row)) {
        if (!this._filledSet.has(nb) && nb !== this.startCell && nb !== this.endCell) {
          if (this._isDeadEnd(nb)) this._queue.push(nb);
        }
      }
      return; // one fill per step for smooth animation
    }

    // Queue empty — compute the surviving solution path via BFS on non-filled cells.
    this._computeSolutionPath();
    this.found = true;
    this.done  = true;
  }

  _computeSolutionPath() {
    const parents = new Map([[this.startCell, null]]);
    const queue   = [this.startCell];
    while (queue.length) {
      const c = queue.shift();
      if (c === this.endCell) break;
      for (const nb of this.grid.getPassableNeighbors(c.col, c.row)) {
        if (!this._filledSet.has(nb) && !parents.has(nb)) {
          parents.set(nb, c);
          queue.push(nb);
        }
      }
    }
    const path = [];
    let c = this.endCell;
    while (c !== null) { path.unshift(c); c = parents.get(c); }
    this.path         = path;
    this.pathIndexMap = new Map(this.path.map((cell, i) => [cell, i]));
  }
}
