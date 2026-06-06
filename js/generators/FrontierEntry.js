import Cell from '../core/Cell.js';

// A single entry in the frontier list used by Prim's algorithm.
// Represents one candidate passage:
//   inCell  — already part of the maze
//   outCell — its neighbor that has not been added yet
export default class FrontierEntry {
  constructor(inCell, outCell) {
    if (!(inCell instanceof Cell) || !(outCell instanceof Cell)) {
      throw new TypeError("FrontierEntry requires two Cell instances.");
    }
    this.inCell  = inCell;
    this.outCell = outCell;
  }
}
