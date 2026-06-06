const COLS      = 25;
const ROWS      = 25;
const CELL_SIZE = 24;

// Colors
const COLOR_OUT          = "#1a1a2e";  // unvisited cell fill
const COLOR_IN           = "#eaeaea";  // visited cell fill
const COLOR_LAST_ADDED   = "#f6d365";  // the most recently added cell
const COLOR_FRONTIER     = "#4e9af1";  // cells currently in the frontier (out-cells)
const COLOR_WALL         = "#1a1a2e";  // wall lines
const COLOR_BG           = "#fdfdfd";

let maze;
let frontierSet; // Set of outCell references for fast lookup during render

function setup() {
  createCanvas(COLS * CELL_SIZE, ROWS * CELL_SIZE);
  strokeCap(SQUARE);
  initMaze();
}

function draw() {
  background(COLOR_BG);

  if (!maze.isDone()) {
    maze.step();
    // Rebuild the frontier set after each step so the renderer
    // always knows which cells are current frontier candidates.
    frontierSet = buildFrontierSet(maze.frontier);
  }

  drawGrid();
}

// ─── Initialization ───────────────────────────────────────────

function initMaze() {
  maze        = new PrimsMaze(COLS, ROWS);
  frontierSet = new Set();
  maze.init();
}

// ─── Rendering ────────────────────────────────────────────────

function drawGrid() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = maze.grid.getCell(col, row);
      drawCell(cell);
    }
  }
}

function drawCell(cell) {
  const x = cell.col * CELL_SIZE;
  const y = cell.row * CELL_SIZE;

  // Fill the cell based on its current state.
  noStroke();
  fill(getCellColor(cell));
  rect(x, y, CELL_SIZE, CELL_SIZE);

  // Draw only the walls that are still standing.
  stroke(COLOR_WALL);
  strokeWeight(2);

  if (cell.walls.north) {
    line(x,             y,             x + CELL_SIZE, y            );
  }

  if (cell.walls.south) {
    line(x,             y + CELL_SIZE, x + CELL_SIZE, y + CELL_SIZE);
  }

  if (cell.walls.east) {
    line(x + CELL_SIZE, y,             x + CELL_SIZE, y + CELL_SIZE);
  }

  if (cell.walls.west) {
    line(x,             y,             x,             y + CELL_SIZE);
  }
}

function getCellColor(cell) {
  if (cell === maze.lastAddedCell) {
    return COLOR_LAST_ADDED;
  }

  if (cell.isIn()) {
    return COLOR_IN;
  }

  if (frontierSet.has(cell)) {
    return COLOR_FRONTIER;
  }

  return COLOR_OUT;
}

// ─── Frontier set ─────────────────────────────────────────────

// Builds a Set of all outCell references currently in the frontier.
// Used by the renderer to highlight frontier cells without looping
// over the full frontier array for every single cell.
function buildFrontierSet(frontier) {
  const set = new Set();

  for (const entry of frontier) {
    set.add(entry.outCell);
  }

  return set;
}

// ─── Interaction ──────────────────────────────────────────────

// Press R to restart the maze from scratch.
function keyPressed() {
  if (key === "r" || key === "R") {
    initMaze();
  }
}
