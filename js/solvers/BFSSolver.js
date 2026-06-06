import Cell from '../core/Cell.js';
import MazeSolver from './MazeSolver.js';

// Breadth-first search pathfinder.
// Guarantees the shortest path in an unweighted maze.
export default class BFSSolver extends MazeSolver {
  constructor(grid) {
    super(grid);
    this._queue   = [];
    this._parents = new Map(); // Cell → parent Cell (or null for startCell)
  }

  init(startCell, endCell) {
    if (!(startCell instanceof Cell) || !(endCell instanceof Cell)) {
      throw new TypeError("BFSSolver.init() requires two Cell instances.");
    }
    this.startCell    = startCell;
    this.endCell      = endCell;
    this.done         = false;
    this.found        = false;
    this.path         = [];
    this.pathIndexMap = new Map();
    this.visitedSet   = new Set([startCell]);
    this.lastVisited  = null;
    this._queue       = [startCell];
    this._parents     = new Map([[startCell, null]]);
  }

  step() {
    if (this.done) return;
    if (this._queue.length === 0) { this.done = true; return; }

    const current    = this._queue.shift();
    this.lastVisited = current;

    if (current === this.endCell) {
      this.path         = this._reconstructPath();
      this.pathIndexMap = new Map(this.path.map((c, i) => [c, i]));
      this.found        = true;
      this.done         = true;
      return;
    }

    for (const neighbor of this.grid.getPassableNeighbors(current.col, current.row)) {
      if (!this._parents.has(neighbor)) {
        this._parents.set(neighbor, current);
        this.visitedSet.add(neighbor);
        this._queue.push(neighbor);
      }
    }
  }

  _reconstructPath() {
    const path = [];
    let cell = this.endCell;
    while (cell !== null) {
      path.unshift(cell);
      cell = this._parents.get(cell);
    }
    return path;
  }
}
