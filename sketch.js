const CANVAS_SIZE = 600;  // fixed canvas width and height in pixels

let COLS      = 25;
let ROWS      = 25;
let CELL_SIZE = Math.floor(CANVAS_SIZE / COLS);

const NOISE_SCALE = 0.18;

// Colors
const COLOR_OUT        = "#1a1a2e";
const COLOR_IN         = "#eaeaea";
const COLOR_LAST_ADDED = "#f6d365";
const COLOR_FRONTIER   = "#4e9af1";
const COLOR_WALL       = "#1a1a2e";
const COLOR_EXCLUDED   = "#fdfdfd";
const COLOR_BG         = "#fdfdfd";
const COLOR_NEAR       = "#1a1a7e";
const COLOR_FAR        = "#f6d365";

let customMask    = null; // boolean mask built from the uploaded image
let loadedImage   = null; // the raw p5 image — kept so the threshold slider can rebuild without re-uploading
let maskThreshold = 128;  // 0–255: pixels darker than this become maze cells

// Preset list — each entry has a name and a factory that builds the mask.
// "Custom Image" is always last and uses the uploaded image mask.
const PRESETS = [
  { name: "Full Grid",    build: () => MaskBuilder.fullGrid(COLS, ROWS)  },
  { name: "Cross",        build: () => MaskBuilder.cross(COLS, ROWS)      },
  { name: "Two Boxes",    build: () => MaskBuilder.twoBoxes(COLS, ROWS)   },
  { name: "Ring",         build: () => MaskBuilder.ring(COLS, ROWS)       },
  { name: "Diamond",      build: () => MaskBuilder.diamond(COLS, ROWS)    },
  { name: "Custom Image", build: () => customMask || MaskBuilder.fullGrid(COLS, ROWS) },
];

let maze;
let frontierSet;
let distanceMap   = null;
let showDistances = false;
let useNoise      = false;
let instantMode   = false;
let presetIndex   = 0;

// R hold-to-cycle state.
// After holding R for HOLD_DELAY frames, a new complete maze is generated
// every HOLD_INTERVAL frames until R is released.
const HOLD_DELAY    = 18;  // frames before rapid mode starts (~0.3s at 60fps)
const HOLD_INTERVAL = 7;   // frames between each rapid restart
let   rHoldFrames   = 0;

function setup() {
  createCanvas(COLS * CELL_SIZE, ROWS * CELL_SIZE + 36);
  strokeCap(SQUARE);
  initImageInput();
  initResolutionSlider();
  initMaze();
}

function draw() {
  background(COLOR_BG);

  if (!maze.isDone()) {
    maze.step(useNoise ? noisePicker : randomPicker);
    frontierSet = buildFrontierSet(maze.frontier);
  } else if (!distanceMap) {
    // Maze finished — BFS from the first IN cell (cell 0,0 may be excluded).
    const startCell = maze.grid.findFirstInCell();
    if (startCell) {
      distanceMap = new DistanceMap(maze.grid, new BFSTraverser());
      distanceMap.compute(startCell.col, startCell.row);
    }
  }

  drawGrid();
  drawHUD();

  // R key — single press restarts with animation, hold cycles rapid complete mazes.
  // Handled entirely in draw() so browser key-repeat does not interfere.
  if (keyIsDown(82)) {
    rHoldFrames++;

    if (rHoldFrames === 1) {
      // Very first frame the key goes down: normal animated restart.
      initMaze();
    } else if (rHoldFrames > HOLD_DELAY && (rHoldFrames - HOLD_DELAY) % HOLD_INTERVAL === 0) {
      // After hold threshold: rapid-cycle through complete mazes.
      rapidRestart();
    }
  } else {
    rHoldFrames = 0;
  }
}

// Instantly builds a complete maze and recomputes the distance map if active.
// Called repeatedly while R is held to rapidly cycle through mazes.
function rapidRestart() {
  initMaze();
  maze.complete(useNoise ? noisePicker : randomPicker);

  if (showDistances) {
    const startCell = maze.grid.findFirstInCell();
    if (startCell) {
      distanceMap = new DistanceMap(maze.grid, new BFSTraverser());
      distanceMap.compute(startCell.col, startCell.row);
    }
  }
}

// ─── Resolution slider ────────────────────────────────────────

function initResolutionSlider() {
  const slider = document.getElementById("resolution");
  const label  = document.getElementById("resolutionValue");

  slider.addEventListener("input", (e) => {
    COLS      = Number(e.target.value);
    ROWS      = COLS;
    CELL_SIZE = Math.max(1, Math.floor(CANVAS_SIZE / COLS));
    label.textContent = `${COLS}×${ROWS}`;

    // Resize canvas to exact grid pixel size — no fractional remainder.
    resizeCanvas(COLS * CELL_SIZE, ROWS * CELL_SIZE + 36);

    // Rebuild the image mask at the new resolution so the full image
    // is always re-sampled to fit the new grid exactly.
    if (loadedImage) {
      customMask = MaskBuilder.fromImage(loadedImage, COLS, ROWS, maskThreshold);
    }

    initMaze();
  });
}

// ─── Image input ──────────────────────────────────────────────

