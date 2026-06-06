import MazeGenerator from './MazeGenerator.js';

// Loop-erased random walk (LERW).
// Picks any unvisited cell, does a random walk until hitting the maze,
// erases any loops that formed during the walk, then carves the
// resulting loop-free path into the maze in one shot.
//
// Also unbiased like Aldous-Broder but converges much faster in practice.
// Visually striking: long snaking paths snap into place all at once.
export default class WilsonsGenerator extends MazeGenerator {
  constructor(grid) {
    super(grid);
    this._walkPath  = [];         // cells in the current in-progress walk
    this._walkIndex = new Map();  // cell → index in walkPath for O(1) loop detection
  }

  init() {
    this.frontier           = [];
    this.lastAddedCell      = null;
    this.done               = false;
    this.currentRegionIndex = 0;
    this._stepCount         = 0;
    this._startTime         = null;
    this._walkPath          = [];
    this._walkIndex         = new Map();

    const seed = this.grid.findFirstOutCell();
    if (!seed) { this.done = true; return; }
    this._seedAndWalk(seed);
  }

  // Mark seedCell as IN (first cell of a new region), then start a fresh walk.
  _seedAndWalk(seedCell) {
    seedCell.markIn();
    seedCell.regionIndex = this.currentRegionIndex;
    this.lastAddedCell   = seedCell;
    if (!this._startTime) this._startTime = Date.now();
    this._stepCount++;
    this._beginWalk();
  }

  _beginWalk() {
    const start = this.grid.findFirstOutCell();
    if (!start) { this.done = true; return; }

    // If this OUT cell's connected region has no IN cells yet, seed it first.
    if (!this._regionHasInCell(start)) {
      this.currentRegionIndex++;
      this._seedAndWalk(start);
      return;
    }

    this._walkPath  = [start];
    this._walkIndex = new Map([[start, 0]]);
    this.frontier   = [start];
  }

  // Returns true if any cell reachable from `cell` (topological adjacency) is IN.
  _regionHasInCell(cell) {
    const seen  = new Set([cell]);
    const queue = [cell];
    while (queue.length) {
      const c = queue.shift();
      for (const { cell: nb } of this.grid.getNeighbors(c.col, c.row)) {
        if (nb.isExcluded()) continue;
        if (nb.isIn()) return true;
        if (!seen.has(nb)) { seen.add(nb); queue.push(nb); }
      }
    }
    return false;
  }

  step() {
    if (this.done) return;
    if (!this._walkPath.length) { this._beginWalk(); return; }

    const current = this._walkPath[this._walkPath.length - 1];
    const nbrs    = this.grid.getNeighbors(current.col, current.row)
                             .filter(({ cell }) => !cell.isExcluded());
    if (!nbrs.length) { this.done = true; return; }

    const { cell: next } = nbrs[Math.floor(Math.random() * nbrs.length)];

    if (next.isIn()) {
      // Walk has reached the maze — carve the entire path at once.
      this._carvePath(next);
    } else if (this._walkIndex.has(next)) {
      // Loop detected — erase back to the revisited cell.
      const loopAt        = this._walkIndex.get(next);
      this._walkPath      = this._walkPath.slice(0, loopAt + 1);
      this._walkIndex     = new Map(this._walkPath.map((c, i) => [c, i]));
      this.frontier       = [...this._walkPath];
    } else {
      this._walkPath.push(next);
      this._walkIndex.set(next, this._walkPath.length - 1);
      this.frontier = [...this._walkPath];
    }
  }

  _carvePath(inCell) {
    let prev = null;
    for (const cell of this._walkPath) {
      if (prev) this.grid.removeWallBetween(prev, cell);
      if (cell.isOut()) {
        cell.markIn();
        cell.regionIndex   = this.currentRegionIndex;
        this.lastAddedCell = cell;
        this._stepCount++;
      }
      prev = cell;
    }
    if (prev) this.grid.removeWallBetween(prev, inCell);
    this._beginWalk();
  }
}
