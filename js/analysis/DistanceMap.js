import MazeGrid from '../core/MazeGrid.js';
import BFSTraverser from './BFSTraverser.js';

// Computes and stores distances from a start cell to every
// reachable cell in the maze.
//
// The traversal strategy is injected — pass any object with
// a traverse(grid, startCell) method. Default is BFSTraverser.
export default class DistanceMap {
  constructor(grid, traverser = new BFSTraverser()) {
    if (!(grid instanceof MazeGrid)) {
      throw new TypeError("DistanceMap requires a MazeGrid.");
    }
    this.grid        = grid;
    this.traverser   = traverser;
    this.distances   = new Map();
    this.maxDistance = 0;
  }

  // Delegates traversal to the injected strategy and stores the result.
  compute(startCol, startRow) {
    this.distances   = new Map();
    this.maxDistance = 0;

    const startCell = this.grid.getCell(startCol, startRow);
    this.distances  = this.traverser.traverse(this.grid, startCell);

    for (const dist of this.distances.values()) {
      if (dist > this.maxDistance) this.maxDistance = dist;
    }
  }

  // Returns the distance of a cell from the start, or -1 if not reached.
  getDistance(cell) {
    return this.distances.has(cell) ? this.distances.get(cell) : -1;
  }

  // Returns a 0.0–1.0 value representing how far this cell is relative to
  // the farthest cell. Used for color interpolation.
  getNormalized(cell) {
    const dist = this.getDistance(cell);
    if (dist < 0 || this.maxDistance === 0) return 0;
    return dist / this.maxDistance;
  }
}
