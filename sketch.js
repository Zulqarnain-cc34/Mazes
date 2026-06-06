const COLS      = 25;
const ROWS      = 25;
const CELL_SIZE = 24;

// Scale controls how zoomed-in the Perlin noise field is.
// Lower = broader smooth regions. Higher = tighter variation.
const NOISE_SCALE = 0.18;

// Colors
const COLOR_OUT          = "#1a1a2e";  // unvisited cell fill
const COLOR_IN           = "#eaeaea";  // visited cell fill
const COLOR_LAST_ADDED   = "#f6d365";  // the most recently added cell
const COLOR_FRONTIER     = "#4e9af1";  // cells currently in the frontier (out-cells)
const COLOR_WALL         = "#1a1a2e";  // wall lines
const COLOR_BG           = "#fdfdfd";

let maze;
let frontierSet;          // Set of outCell references for fast lookup during render
let useNoise      = false; // toggle between pure random and Perlin noise picker
let distanceMap   = null;  // computed once when generation finishes
let showDistances = false; // toggle heatmap display with D key
let instantMode   = false; // when true, maze generates instantly on init

// Heatmap gradient: near the start → far from start
const COLOR_NEAR = "#1a1a7e";  // deep blue
const COLOR_FAR  = "#f6d365";  // warm yellow

function setup() {
  createCanvas(COLS * CELL_SIZE, ROWS * CELL_SIZE + 26);
  strokeCap(SQUARE);
  initMaze();
}

function draw() {
  background(COLOR_BG);

  if (!maze.isDone()) {
    maze.step(useNoise ? noisePicker : randomPicker);
    // Rebuild the frontier set after each step so the renderer
    // always knows which cells are current frontier candidates.
    frontierSet = buildFrontierSet(maze.frontier);
  } else if (!distanceMap) {
    // Maze just finished — compute the distance map once from the top-left corner.
    distanceMap = new DistanceMap(maze.grid, new BFSTraverser());
    distanceMap.compute(0, 0);
  }

  drawGrid();
  drawMode();
}

// ─── Initialization ───────────────────────────────────────────

function initMaze() {
  maze          = new PrimsMaze(COLS, ROWS);
  frontierSet   = new Set();
  distanceMap   = null;
  showDistances = false;
  maze.init();

  // In instant mode, complete the full generation before the first frame draws.
  if (instantMode) {
    maze.complete(useNoise ? noisePicker : randomPicker);
  }
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
  // Distance heatmap takes over the fill for all in-cells when active.
  if (showDistances && distanceMap && cell.isIn()) {
    const t    = distanceMap.getNormalized(cell);
    const near = color(COLOR_NEAR);
    const far  = color(COLOR_FAR);
    return lerpColor(near, far, t);
  }

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

// ─── Pickers ──────────────────────────────────────────────────

// Default picker: pure random selection.
function randomPicker(frontier) {
  return Math.floor(Math.random() * frontier.length);
}

// Perlin noise picker: scores every frontier entry by the noise value
// at the outCell's grid position and returns the index of the highest score.
// This biases the maze to grow toward high-noise regions first,
// producing flowing organic corridors instead of uniformly random branching.
function noisePicker(frontier) {
  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < frontier.length; i++) {
    const cell  = frontier[i].outCell;
    const score = noise(cell.col * NOISE_SCALE, cell.row * NOISE_SCALE);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
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

// ─── HUD ──────────────────────────────────────────────────────

function drawMode() {
  noStroke();
  fill(useNoise ? "#4e9af1" : "#888");
  textSize(13);
  textAlign(LEFT, BOTTOM);
  textFont("monospace");
  text(
    `R=restart  N=noise  I=instant${instantMode ? "[ON]" : ""}  D=heatmap${showDistances ? "[ON]" : ""}`,
    10,
    height - 8
  );
}

// ─── Interaction ──────────────────────────────────────────────

function keyPressed() {
  if (key === "r" || key === "R") {
    initMaze();
  }

  // Press N to toggle between pure random and Perlin noise picker.
  // Restarts the maze so you immediately see the difference.
  if (key === "n" || key === "N") {
    useNoise = !useNoise;
    initMaze();
  }

  // Press I to toggle instant mode, then restart so it takes effect immediately.
  if (key === "i" || key === "I") {
    instantMode = !instantMode;
    initMaze();
  }

  // Press D to toggle the distance heatmap.
  // Only works after the maze has finished generating.
  if (key === "d" || key === "D") {
    if (distanceMap) {
      showDistances = !showDistances;
    }
  }
}
