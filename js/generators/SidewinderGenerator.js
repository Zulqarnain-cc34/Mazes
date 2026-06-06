import MazeGenerator from './MazeGenerator.js';

// Row-based algorithm that eliminates Binary Tree's diagonal bias.
// For each row, maintains a "run" of consecutive cells. At each
// step it either extends the run eastward or closes the run by
// carving north from a random member of the run.
//
// Top row is always carved entirely east (no north to carve).
// Produces interesting horizontal corridors without the strong
// north-east bias of Binary Tree.
export default class SidewinderGenerator extends MazeGenerator {
  constructor(grid) {
    super(grid);
    this._cellList   = [];
    this._cellIdx    = 0;
    this._currentRun = [];
  }

  init() {
    this.frontier           = [];
    this.lastAddedCell      = null;
    this.done               = false;
    this.currentRegionIndex = 0;
    this._stepCount         = 0;
    this._startTime         = null;
    this._cellIdx           = 0;
    this._currentRun        = [];
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

    // Starting a new row resets the run.
    if (!this._currentRun.length || cell.row !== this._currentRun[this._currentRun.length - 1].row) {
      this._currentRun = [];
    }

    cell.markIn();
    cell.regionIndex   = 0;
    this.lastAddedCell = cell;
    this._stepCount++;
    this._currentRun.push(cell);

    const eastCell = this.grid.isInsideGrid(cell.col + 1, cell.row)
                     ? this.grid.getCell(cell.col + 1, cell.row) : null;
    const atEast   = !eastCell || eastCell.isExcluded();
    const atNorth  = cell.row === 0 || !this.grid.isInsideGrid(cell.col, cell.row - 1);

    if (atNorth) {
      // Top boundary — only option is east.
      if (!atEast) this.grid.removeWallBetween(cell, eastCell);
      else         this._currentRun = [];
    } else if (atEast || Math.random() < 0.5) {
      // Close the run: carve north from a random run member.
      const withNorth = this._currentRun.filter(c =>
        this.grid.isInsideGrid(c.col, c.row - 1) &&
        !this.grid.getCell(c.col, c.row - 1).isExcluded()
      );
      if (withNorth.length) {
        const chosen = withNorth[Math.floor(Math.random() * withNorth.length)];
        this.grid.removeWallBetween(chosen, this.grid.getCell(chosen.col, chosen.row - 1));
      }
      this._currentRun = [];
    } else {
      // Extend the run east.
      this.grid.removeWallBetween(cell, eastCell);
    }

    this.frontier = [cell];
  }
}
