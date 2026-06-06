import { CELL_STATES, DIRECTIONS } from './constants.js';

export default class Cell {
  constructor(col, row) {
    if (!Cell.isValidPosition(col) || !Cell.isValidPosition(row)) {
      throw new TypeError("Cell col and row must be non-negative integers.");
    }

    this.col   = col;
    this.row   = row;
    this.state = CELL_STATES.OUT;

    // Every cell starts fully walled on all four sides.
    this.walls = {
      north: true,
      south: true,
      east:  true,
      west:  true,
    };

    // Assigned by a generator when the cell is added to a region.
    // -1 = not yet assigned. Used for multi-region color coding.
    this.regionIndex = -1;
  }

  // Returns true if this cell has been added to the maze.
  isIn() {
    return this.state === CELL_STATES.IN;
  }

  // Returns true if this cell has not been added to the maze yet.
  isOut() {
    return this.state === CELL_STATES.OUT;
  }

  // Marks this cell as part of the maze.
  markIn() {
    this.state = CELL_STATES.IN;
  }

  // Returns true if this cell is outside the shape and excluded from the maze.
  isExcluded() {
    return this.state === CELL_STATES.EXCLUDED;
  }

  // Marks this cell as excluded from the maze permanently.
  markExcluded() {
    this.state = CELL_STATES.EXCLUDED;
  }

  // Removes the wall on a given direction of this cell.
  // Direction must be one of: "north", "south", "east", "west".
  removeWall(direction) {
    if (!(direction in DIRECTIONS)) {
      throw new Error(`Invalid direction: "${direction}". Must be north, south, east, or west.`);
    }
    this.walls[direction] = false;
  }

  static isValidPosition(value) {
    return Number.isInteger(value) && value >= 0;
  }
}
