import MazeGenerator from './MazeGenerator.js';

// Randomised Kruskal's algorithm.
// Assigns a random weight to every internal wall and removes them in
// order from cheapest to most expensive, merging disjoint tree
// components via Union-Find. Produces a very uniform, balanced feel.
//
// All cells are marked IN immediately at init time; the animation
// shows walls disappearing one by one rather than cells appearing.
export default class KruskalGenerator extends MazeGenerator {
  constructor(grid) {
    super(grid);
    this._walls   = [];   // shuffled list of { cell1, cell2 }
    this._wallIdx = 0;
    this._sets    = null; // Union-Find parent map
  }

  init() {
    this.frontier           = [];
    this.lastAddedCell      = null;
    this.done               = false;
    this.currentRegionIndex = 0;
    this._stepCount         = 0;
    this._startTime         = null;
    this._wallIdx           = 0;
    this._sets              = new Map();
    this._walls             = [];

    for (let row = 0; row < this.grid.rows; row++) {
      for (let col = 0; col < this.grid.cols; col++) {
        const cell = this.grid.getCell(col, row);
        if (cell.isExcluded()) continue;
        cell.markIn();
        cell.regionIndex = 0;
        this._sets.set(cell, cell);

        const eastCell  = col + 1 < this.grid.cols ? this.grid.getCell(col + 1, row) : null;
        const southCell = row + 1 < this.grid.rows ? this.grid.getCell(col, row + 1) : null;
        if (eastCell  && !eastCell.isExcluded())  this._walls.push({ cell1: cell, cell2: eastCell });
        if (southCell && !southCell.isExcluded()) this._walls.push({ cell1: cell, cell2: southCell });
      }
    }

    // Fisher-Yates shuffle — gives each wall a uniformly random priority.
    for (let i = this._walls.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this._walls[i], this._walls[j]] = [this._walls[j], this._walls[i]];
    }

    if (!this._walls.length) { this.done = true; return; }
    if (!this._startTime) this._startTime = Date.now();
  }

  step() {
    if (this.done) return;
    while (this._wallIdx < this._walls.length) {
      const { cell1, cell2 } = this._walls[this._wallIdx++];
      const r1 = this._find(cell1);
      const r2 = this._find(cell2);
      if (r1 !== r2) {
        this.grid.removeWallBetween(cell1, cell2);
        this._union(r1, r2);
        this.lastAddedCell = cell2;
        this.frontier      = [cell1, cell2];
        this._stepCount++;
        return;
      }
    }
    this.done = true;
  }

  // Union-Find with path compression.
  _find(cell) {
    let root = cell;
    while (this._sets.get(root) !== root) root = this._sets.get(root);
    let c = cell;
    while (c !== root) { const next = this._sets.get(c); this._sets.set(c, root); c = next; }
    return root;
  }

  _union(r1, r2) {
    this._sets.set(r1, r2);
  }
}
