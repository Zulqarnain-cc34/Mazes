// The two possible states a cell can be in during maze generation.
// "out" means the cell has not been added to the maze yet.
// "in"  means the cell has been added to the maze.
const CELL_STATES = Object.freeze({
  OUT:      "out",       // not yet added to the maze
  IN:       "in",        // added to the maze
  EXCLUDED: "excluded",  // outside the shape — never touched by any algorithm
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

  // Returns the first cell whose state is OUT (included but not yet in the maze).
  // Returns null when no such cell exists — all included cells have been visited.
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
  // Used to find a valid BFS start after generation when (0,0) may be excluded.
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
  // This is the shared entry point for any traversal algorithm (BFS, A*, DFS, etc.)
  getPassableNeighbors(col, row) {
    const cell      = this.getCell(col, row);
    const passable  = [];

    for (const { direction, cell: neighbor } of this.getNeighbors(col, row)) {
      if (!cell.walls[direction]) {
        passable.push(neighbor);
      }
    }

    return passable;
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
  // pickIndex is an optional function that receives the current frontier array
  // and returns the index of the entry to process next.
  // Defaults to pure random selection.
  // Swap it out for any scoring function (e.g. Perlin noise) without touching this class.
  step(pickIndex = (frontier) => Math.floor(Math.random() * frontier.length)) {
    if (this.done) {
      return;
    }

    // Drain stale entries where outCell is already in.
    // We delegate index selection to pickIndex, then swap-remove for O(1) removal.
    while (this.frontier.length > 0) {
      const index = pickIndex(this.frontier);
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

  // Runs all remaining steps instantly, completing the maze in one call.
  // Used when the user wants to skip the animation.
  complete(pickIndex = (frontier) => Math.floor(Math.random() * frontier.length)) {
    while (!this.done) {
      this.step(pickIndex);
    }
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

// ─────────────────────────────────────────────
// MultiRegionPrims
// Runs Prim's algorithm across an entire masked
// grid, handling disconnected regions automatically.
//
// When one region's frontier empties, it finds the
// next unvisited OUT cell and starts a new Prim's
// run there. Each region becomes its own perfect maze.
//
// Exposes the same interface as PrimsMaze so
// sketch.js needs no branching logic.
// ─────────────────────────────────────────────

class MultiRegionPrims {
  constructor(grid) {
    if (!(grid instanceof MazeGrid)) {
      throw new TypeError("MultiRegionPrims requires a MazeGrid.");
    }

    this.grid          = grid;
    this.frontier      = [];
    this.lastAddedCell = null;
    this.done          = false;
  }

  // Finds the first OUT cell and seeds the first region.
  init() {
    this.frontier      = [];
    this.lastAddedCell = null;
    this.done          = false;

    const startCell = this.grid.findFirstOutCell();

    if (!startCell) {
      this.done = true;
      return;
    }

    this.addCellToMaze(startCell);
  }

  // Runs one iteration. If the current region is exhausted, starts the next one.
  // Each call adds exactly one cell to the maze.
  step(pickIndex = (frontier) => Math.floor(Math.random() * frontier.length)) {
    if (this.done) {
      return;
    }

    while (this.frontier.length > 0) {
      const index = pickIndex(this.frontier);
      const entry = this.removeAtIndex(index);

      if (entry.outCell.isIn()) {
        continue;
      }

      this.grid.removeWallBetween(entry.inCell, entry.outCell);
      this.addCellToMaze(entry.outCell);
      return;
    }

    // Current region exhausted. Find the next unvisited included cell.
    const nextCell = this.grid.findFirstOutCell();

    if (nextCell) {
      this.addCellToMaze(nextCell);
    } else {
      this.done = true;
    }
  }

  isDone() {
    return this.done;
  }

  complete(pickIndex = (frontier) => Math.floor(Math.random() * frontier.length)) {
    while (!this.done) {
      this.step(pickIndex);
    }
  }

  // Marks a cell as in, records it as lastAddedCell, and pushes its
  // included out-neighbors into the frontier.
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

  removeAtIndex(index) {
    const entry                  = this.frontier[index];
    this.frontier[index]         = this.frontier[this.frontier.length - 1];
    this.frontier.length        -= 1;
    return entry;
  }
}

// ─────────────────────────────────────────────
// MaskBuilder
// Produces boolean[row][col] mask arrays.
// true  = cell is included in the maze
// false = cell is excluded (outside the shape)
//
// Static factory methods — one per mask type.
// To add a new shape, add a new static method here.
// ─────────────────────────────────────────────

class MaskBuilder {
  // Full grid — all cells included. Default, no shape constraint.
  static fullGrid(cols, rows) {
    return Array.from({ length: rows }, () => Array(cols).fill(true));
  }

  // Cross / plus shape centered on the grid.
  static cross(cols, rows) {
    const midC   = Math.floor(cols / 2);
    const midR   = Math.floor(rows / 2);
    const armW   = Math.floor(cols * 0.22);

    return Array.from({ length: rows }, (_, row) =>
      Array.from({ length: cols }, (_, col) => {
        const inHBar = row >= midR - armW && row <= midR + armW;
        const inVBar = col >= midC - armW && col <= midC + armW;
        return inHBar || inVBar;
      })
    );
  }

  // Two separate rectangles — clearly shows the multi-region feature.
  // Top-left box and bottom-right box have no connection between them.
  static twoBoxes(cols, rows) {
    return Array.from({ length: rows }, (_, row) =>
      Array.from({ length: cols }, (_, col) => {
        const inTopLeft     = row >= 2  && row < Math.floor(rows * 0.42) &&
                              col >= 2  && col < Math.floor(cols * 0.45);
        const inBottomRight = row >= Math.floor(rows * 0.58) && row < rows - 2 &&
                              col >= Math.floor(cols * 0.55) && col < cols - 2;
        return inTopLeft || inBottomRight;
      })
    );
  }

  // Hollow frame — a rectangle with a rectangular hole in the center.
  // The ring itself is one connected region.
  static ring(cols, rows) {
    const borderW = Math.floor(cols * 0.12);
    const borderH = Math.floor(rows * 0.12);

    return Array.from({ length: rows }, (_, row) =>
      Array.from({ length: cols }, (_, col) => {
        const insideOuter = row >= 1 && row < rows - 1 && col >= 1 && col < cols - 1;
        const insideInner = row > borderH && row < rows - borderH - 1 &&
                            col > borderW && col < cols - borderW - 1;
        return insideOuter && !insideInner;
      })
    );
  }

  // Diamond shape.
  static diamond(cols, rows) {
    const cx = cols / 2;
    const cy = rows / 2;

    return Array.from({ length: rows }, (_, row) =>
      Array.from({ length: cols }, (_, col) => {
        const dx = Math.abs(col - cx) / (cols / 2);
        const dy = Math.abs(row - cy) / (rows / 2);
        return dx + dy <= 0.95;
      })
    );
  }

  // Creates a mask from a p5.js image object.
  // Dark pixels (brightness < threshold) = included.
  // Call after loadImage() and in setup() or after image is ready.
  static fromImage(img, cols, rows, threshold = 128) {
    img.resize(cols, rows);
    img.loadPixels();

    return Array.from({ length: rows }, (_, row) =>
      Array.from({ length: cols }, (_, col) => {
        const i = (row * cols + col) * 4;
        const brightness = (img.pixels[i] + img.pixels[i + 1] + img.pixels[i + 2]) / 3;
        return brightness < threshold;
      })
    );
  }
}

// ─────────────────────────────────────────────
// BFSTraverser
// Traversal strategy that computes the shortest
// distance from a start cell to every reachable
// cell using Breadth-First Search.
//
// Returns a Map<Cell, distance> where distance
// is the number of passages walked to reach it.
//
// To add a new algorithm (A*, DFS, Dijkstra),
// create a new class with the same traverse()
// signature and pass it to DistanceMap.
// ─────────────────────────────────────────────

class BFSTraverser {
  // Walks the maze from startCell using BFS.
  // Only follows open passages (walls that are false).
  // Returns Map<Cell, distance>.
  traverse(grid, startCell) {
    const distances = new Map();
    const queue     = [startCell];
    distances.set(startCell, 0);

    while (queue.length > 0) {
      const current     = queue.shift();
      const currentDist = distances.get(current);

      for (const neighbor of grid.getPassableNeighbors(current.col, current.row)) {
        if (!distances.has(neighbor)) {
          distances.set(neighbor, currentDist + 1);
          queue.push(neighbor);
        }
      }
    }

    return distances;
  }
}

// ─────────────────────────────────────────────
// DistanceMap
// Computes and stores distances from a start
// cell to every reachable cell in the maze.
//
// The traversal strategy is injected — pass any
// object with a traverse(grid, startCell) method.
// Default is BFSTraverser.
// ─────────────────────────────────────────────

class DistanceMap {
  constructor(grid, traverser = new BFSTraverser()) {
    if (!(grid instanceof MazeGrid)) {
      throw new TypeError("DistanceMap requires a MazeGrid.");
    }

    this.grid        = grid;
    this.traverser   = traverser;
    this.distances   = new Map();  // Cell → distance (integer)
    this.maxDistance = 0;
  }

  // Delegates traversal to the injected strategy and stores the result.
  compute(startCol, startRow) {
    this.distances   = new Map();
    this.maxDistance = 0;

    const startCell  = this.grid.getCell(startCol, startRow);
    this.distances   = this.traverser.traverse(this.grid, startCell);

    for (const dist of this.distances.values()) {
      if (dist > this.maxDistance) {
        this.maxDistance = dist;
      }
    }
  }

  // Returns the distance of a cell from the start, or -1 if not reached.
  getDistance(cell) {
    return this.distances.has(cell) ? this.distances.get(cell) : -1;
  }

  // Returns a 0.0–1.0 value representing how far this cell is
  // relative to the farthest cell. Used for color interpolation.
  getNormalized(cell) {
    const dist = this.getDistance(cell);

    if (dist < 0 || this.maxDistance === 0) {
      return 0;
    }

    return dist / this.maxDistance;
  }
}
