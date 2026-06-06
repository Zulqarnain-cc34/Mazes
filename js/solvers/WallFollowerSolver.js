import Cell from '../core/Cell.js';
import { DIRECTIONS } from '../core/constants.js';
import MazeSolver from './MazeSolver.js';

// Right-hand rule (wall follower).
// Simulates a person always keeping their right hand on a wall.
// For a simply connected (perfect) maze this is guaranteed to find
// the exit, but the path can be much longer than optimal.
//
// The trail is stored in `path` so the animation shows the walker
// backtracking through dead ends before finding the solution.
export default class WallFollowerSolver extends MazeSolver {
  constructor(grid) {
    super(grid);
    this.showVisitedAlways = false;
    this._pos       = null;
    this._facing    = "north";
    this._stepLimit = 0; // safety ceiling: 4× total in-cells
  }

  init(startCell, endCell) {
    if (!(startCell instanceof Cell) || !(endCell instanceof Cell)) {
      throw new TypeError("WallFollowerSolver.init() requires two Cell instances.");
    }
    this.startCell    = startCell;
    this.endCell      = endCell;
    this.done         = false;
    this.found        = false;
    this.path         = [startCell];
    this.pathIndexMap = new Map([[startCell, 0]]);
    this.visitedSet   = new Set([startCell]);
    this.lastVisited  = startCell;
    this._pos         = startCell;
    this._facing      = "north";
    let inCount = 0;
    for (let r = 0; r < this.grid.rows; r++)
      for (let c = 0; c < this.grid.cols; c++)
        if (this.grid.getCell(c, r).isIn()) inCount++;
    this._stepLimit = inCount * 4;
  }

  step() {
    if (this.done) return;

    const RIGHT_OF = { north: "east", east: "south", south: "west", west: "north" };
    const LEFT_OF  = { north: "west", west: "south", south: "east", east: "north" };

    const tryMove = (dir) => {
      if (this._pos.walls[dir]) return null;
      const d  = DIRECTIONS[dir];
      const nc = this.grid.isInsideGrid(this._pos.col + d.colDelta, this._pos.row + d.rowDelta)
                 ? this.grid.getCell(this._pos.col + d.colDelta, this._pos.row + d.rowDelta)
                 : null;
      return (nc && !nc.isExcluded()) ? { dir, cell: nc } : null;
    };

    // Priority: turn right → go straight → turn left → turn around.
    const move = tryMove(RIGHT_OF[this._facing])
              || tryMove(this._facing)
              || tryMove(LEFT_OF[this._facing])
              || tryMove(LEFT_OF[LEFT_OF[this._facing]]);

    if (!move) { this.done = true; return; }

    this._facing     = move.dir;
    this._pos        = move.cell;
    this.lastVisited = this._pos;
    this.visitedSet.add(this._pos);
    this.path.push(this._pos);
    this.pathIndexMap = new Map(this.path.map((c, i) => [c, i]));

    if (this._pos === this.endCell) { this.found = true; this.done = true; return; }

    if (this.path.length > this._stepLimit) {
      this.done = true;
    }
  }
}
