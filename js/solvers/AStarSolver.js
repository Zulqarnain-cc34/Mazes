import Cell from '../core/Cell.js';
import MazeSolver from './MazeSolver.js';

// A* pathfinding with Manhattan-distance heuristic.
// Identical to BFS for optimal path length in an unweighted maze,
// but explores far fewer cells — it visibly "aims" toward the end.
export default class AStarSolver extends MazeSolver {
  constructor(grid) {
    super(grid);
    this._openList = [];       // unsorted array used as a priority queue
    this._inOpen   = new Set();
    this._gScore   = new Map();
    this._fScore   = new Map();
    this._parents  = new Map();
  }

  init(startCell, endCell) {
    if (!(startCell instanceof Cell) || !(endCell instanceof Cell)) {
      throw new TypeError("AStarSolver.init() requires two Cell instances.");
    }
    this.startCell    = startCell;
    this.endCell      = endCell;
    this.done         = false;
    this.found        = false;
    this.path         = [];
    this.pathIndexMap = new Map();
    this.visitedSet   = new Set([startCell]);
    this.lastVisited  = null;
    this._openList    = [startCell];
    this._inOpen      = new Set([startCell]);
    this._gScore      = new Map([[startCell, 0]]);
    this._fScore      = new Map([[startCell, this._h(startCell)]]);
    this._parents     = new Map([[startCell, null]]);
  }

  _h(cell) {
    return Math.abs(cell.col - this.endCell.col) + Math.abs(cell.row - this.endCell.row);
  }

  step() {
    if (this.done) return;
    if (!this._openList.length) { this.done = true; return; }

    // Find cell with lowest fScore — O(n) scan, fast enough for maze sizes.
    let bestIdx = 0;
    let bestF   = this._fScore.get(this._openList[0]) ?? Infinity;
    for (let i = 1; i < this._openList.length; i++) {
      const f = this._fScore.get(this._openList[i]) ?? Infinity;
      if (f < bestF) { bestF = f; bestIdx = i; }
    }

    const current = this._openList[bestIdx];
    this._openList.splice(bestIdx, 1);
    this._inOpen.delete(current);
    this.lastVisited = current;

    if (current === this.endCell) {
      this.path         = this._reconstructPath();
      this.pathIndexMap = new Map(this.path.map((c, i) => [c, i]));
      this.found        = true;
      this.done         = true;
      return;
    }

    const gCurrent = this._gScore.get(current) ?? Infinity;
    for (const nb of this.grid.getPassableNeighbors(current.col, current.row)) {
      const tentG = gCurrent + 1;
      if (tentG < (this._gScore.get(nb) ?? Infinity)) {
        this._parents.set(nb, current);
        this._gScore.set(nb, tentG);
        this._fScore.set(nb, tentG + this._h(nb));
        this.visitedSet.add(nb);
        if (!this._inOpen.has(nb)) { this._openList.push(nb); this._inOpen.add(nb); }
      }
    }
  }

  _reconstructPath() {
    const path = [];
    let cell   = this.endCell;
    while (cell !== null) { path.unshift(cell); cell = this._parents.get(cell); }
    return path;
  }
}