function initImageInput() {
  const fileInput      = document.getElementById("imgInput");
  const thresholdSlider = document.getElementById("threshold");
  const thresholdLabel  = document.getElementById("thresholdValue");

  // File upload: load image, build mask, switch to Custom Image preset.
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      loadImage(event.target.result, (img) => {
        loadedImage   = img;

        // Compute the best threshold for this image automatically.
        maskThreshold = MaskBuilder.otsuThreshold(img);

        // Sync the slider and label to the computed value.
        thresholdSlider.value          = maskThreshold;
        thresholdLabel.textContent     = maskThreshold;

        customMask    = MaskBuilder.fromImage(loadedImage, COLS, ROWS, maskThreshold);
        presetIndex   = PRESETS.length - 1;
        initMaze();
      });
    };

    reader.readAsDataURL(file);
  });

  // Threshold slider: rebuild mask from the stored image and restart.
  thresholdSlider.addEventListener("input", (e) => {
    maskThreshold       = Number(e.target.value);
    thresholdLabel.textContent = maskThreshold;

    if (loadedImage) {
      customMask  = MaskBuilder.fromImage(loadedImage, COLS, ROWS, maskThreshold);
      presetIndex = PRESETS.length - 1;
      initMaze();
    }
  });
}

// ─── Initialization ───────────────────────────────────────────

function initMaze() {
  const grid = new MazeGrid(COLS, ROWS);
  const mask = PRESETS[presetIndex].build();
  grid.applyMask(mask);

  maze        = new MultiRegionPrims(grid);
  frontierSet = new Set();
  distanceMap = null;
  // showDistances is intentionally not reset here so the heatmap
  // stays on across restarts if the user had it enabled.

  maze.init();

  if (instantMode) {
    maze.complete(useNoise ? noisePicker : randomPicker);
  }
}

// ─── Rendering ────────────────────────────────────────────────

function drawGrid() {
  for (let row = 0; row < maze.grid.rows; row++) {
    for (let col = 0; col < maze.grid.cols; col++) {
      drawCell(maze.grid.getCell(col, row));
    }
  }
}

function drawCell(cell) {
  const x = cell.col * CELL_SIZE;
  const y = cell.row * CELL_SIZE;

  // Excluded cells are invisible — just fill with background and skip walls.
  if (cell.isExcluded()) {
    noStroke();
    fill(COLOR_EXCLUDED);
    rect(x, y, CELL_SIZE, CELL_SIZE);
    return;
  }

  noStroke();
  fill(getCellColor(cell));
  rect(x, y, CELL_SIZE, CELL_SIZE);

  stroke(COLOR_WALL);
  strokeWeight(2);

  if (cell.walls.north) line(x,             y,             x + CELL_SIZE, y            );
  if (cell.walls.south) line(x,             y + CELL_SIZE, x + CELL_SIZE, y + CELL_SIZE);
  if (cell.walls.east)  line(x + CELL_SIZE, y,             x + CELL_SIZE, y + CELL_SIZE);
  if (cell.walls.west)  line(x,             y,             x,             y + CELL_SIZE);
}

function getCellColor(cell) {
  if (showDistances && distanceMap && cell.isIn()) {
    return lerpColor(color(COLOR_NEAR), color(COLOR_FAR), distanceMap.getNormalized(cell));
  }

  if (cell === maze.lastAddedCell) return COLOR_LAST_ADDED;
  if (cell.isIn())                 return COLOR_IN;
  if (frontierSet.has(cell))       return COLOR_FRONTIER;

  return COLOR_OUT;
}

// ─── Pickers ──────────────────────────────────────────────────

function randomPicker(frontier) {
  return Math.floor(Math.random() * frontier.length);
}

function noisePicker(frontier) {
  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < frontier.length; i++) {
    const cell  = frontier[i].outCell;
    const score = noise(cell.col * NOISE_SCALE, cell.row * NOISE_SCALE);
    if (score > bestScore) { bestScore = score; bestIndex = i; }
  }

  return bestIndex;
}

// ─── Frontier set ─────────────────────────────────────────────

function buildFrontierSet(frontier) {
  const set = new Set();
  for (const entry of frontier) set.add(entry.outCell);
  return set;
}

// ─── HUD ──────────────────────────────────────────────────────

function drawHUD() {
  const shape   = PRESETS[presetIndex].name;
  const status  = maze.isDone() ? "done" : "generating";

  noStroke();
  fill("#555");
  textSize(12);
  textAlign(LEFT, BOTTOM);
  textFont("monospace");
  text(
    `Shape: ${shape} [${status}]  R=restart  N=noise  I=instant  D=heatmap  ←/→=shape`,
    8,
    height - 18
  );

  fill(useNoise ? "#4e9af1" : instantMode ? "#f6d365" : showDistances ? "#a0e0a0" : "#aaa");
  text(
    `${useNoise ? "NOISE" : "RANDOM"} | ${instantMode ? "INSTANT" : "ANIMATED"} | heatmap:${showDistances ? "ON" : "off"}`,
    8,
    height - 5
  );
}

// ─── Interaction ──────────────────────────────────────────────

function keyPressed() {
  if (key === "n" || key === "N") {
    useNoise = !useNoise;
    initMaze();
  }

  if (key === "i" || key === "I") {
    instantMode = !instantMode;
    initMaze();
  }

  if (key === "d" || key === "D") {
    if (distanceMap) showDistances = !showDistances;
  }

  // Arrow keys cycle through preset shapes and restart immediately.
  if (keyCode === RIGHT_ARROW) {
    presetIndex = (presetIndex + 1) % PRESETS.length;
    initMaze();
  }

  if (keyCode === LEFT_ARROW) {
    presetIndex = (presetIndex - 1 + PRESETS.length) % PRESETS.length;
    initMaze();
  }
}
