import MazeGenerator from './MazeGenerator.js';
import FrontierEntry from './FrontierEntry.js';

// Randomised Prim's algorithm.
// Grows the maze by always picking from the frontier
// (a pool of passages that connect IN cells to OUT cells).
// Supports disconnected regions: when one region's frontier
// empties, it seeds the next unvisited OUT cell automatically.
//
// frontier entries = FrontierEntry objects { inCell, outCell }
export default class PrimsGenerator extends MazeGenerator {
  constructor(grid) {
    super(grid);
  }

  init() {
    this.frontier           = [];
    this.lastAddedCell      = null;
    this.done               = false;
    this.currentRegionIndex = 0;
    this._stepCount         = 0;
    this._startTime         = null;

    const startCell = this.grid.findFirstOutCell();
    if (!startCell) { this.done = true; return; }
    this._addCell(startCell);
  }

  step(pickIndex = (arr) => Math.floor(this.rng() * arr.length)) {
    if (this.done) return;

    while (this.frontier.length > 0) {
      const i     = pickIndex(this.frontier);
      const entry = this._removeAt(i);

      if (entry.outCell.isIn()) continue; // already claimed by another passage

      this.grid.removeWallBetween(entry.inCell, entry.outCell);
      this._addCell(entry.outCell);
      return;
    }

    // Current region exhausted — start the next disconnected region.
    const next = this.grid.findFirstOutCell();
    if (next) {
      this.currentRegionIndex++;
      this._addCell(next);
    } else {
      this.done = true;
    }
  }

  _addCell(cell) {
    cell.markIn();
    cell.regionIndex = this.currentRegionIndex;
    this.lastAddedCell = cell;
    if (!this._startTime) this._startTime = Date.now();
    this._stepCount++;

    for (const { cell: neighbor } of this.grid.getNeighbors(cell.col, cell.row)) {
      if (neighbor.isOut()) {
        this.frontier.push(new FrontierEntry(cell, neighbor));
      }
    }
  }

  // O(1) swap-removal — order is irrelevant since we pick randomly anyway.
  _removeAt(index) {
    const entry = this.frontier[index];
    this.frontier[index] = this.frontier[this.frontier.length - 1];
    this.frontier.length--;
    return entry;
  }
}
