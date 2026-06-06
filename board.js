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

  // Computes the optimal threshold for an image using Otsu's method.
  // Otsu's method finds the threshold that maximizes inter-class variance
  // between dark pixels (shape) and light pixels (background).
  // This is the industry standard used by OpenCV, scikit-image, and MATLAB.
  // Returns an integer in the range 0–255.
  static otsuThreshold(img) {
    img.loadPixels();

    const total     = img.width * img.height;
    const histogram = new Array(256).fill(0);

    for (let i = 0; i < img.pixels.length; i += 4) {
      const lum = Math.round(
        0.299 * img.pixels[i] +
        0.587 * img.pixels[i + 1] +
        0.114 * img.pixels[i + 2]
      );
      histogram[lum]++;
    }

    const prob = histogram.map((count) => count / total);

    let bestThreshold = 0;
    let bestVariance  = 0;
    let w0 = 0;
    let sum0 = 0;
    let sumTotal = 0;

    for (let i = 0; i < 256; i++) {
      sumTotal += i * prob[i];
    }

    for (let t = 0; t < 256; t++) {
      w0   += prob[t];
      sum0 += t * prob[t];

      const w1 = 1 - w0;

      if (w0 === 0 || w1 === 0) continue;

      const mean0   = sum0 / w0;
      const mean1   = (sumTotal - sum0) / w1;
      const variance = w0 * w1 * Math.pow(mean0 - mean1, 2);

      if (variance > bestVariance) {
        bestVariance  = variance;
        bestThreshold = t;
      }
    }

    return bestThreshold;
  }

  // Creates a mask from a p5.js image object.
  // Dark pixels (luminance < threshold) = included in the maze.
  // Light pixels = excluded.
  //
  // If threshold is null, Otsu's method is used to compute the optimal value.
  //
  // Uses area sampling: for each grid cell, averages the luminance of
  // every pixel in the corresponding image region.
  // Uses perceptual luminance weights (0.299R + 0.587G + 0.114B).
  static fromImage(img, cols, rows, threshold = null) {
    img.loadPixels();

    const t     = threshold !== null ? threshold : MaskBuilder.otsuThreshold(img);
    const cellW = img.width  / cols;
    const cellH = img.height / rows;
    const mask  = [];

    for (let row = 0; row < rows; row++) {
      mask[row] = [];

      for (let col = 0; col < cols; col++) {
        const x0 = Math.floor(col * cellW);
        const y0 = Math.floor(row * cellH);
        const x1 = Math.min(Math.floor((col + 1) * cellW), img.width  - 1);
        const y1 = Math.min(Math.floor((row + 1) * cellH), img.height - 1);

        let total = 0;
        let count = 0;

        for (let py = y0; py <= y1; py++) {
          for (let px = x0; px <= x1; px++) {
            const i   = (py * img.width + px) * 4;
            const lum = 0.299 * img.pixels[i] +
                        0.587 * img.pixels[i + 1] +
                        0.114 * img.pixels[i + 2];
            total += lum;
            count += 1;
          }
        }

        const avgLum   = count > 0 ? total / count : 255;
        mask[row][col] = avgLum < t;
      }
    }

    return mask;
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

// ─────────────────────────────────────────────
// MazeGenerator  (abstract base class)
// Defines the contract every generator must fulfill.
//
// Subclasses must implement:
//   init()           — reset and seed the first cell
//   step(pickIndex)  — advance one cell, using pickIndex to
//                      select from a list of candidates
//
// The base class provides:
//   isDone()         — completion guard
//   complete()       — drain all remaining steps at once
//   cellsPerSecond   — live throughput counter
//
// Shared rendering properties:
//   frontier         — the "active" cell list (frontier array
//                      for Prim's, stack for DFS); used by
//                      sketch.js to highlight pending work
//   lastAddedCell    — the most recently visited cell (yellow dot)
// ─────────────────────────────────────────────

class MazeGenerator {
  constructor(grid) {
    if (!(grid instanceof MazeGrid)) {
      throw new TypeError("MazeGenerator requires a MazeGrid.");
    }
    this.grid               = grid;
    this.frontier           = [];   // active cell list — interpretation depends on subclass
    this.lastAddedCell      = null;
    this.done               = false;
    this.currentRegionIndex = 0;    // incremented each time a new disconnected region starts
    this._stepCount         = 0;
    this._startTime         = null;
  }

  init() {
    throw new Error(`${this.constructor.name}.init() is not implemented.`);
  }

  step() {
    throw new Error(`${this.constructor.name}.step() is not implemented.`);
  }

  isDone() {
    return this.done;
  }

  // Runs all remaining steps in one call.
  // pickIndex signature: (candidateArray) → integer index
  complete(pickIndex = (arr) => Math.floor(Math.random() * arr.length)) {
    while (!this.done) this.step(pickIndex);
  }

  // Cells added per second since init() was called.
  get cellsPerSecond() {
    if (!this._startTime || this._stepCount === 0) return 0;
    const elapsed = (Date.now() - this._startTime) / 1000;
    return elapsed > 0.01 ? Math.round(this._stepCount / elapsed) : 0;
  }
}

// ─────────────────────────────────────────────
// PrimsGenerator  extends MazeGenerator
// Randomised Prim's algorithm.
// Grows the maze by always picking from the frontier
// (a pool of passages that connect IN cells to OUT cells).
// Supports disconnected regions: when one region's frontier
// empties, it seeds the next unvisited OUT cell automatically.
//
// frontier entries = FrontierEntry objects { inCell, outCell }
// ─────────────────────────────────────────────

class PrimsGenerator extends MazeGenerator {
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
    this._addCell(startCell);
  }

  step(pickIndex = (arr) => Math.floor(Math.random() * arr.length)) {
    if (this.done) return;

    while (this.frontier.length > 0) {
      const i     = pickIndex(this.frontier);
      const entry = this._removeAt(i);

      if (entry.outCell.isIn()) continue; // already claimed by another passage

      this.grid.removeWallBetween(entry.inCell, entry.outCell);
      this._addCell(entry.outCell);
      return;
    }

    // Current region exhausted — start the next disconnected region.
    const next = this.grid.findFirstOutCell();
    if (next) {
      this.currentRegionIndex++;
      this._addCell(next);
    } else {
      this.done = true;
    }
  }

  _addCell(cell) {
    cell.markIn();
    cell.regionIndex = this.currentRegionIndex;
    this.lastAddedCell = cell;
    if (!this._startTime) this._startTime = Date.now();
    this._stepCount++;

    for (const { cell: neighbor } of this.grid.getNeighbors(cell.col, cell.row)) {
      if (neighbor.isOut()) {
        this.frontier.push(new FrontierEntry(cell, neighbor));
      }
    }
  }

  // O(1) swap-removal — order is irrelevant since we pick randomly anyway.
  _removeAt(index) {
    const entry = this.frontier[index];
    this.frontier[index] = this.frontier[this.frontier.length - 1];
    this.frontier.length--;
    return entry;
  }
}

