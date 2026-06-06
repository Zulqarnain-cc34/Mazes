import { DIRECTIONS } from './constants.js';
import Cell from './Cell.js';

// Owns the 2D array of cells.
// Responsible for: creating cells, fetching cells,
// returning valid neighbors, and removing the shared
// wall between two adjacent cells.
export default class MazeGrid {
  constructor(cols, rows) {
    if (!MazeGrid.isValidDimension(cols) || !MazeGrid.isValidDimension(rows)) {
      throw new TypeError("MazeGrid cols and rows must be positive integers.");
    }
    this.cols  = cols;
    this.rows  = rows;
    this.cells = this._createCells();
  }

  // Builds the 2D array: cells[row][col]
  _createCells() {
    const cells = [];
    for (let row = 0; row < this.rows; row++) {
      cells[row] = [];
      for (let col = 0; col < this.cols; col++) {
        cells[row][col] = new Cell(col, row);
      }
    }
    return cells;
  }

  // Returns the Cell at (col, row). Throws if out of bounds.
  getCell(col, row) {
    if (!this.isInsideGrid(col, row)) {
      throw new RangeError(`Cell (${col}, ${row}) is outside the grid.`);
    }
    return this.cells[row][col];
  }

  // Returns true when (col, row) is a valid position inside this grid.
  isInsideGrid(col, row) {
    return (
      Number.isInteger(col) && col >= 0 && col < this.cols &&
      Number.isInteger(row) && row >= 0 && row < this.rows
    );
  }

  // Returns all valid in-bounds neighbors of the cell at (col, row).
  // Each entry is: { direction, cell }
  getNeighbors(col, row) {
    const neighbors = [];
    for (const [direction, delta] of Object.entries(DIRECTIONS)) {
      const neighborCol = col + delta.colDelta;
      const neighborRow = row + delta.rowDelta;
      if (this.isInsideGrid(neighborCol, neighborRow)) {
        neighbors.push({ direction, cell: this.getCell(neighborCol, neighborRow) });
      }
    }
    return neighbors;
  }

  // Removes the shared wall between two adjacent cells.
  // fromCell and toCell must be direct neighbors (one step apart).
  removeWallBetween(fromCell, toCell) {
    const colDelta  = toCell.col - fromCell.col;
    const rowDelta  = toCell.row - fromCell.row;
    const direction = this._getDirectionFromDelta(colDelta, rowDelta);

    if (!direction) {
      throw new Error(
        `Cells (${fromCell.col},${fromCell.row}) and (${toCell.col},${toCell.row}) are not direct neighbors.`
      );
    }

    fromCell.removeWall(direction);
    toCell.removeWall(DIRECTIONS[direction].opposite);
  }

  // Returns the direction name for a given (colDelta, rowDelta) step.
  _getDirectionFromDelta(colDelta, rowDelta) {
    for (const [direction, delta] of Object.entries(DIRECTIONS)) {
      if (delta.colDelta === colDelta && delta.rowDelta === rowDelta) {
        return direction;
      }
    }
    return null;
  }

  // Applies a boolean mask to the grid.
  // mask[row][col] = true  → cell is included (stays OUT, available for maze)
  // mask[row][col] = false → cell is excluded (marked EXCLUDED, invisible to algorithms)
  applyMask(mask) {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (!mask[row][col]) {
          this.cells[row][col].markExcluded();
        }
      }
    }
  }

  // Returns the first cell whose state is OUT.
  // Returns null when all included cells have been visited.
  findFirstOutCell() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cell = this.cells[row][col];
        if (cell.isOut()) return cell;
      }
    }
    return null;
  }

  // Returns the first cell whose state is IN.
  findFirstInCell() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cell = this.cells[row][col];
        if (cell.isIn()) return cell;
      }
    }
    return null;
  }

  // Returns all neighbors of a cell that are reachable through open passages.
  // A passage is open when the wall flag in that direction is false.
  getPassableNeighbors(col, row) {
    const cell     = this.getCell(col, row);
    const passable = [];
    for (const { direction, cell: neighbor } of this.getNeighbors(col, row)) {
      if (!cell.walls[direction]) {
        passable.push(neighbor);
      }
    }
    return passable;
  }

  // Resets all cells back to their initial state (all walls on, all out).
  reset() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.cells[row][col] = new Cell(col, row);
      }
    }
  }

  static isValidDimension(value) {
    return Number.isInteger(value) && value > 0;
  }
}
