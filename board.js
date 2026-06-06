// The two possible states a cell can be in during maze generation.
// "out" means the cell has not been added to the maze yet.
// "in"  means the cell has been added to the maze.
const CELL_STATES = Object.freeze({
  OUT: "out",
  IN:  "in",
});

// The four directions a cell can connect to a neighbor.
// Each direction stores:
//   - colDelta: how many columns to move to reach the neighbor
//   - rowDelta: how many rows to move to reach the neighbor
//   - opposite: the direction name as seen from the neighbor's side
const DIRECTIONS = Object.freeze({
  north: Object.freeze({ colDelta:  0, rowDelta: -1, opposite: "south" }),
  south: Object.freeze({ colDelta:  0, rowDelta:  1, opposite: "north" }),
  east:  Object.freeze({ colDelta:  1, rowDelta:  0, opposite: "west"  }),
  west:  Object.freeze({ colDelta: -1, rowDelta:  0, opposite: "east"  }),
});

class Cell {
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

// ─────────────────────────────────────────────
// MazeGrid
// Owns the 2D array of cells.
// Responsible for: creating cells, fetching cells,
// returning valid neighbors, and removing the shared
// wall between two adjacent cells.
// ─────────────────────────────────────────────

class MazeGrid {
  constructor(cols, rows) {
    if (!MazeGrid.isValidDimension(cols) || !MazeGrid.isValidDimension(rows)) {
      throw new TypeError("MazeGrid cols and rows must be positive integers.");
    }

    this.cols  = cols;
    this.rows  = rows;
    this.cells = this.createCells();
  }

  // Builds the 2D array: cells[row][col]
  createCells() {
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
  // direction is the name of the direction from the source cell ("north", "south", etc.)
  getNeighbors(col, row) {
    const neighbors = [];

    for (const [direction, delta] of Object.entries(DIRECTIONS)) {
      const neighborCol = col + delta.colDelta;
      const neighborRow = row + delta.rowDelta;

      if (this.isInsideGrid(neighborCol, neighborRow)) {
        neighbors.push({
          direction,
          cell: this.getCell(neighborCol, neighborRow),
        });
      }
    }

    return neighbors;
  }

  // Removes the shared wall between two adjacent cells.
  // fromCell and toCell must be direct neighbors (one step apart).
  // Both cells are updated: fromCell loses its wall toward toCell,
  // toCell loses its wall back toward fromCell.
  removeWallBetween(fromCell, toCell) {
    const colDelta = toCell.col - fromCell.col;
    const rowDelta = toCell.row - fromCell.row;

    const direction = this.getDirectionFromDelta(colDelta, rowDelta);

    if (!direction) {
      throw new Error(
        `Cells (${fromCell.col},${fromCell.row}) and (${toCell.col},${toCell.row}) are not direct neighbors.`
      );
    }

    fromCell.removeWall(direction);
    toCell.removeWall(DIRECTIONS[direction].opposite);
  }

  // Returns the direction name for a given (colDelta, rowDelta) step.
  // Returns null if the delta does not match any direction.
  getDirectionFromDelta(colDelta, rowDelta) {
    for (const [direction, delta] of Object.entries(DIRECTIONS)) {
      if (delta.colDelta === colDelta && delta.rowDelta === rowDelta) {
        return direction;
      }
    }

    return null;
  }

  // Resets all cells back to their initial state (all walls on, all out).
  // Used when restarting the maze generation.
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

// ─────────────────────────────────────────────
// FrontierEntry
// A single entry in the frontier list.
// Represents one candidate passage:
//   inCell  — already part of the maze
//   outCell — its neighbor that has not been added yet
// ─────────────────────────────────────────────

class FrontierEntry {
  constructor(inCell, outCell) {
    if (!(inCell instanceof Cell) || !(outCell instanceof Cell)) {
      throw new TypeError("FrontierEntry requires two Cell instances.");
    }

    this.inCell  = inCell;
    this.outCell = outCell;
  }
}

// ─────────────────────────────────────────────
// PrimsMaze
// Drives the Prim's algorithm step by step.
// Owns the grid and the frontier list.
// Call init() to start, then step() once per frame.
// ─────────────────────────────────────────────

class PrimsMaze {
  constructor(cols, rows) {
    this.grid          = new MazeGrid(cols, rows);
    this.frontier      = [];
    this.lastAddedCell = null;
    this.done          = false;
  }

  // Picks a random starting cell, marks it in, and seeds the frontier
  // with all of its out-neighbors.
  // If no start position is provided, a random cell is chosen.
  init(startCol = null, startRow = null) {
    this.grid.reset();
    this.frontier      = [];
    this.lastAddedCell = null;
    this.done          = false;

    const col = startCol !== null ? startCol : Math.floor(Math.random() * this.grid.cols);
    const row = startRow !== null ? startRow : Math.floor(Math.random() * this.grid.rows);

    const startCell = this.grid.getCell(col, row);
    this.addCellToMaze(startCell);
  }

  // Runs one iteration of Prim's algorithm.
  // Picks a random frontier entry, checks if the outCell is still out,
  // and if so opens the wall and expands the frontier.
  step() {
    if (this.done) {
      return;
    }

    // Drain stale entries where outCell is already in.
    // We pick a random index, swap-remove it for O(1) removal,
    // and check if the outCell is still out.
    while (this.frontier.length > 0) {
      const index = Math.floor(Math.random() * this.frontier.length);
      const entry = this.removeAtIndex(index);

      if (entry.outCell.isIn()) {
        // This outCell was already added by a different frontier entry. Skip it.
        continue;
      }

      // outCell is still out — open the passage and add it to the maze.
      this.grid.removeWallBetween(entry.inCell, entry.outCell);
      this.addCellToMaze(entry.outCell);
      return;
    }

    // Frontier is empty: every cell has been added. Generation is complete.
    this.done = true;
  }

  // Returns true when maze generation is complete.
  isDone() {
    return this.done;
  }

  // Marks a cell as in, records it as the last added cell,
  // and pushes all of its out-neighbors into the frontier.
  addCellToMaze(cell) {
    cell.markIn();
    this.lastAddedCell = cell;

    const neighbors = this.grid.getNeighbors(cell.col, cell.row);

    for (const { cell: neighbor } of neighbors) {
      if (neighbor.isOut()) {
        this.frontier.push(new FrontierEntry(cell, neighbor));
      }
    }
  }

  // Removes the entry at a given index using swap-removal (O(1)).
  // Swap-removal replaces the target with the last element and pops the array,
  // avoiding the O(n) cost of splice() without changing correctness
  // since frontier order does not matter (we pick randomly anyway).
  removeAtIndex(index) {
    const entry                  = this.frontier[index];
    this.frontier[index]         = this.frontier[this.frontier.length - 1];
    this.frontier.length        -= 1;
    return entry;
  }
}
