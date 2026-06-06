import MazeGenerator from './MazeGenerator.js';

// The simplest possible maze algorithm.
// For each cell (row by row, left to right): flip a coin to carve
// either north or east. Top-row cells can only carve east;
// right-column cells can only carve north.
//
// Produces a strong diagonal texture (north-east bias) and always
// leaves the top-right corner connected to every cell in the maze.
// Works best on full rectangular grids; irregular masks may leave
// isolated pockets.
export default class BinaryTreeGenerator extends MazeGenerator {
  constructor(grid) {
    super(grid);
    this._cellList = [];
    this._cellIdx  = 0;
  }

  init() {
    this.frontier           = [];
    this.lastAddedCell      = null;
    this.done               = false;
    this.currentRegionIndex = 0;
    this._stepCount         = 0;
    this._startTime         = null;
    this._cellIdx           = 0;
    this._cellList          = [];

    for (let row = 0; row < this.grid.rows; row++) {
      for (let col = 0; col < this.grid.cols; col++) {
        const c = this.grid.getCell(col, row);
        if (!c.isExcluded()) this._cellList.push(c);
      }
    }

    if (!this._cellList.length) { this.done = true; return; }
    if (!this._startTime) this._startTime = Date.now();
  }

  step() {
    if (this.done) return;
    if (this._cellIdx >= this._cellList.length) { this.done = true; return; }

    const cell = this._cellList[this._cellIdx++];
    cell.markIn();
    cell.regionIndex   = 0;
    this.lastAddedCell = cell;
    this._stepCount++;

    const candidates = [];
    const north = this.grid.isInsideGrid(cell.col, cell.row - 1)
                  ? this.grid.getCell(cell.col, cell.row - 1) : null;
    const east  = this.grid.isInsideGrid(cell.col + 1, cell.row)
                  ? this.grid.getCell(cell.col + 1, cell.row) : null;

    if (north && !north.isExcluded()) candidates.push(north);
    if (east  && !east.isExcluded())  candidates.push(east);

    if (candidates.length) {
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      this.grid.removeWallBetween(cell, chosen);
    }

    this.frontier = [cell];
  }
}