// ─────────────────────────────────────────────
// DFSGenerator  extends MazeGenerator
// Recursive Backtracker (depth-first search).
// Carves passages by always going deeper before backtracking,
// producing long winding corridors with few dead ends — a
// visually very different texture from Prim's.
//
// frontier = the current DFS stack (plain Cell objects).
// Rendering shows the live path from the start to the cursor,
// contracting as backtracking shrinks the stack.
// ─────────────────────────────────────────────

class DFSGenerator extends MazeGenerator {
  constructor(grid) {
    super(grid);
  }

  init() {
    this.frontier           = [];   // doubles as the DFS stack
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
  // For Perlin noise bias, pass noisePicker from sketch.js;
  // the items passed are { direction, cell } objects from getNeighbors().
  step(pickIndex = (arr) => Math.floor(Math.random() * arr.length)) {
    if (this.done) return;

    if (this.frontier.length === 0) {
      // This region is fully explored — find the next disconnected region.
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
      // Carve a passage to the chosen unvisited neighbor.
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

// ─────────────────────────────────────────────
// MazeSolver  (abstract base class)
// Defines the interface every pathfinding solver must fulfill.
//
// Subclasses must implement:
//   init(startCell, endCell)  — reset and prepare
//   step()                    — advance one search step
//
// Public state for rendering:
//   visitedSet   — Set<Cell> of all explored cells (for BFS overlay)
//   path         — Cell[] solution route (empty until found)
//   pathIndexMap — Map<Cell, index> for O(1) path membership checks
//   found        — true when the path exists
//   done         — true when search is finished (found or exhausted)
//   lastVisited  — most recently dequeued cell (for "frontier dot")
// ─────────────────────────────────────────────

class MazeSolver {
  constructor(grid) {
    if (!(grid instanceof MazeGrid)) {
      throw new TypeError("MazeSolver requires a MazeGrid.");
    }
    this.grid         = grid;
    this.startCell    = null;
    this.endCell      = null;
    this.done         = false;
    this.found        = false;
    this.path         = [];
    this.pathIndexMap = new Map(); // Cell → index in path, for O(1) lookups
    this.visitedSet   = new Set();
    this.lastVisited  = null;
  }

  init()     { throw new Error(`${this.constructor.name}.init() is not implemented.`); }
  step()     { throw new Error(`${this.constructor.name}.step() is not implemented.`); }
  isDone()   { return this.done; }
  complete() { while (!this.done) this.step(); }
}

// ─────────────────────────────────────────────
// BFSSolver  extends MazeSolver
// Breadth-first search pathfinder.
// Guarantees the shortest path in an unweighted maze.
//
// To swap in A* or Dijkstra, create a new class extending
// MazeSolver and implement init() + step(). No other file
// needs to change — sketch.js only depends on the base interface.
// ─────────────────────────────────────────────

class BFSSolver extends MazeSolver {
  constructor(grid) {
    super(grid);
    this._queue   = [];
    this._parents = new Map(); // Cell → parent Cell (or null for startCell)
  }

  init(startCell, endCell) {
    if (!(startCell instanceof Cell) || !(endCell instanceof Cell)) {
      throw new TypeError("BFSSolver.init() requires two Cell instances.");
    }

    this.startCell    = startCell;
    this.endCell      = endCell;
    this.done         = false;
    this.found        = false;
    this.path         = [];
    this.pathIndexMap = new Map();
    this.visitedSet   = new Set([startCell]);
    this.lastVisited  = null;
    this._queue       = [startCell];
    this._parents     = new Map([[startCell, null]]);
  }

  step() {
    if (this.done) return;
    if (this._queue.length === 0) { this.done = true; return; }

    const current    = this._queue.shift();
    this.lastVisited = current;

    if (current === this.endCell) {
      this.path         = this._reconstructPath();
      this.pathIndexMap = new Map(this.path.map((c, i) => [c, i]));
      this.found        = true;
      this.done         = true;
      return;
    }

    for (const neighbor of this.grid.getPassableNeighbors(current.col, current.row)) {
      if (!this._parents.has(neighbor)) {
        this._parents.set(neighbor, current);
        this.visitedSet.add(neighbor);
        this._queue.push(neighbor);
      }
    }
  }

  _reconstructPath() {
    const path = [];
    let cell = this.endCell;
    while (cell !== null) {
      path.unshift(cell);
      cell = this._parents.get(cell);
    }
    return path;
  }
}
