import MazeGenerator from './MazeGenerator.js';

// Completely random walk.
// Steps to a random neighbour each frame.
// If that neighbour is unvisited (OUT), carve a passage and add it.
// Statistically the most unbiased generator: every possible spanning
// tree is equally likely, but it is the slowest in practice.
//
// Multi-region: counts the topological size of each region before
// starting so it knows when to move on to the next disconnected area.
export default class AldousBroderGenerator extends MazeGenerator {
  constructor(grid) {
    super(grid);
    this._regionTotal   = 0;
    this._regionVisited = 0;
    this._current       = null;
  }

  init() {
    this.frontier           = [];
    this.lastAddedCell      = null;
    this.done               = false;
    this.currentRegionIndex = 0;
    this._stepCount         = 0;
    this._startTime         = null;

    const start = this.grid.findFirstOutCell();
    if (!start) { this.done = true; return; }
    this._startRegion(start);
  }

  _startRegion(cell) {
    this._regionTotal   = this._countRegionSize(cell);
    this._regionVisited = 1;
    cell.markIn();
    cell.regionIndex   = this.currentRegionIndex;
    this._current      = cell;
    this.lastAddedCell = cell;
    this.frontier      = [cell];
    if (!this._startTime) this._startTime = Date.now();
    this._stepCount++;
  }

  // BFS over topological adjacency (ignoring walls / excluded cells) to count
  // how many cells belong to the same connected component as startCell.
  _countRegionSize(startCell) {
    const visited = new Set([startCell]);
    const queue   = [startCell];
    while (queue.length) {
      const c = queue.shift();
      for (const { cell: nb } of this.grid.getNeighbors(c.col, c.row)) {
        if (!nb.isExcluded() && !visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }
    return visited.size;
  }

  step() {
    if (this.done) return;

    const nbrs = this.grid.getNeighbors(this._current.col, this._current.row)
                          .filter(({ cell }) => !cell.isExcluded());
    if (!nbrs.length) { this._nextRegion(); return; }

    const { cell: next } = nbrs[Math.floor(this.rng() * nbrs.length)];

    if (next.isOut()) {
      this.grid.removeWallBetween(this._current, next);
      next.markIn();
      next.regionIndex   = this.currentRegionIndex;
      this.lastAddedCell = next;
      this._regionVisited++;
      this._stepCount++;
      if (this._regionVisited >= this._regionTotal) { this._nextRegion(); return; }
    }

    this._current = next;
    this.frontier = [this._current];
  }

  _nextRegion() {
    const next = this.grid.findFirstOutCell();
    if (next) { this.currentRegionIndex++; this._startRegion(next); }
    else       { this.done = true; }
  }
}
