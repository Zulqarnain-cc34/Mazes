import MazeGenerator from './MazeGenerator.js';

// Recursive Backtracker (depth-first search).
// Carves passages by always going deeper before backtracking,
// producing long winding corridors with few dead ends — a
// visually very different texture from Prim's.
//
// frontier = the current DFS stack (plain Cell objects).
export default class DFSGenerator extends MazeGenerator {
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
    this._enterCell(startCell);
  }

  // pickIndex selects which unvisited neighbor to explore next.
  // Items passed are { direction, cell } objects from getNeighbors().
  step(pickIndex = (arr) => Math.floor(Math.random() * arr.length)) {
    if (this.done) return;

    if (this.frontier.length === 0) {
      const next = this.grid.findFirstOutCell();
      if (next) {
        this.currentRegionIndex++;
        this._enterCell(next);
      } else {
        this.done = true;
      }
      return;
    }

    const current      = this.frontier[this.frontier.length - 1];
    const outNeighbors = this.grid.getNeighbors(current.col, current.row)
      .filter(({ cell }) => cell.isOut());

    if (outNeighbors.length > 0) {
      const { cell: next } = outNeighbors[pickIndex(outNeighbors)];
      this.grid.removeWallBetween(current, next);
      this._enterCell(next);
    } else {
      // Dead end — backtrack.
      this.frontier.pop();
      this.lastAddedCell = this.frontier[this.frontier.length - 1] || null;
    }
  }

  _enterCell(cell) {
    cell.markIn();
    cell.regionIndex = this.currentRegionIndex;
    this.frontier.push(cell);
    this.lastAddedCell = cell;
    if (!this._startTime) this._startTime = Date.now();
    this._stepCount++;
  }
}
