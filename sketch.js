// ─── Canvas / Grid Config ─────────────────────────────────
const CANVAS_SIZE = 600;   // logical canvas width/height (cells fill this)
const NOISE_SCALE = 0.18;
const HUD_HEIGHT  = 36;    // pixels reserved below the maze for HUD text

let COLS      = 25;
let ROWS      = 25;
let CELL_SIZE = Math.floor(CANVAS_SIZE / COLS);

// ─── Colors ───────────────────────────────────────────────
const COLOR_OUT        = "#1a1a2e";
const COLOR_IN         = "#eaeaea";
const COLOR_LAST_ADDED = "#f6d365";
const COLOR_FRONTIER   = "#4e9af1";
const COLOR_WALL       = "#1a1a2e";
const COLOR_EXCLUDED   = "#fdfdfd";
const COLOR_BG         = "#fdfdfd";
const COLOR_NEAR       = "#1a1a7e";
const COLOR_FAR        = "#f6d365";
const COLOR_PATH       = "#2ecc71";   // animated solution path
const COLOR_VISITED    = "#c8e6ff";   // BFS solver explored cells
const COLOR_START      = "#e74c3c";   // start pin
const COLOR_END        = "#27ae60";   // end pin
const COLOR_PLAYER     = "#e74c3c";   // player dot in PLAYING mode
const COLOR_FOG        = "#2c2c2c";   // fog-of-war darkness

// Each new disconnected region gets the next color in this palette.
// To add more region colors, just append more hex strings here.
const REGION_PALETTE = [
  "#4e9af1", "#ff8b94", "#a8e6cf", "#ffd3b6",
  "#c7ceea", "#b5ead7", "#ffeaa7", "#f0e6ff",
  "#ffe0e0", "#e0ffe0", "#e0e0ff", "#fff0e0",
];

// ─── App Modes ────────────────────────────────────────────
// GENERATING — maze is being built (step-by-step or instant)
// SOLVING    — BFSSolver is running, then animating the path
// PLAYING    — arrow-key player explores the finished maze
const MODES = Object.freeze({
  GENERATING: "generating",
  SOLVING:    "solving",
  PLAYING:    "playing",
});

// ─── Image Mask State ─────────────────────────────────────
let customMask    = null;   // boolean[row][col] from the uploaded image
let loadedImage   = null;   // raw p5.Image — kept for slider rebuilds
let maskThreshold = 128;    // 0–255 luminance cutoff

// ─── Preset Shapes ────────────────────────────────────────
// Add a new preset by adding an entry here — no other change needed.
const PRESETS = [
  { name: "Full Grid",    build: () => MaskBuilder.fullGrid(COLS, ROWS)  },
  { name: "Cross",        build: () => MaskBuilder.cross(COLS, ROWS)      },
  { name: "Two Boxes",    build: () => MaskBuilder.twoBoxes(COLS, ROWS)   },
  { name: "Ring",         build: () => MaskBuilder.ring(COLS, ROWS)       },
  { name: "Diamond",      build: () => MaskBuilder.diamond(COLS, ROWS)    },
  { name: "Custom Image", build: () => customMask || MaskBuilder.fullGrid(COLS, ROWS) },
];

// ─── Application State ────────────────────────────────────
let mode          = MODES.GENERATING;
let generatorType = "prims";    // "prims" → PrimsGenerator | "dfs" → DFSGenerator
let presetIndex   = 0;

// Feature toggles (persist across restarts)
let useNoise      = false;
let instantMode   = false;
let showDistances = false;
let showRegions   = false;
let showFog       = false;

// Core objects
let maze        = null;
let frontierSet = new Set();
let distanceMap = null;    // the largest region's DM — signals "computation done" and holds start/end defaults
let regionDMs   = new Map(); // regionIndex → DistanceMap, one per disconnected region (for heatmap per-region)

// Solver state
let solver     = null;
let startCell  = null;
let endCell    = null;
let pathStep   = 0;       // how many path cells have been drawn so far
let clickPhase = 0;       // 0 = next click sets start, 1 = next click sets end

// Player state (PLAYING mode)
let playerCell  = null;
let revealedSet = new Set();

// Hold-R rapid restart
const HOLD_DELAY    = 18;
const HOLD_INTERVAL = 7;
let   rHoldFrames   = 0;

// Live speed counter — updated every 20 frames to avoid flicker
let displayedCPS  = 0;
let cpsFrameCount = 0;

// ─── p5 Lifecycle ─────────────────────────────────────────

function setup() {
  createCanvas(COLS * CELL_SIZE, ROWS * CELL_SIZE + HUD_HEIGHT);
  strokeCap(SQUARE);
  initImageInput();
  initResolutionSlider();
  initAlgorithmSelector();
  initMaze();
}

function draw() {
  background(COLOR_BG);

  // ── Advance generation one step per frame ──
  if (mode === MODES.GENERATING) {
    if (!maze.isDone()) {
      maze.step(useNoise ? noisePicker : randomPicker);
      frontierSet = buildActiveSet(maze.frontier);
      cpsFrameCount++;
      if (cpsFrameCount % 20 === 0) displayedCPS = maze.cellsPerSecond;
    } else if (!distanceMap) {
      computeDistanceMaps();
    }
  }

  // ── Advance solver a few steps per frame ──
  if (mode === MODES.SOLVING) {
    if (solver && !solver.isDone()) {
      // Multiple steps per frame keeps the BFS animation snappy
      for (let i = 0; i < 4 && !solver.isDone(); i++) solver.step();
    } else if (solver && solver.found && pathStep < solver.path.length) {
      // Animate the solution path drawing itself
      pathStep = Math.min(pathStep + 2, solver.path.length);
    }
  }

  drawGrid();
  drawHUD();

  // ── R key: tap to restart animated, hold to rapid-cycle completed mazes ──
  if (keyIsDown(82)) {
    rHoldFrames++;
    if (rHoldFrames === 1) {
      initMaze();
    } else if (rHoldFrames > HOLD_DELAY && (rHoldFrames - HOLD_DELAY) % HOLD_INTERVAL === 0) {
      rapidRestart();
    }
  } else {
    rHoldFrames = 0;
  }
}

// ─── Maze Initialization ──────────────────────────────────

function initMaze() {
  const grid = new MazeGrid(COLS, ROWS);
  grid.applyMask(PRESETS[presetIndex].build());

  maze = generatorType === "dfs"
    ? new DFSGenerator(grid)
    : new PrimsGenerator(grid);

  frontierSet   = new Set();
  distanceMap   = null;
  regionDMs     = new Map();
  solver        = null;
  pathStep      = 0;
  startCell     = null;
  endCell       = null;
  clickPhase    = 0;
  playerCell    = null;
  revealedSet   = new Set();
  mode          = MODES.GENERATING;
  cpsFrameCount = 0;
  displayedCPS  = 0;
  // showDistances / showRegions / showFog intentionally NOT reset here —
  // they persist across restarts so toggled overlays stay on.

  maze.init();

  if (instantMode) {
    maze.complete(useNoise ? noisePicker : randomPicker);
    computeDistanceMaps();
  }
}

// Instantly finishes a maze and distance map. Called while R is held.
function rapidRestart() {
  const grid = new MazeGrid(COLS, ROWS);
  grid.applyMask(PRESETS[presetIndex].build());

  maze = generatorType === "dfs"
    ? new DFSGenerator(grid)
    : new PrimsGenerator(grid);

  frontierSet  = new Set();
  solver       = null;
  pathStep     = 0;
  startCell    = null;
  endCell      = null;
  playerCell   = null;
  revealedSet  = new Set();
  mode         = MODES.GENERATING;

  maze.init();
  maze.complete(useNoise ? noisePicker : randomPicker);
  computeDistanceMaps();
}

// ─── Distance Map ─────────────────────────────────────────

// Runs the two-BFS trick for every disconnected region independently.
// Each region gets its own DistanceMap stored in regionDMs, so the heatmap
// shows a full blue→yellow gradient inside every shape — not just the first region.
//
// The largest region's map is kept as `distanceMap` so the rest of the code
// can still use a single sentinel to know whether computation has finished,
// and to set the default start/end for the solver.
function computeDistanceMaps() {
  regionDMs   = new Map();
  distanceMap = null;

  // Collect one seed cell per region (we only need to find the first cell in each).
  const seeds = new Map(); // regionIndex → Cell
  for (let row = 0; row < maze.grid.rows; row++) {
    for (let col = 0; col < maze.grid.cols; col++) {
      const cell = maze.grid.getCell(col, row);
      if (cell.isIn() && cell.regionIndex >= 0 && !seeds.has(cell.regionIndex)) {
        seeds.set(cell.regionIndex, cell);
      }
    }
  }

  let bestMaxDist = -1;
  let bestF1      = null;
  let bestF2      = null;

  for (const [rIdx, seed] of seeds) {
    // BFS from the seed → find the farthest endpoint (f1).
    const dm1 = new DistanceMap(maze.grid, new BFSTraverser());
    dm1.compute(seed.col, seed.row);
    const f1 = getFarthestCell(dm1);
    if (!f1) continue;

    // BFS from f1 → true diameter endpoint (f2).  This is the canonical heatmap for this region.
    const dm = new DistanceMap(maze.grid, new BFSTraverser());
    dm.compute(f1.col, f1.row);
    regionDMs.set(rIdx, dm);

    // Track the largest region — its endpoints become the default solver start/end.
    if (dm.maxDistance > bestMaxDist) {
      bestMaxDist = dm.maxDistance;
      bestF1      = f1;
      bestF2      = getFarthestCell(dm);
      distanceMap = dm;
    }
  }

  // Fallback: if every region has only 1 cell, distanceMap is still null — set it anyway.
  if (!distanceMap && regionDMs.size > 0) {
    distanceMap = regionDMs.values().next().value;
  }

  if (!startCell && bestF1)  startCell = bestF1;
  if (!endCell   && bestF2)  endCell   = bestF2;
}

function getFarthestCell(dm) {
  let maxDist = -1, farthest = null;
  for (const [cell, dist] of dm.distances) {
    if (dist > maxDist) { maxDist = dist; farthest = cell; }
  }
  return farthest;
}

// ─── Solver ───────────────────────────────────────────────

function startSolving() {
  if (!maze.isDone() || !startCell || !endCell) return;
  if (startCell === endCell || !startCell.isIn() || !endCell.isIn()) return;

  solver   = new BFSSolver(maze.grid);
  solver.init(startCell, endCell);
  pathStep = 0;
  mode     = MODES.SOLVING;
}

// ─── Player ───────────────────────────────────────────────

function startPlaying() {
  if (!maze.isDone()) return;
  playerCell  = startCell || maze.grid.findFirstInCell();
  revealedSet = new Set();
  if (playerCell) revealAround(playerCell);
  mode = MODES.PLAYING;
}

// Reveals the cell itself plus every passable neighbor (one step of visibility).
function revealAround(cell) {
  revealedSet.add(cell);
  for (const n of maze.grid.getPassableNeighbors(cell.col, cell.row)) {
    revealedSet.add(n);
  }
}

// ─── Rendering ────────────────────────────────────────────

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

  // Excluded cells are invisible — part of the background shape.
  if (cell.isExcluded()) {
    noStroke(); fill(COLOR_EXCLUDED);
    rect(x, y, CELL_SIZE, CELL_SIZE);
    return;
  }

  // Fog of war: hide cells the player has not yet reached.
  if (mode === MODES.PLAYING && showFog && !revealedSet.has(cell)) {
    noStroke(); fill(COLOR_FOG);
    rect(x, y, CELL_SIZE, CELL_SIZE);
    return;
  }

  noStroke();
  fill(getCellColor(cell));
  rect(x, y, CELL_SIZE, CELL_SIZE);

  // Walls — thinner at high resolutions so they don't dominate small cells.
  stroke(COLOR_WALL);
  strokeWeight(CELL_SIZE >= 8 ? 1.5 : 1);

  if (cell.walls.north) line(x,             y,             x + CELL_SIZE, y            );
  if (cell.walls.south) line(x,             y + CELL_SIZE, x + CELL_SIZE, y + CELL_SIZE);
  if (cell.walls.east)  line(x + CELL_SIZE, y,             x + CELL_SIZE, y + CELL_SIZE);
  if (cell.walls.west)  line(x,             y,             x,             y + CELL_SIZE);
}

// Priority order (highest wins): player → start/end → path → visited →
// heatmap → regions → generation state
function getCellColor(cell) {
  // Player position (PLAYING mode)
  if (mode === MODES.PLAYING && cell === playerCell) return COLOR_PLAYER;

  // Start / end markers (visible in all modes)
  if (cell === startCell) return COLOR_START;
  if (cell === endCell)   return COLOR_END;

  // Animated solution path — revealed incrementally via pathStep
  if (solver && solver.found && pathStep > 0) {
    const idx = solver.pathIndexMap.get(cell);
    if (idx !== undefined && idx < pathStep) return COLOR_PATH;
  }

  // BFS solver exploration overlay (only while searching, before path is found)
  if (mode === MODES.SOLVING && solver && !solver.found && solver.visitedSet.has(cell)) {
    return COLOR_VISITED;
  }

  // Distance heatmap (toggled with D) — uses the per-region map so every
  // disconnected shape gets its own full blue→yellow gradient.
  if (showDistances && cell.isIn() && cell.regionIndex >= 0) {
    const dm = regionDMs.get(cell.regionIndex);
    if (dm && dm.distances.has(cell)) {
      return lerpColor(color(COLOR_NEAR), color(COLOR_FAR), dm.getNormalized(cell));
    }
  }

  // Multi-region color coding (toggled with G)
  if (showRegions && cell.isIn() && cell.regionIndex >= 0) {
    return REGION_PALETTE[cell.regionIndex % REGION_PALETTE.length];
  }

  // Default generation-phase colors
  if (cell === maze.lastAddedCell) return COLOR_LAST_ADDED;
  if (cell.isIn())                 return COLOR_IN;
  if (frontierSet.has(cell))       return COLOR_FRONTIER;
  return COLOR_OUT;
}

// ─── Pickers ──────────────────────────────────────────────
// Both functions share the same signature: (candidateArray) → index.
// This allows them to be passed interchangeably to any generator.

function randomPicker(items) {
  return Math.floor(Math.random() * items.length);
}

// Scores each candidate by its Perlin noise value and picks the highest.
// Works with FrontierEntry (.outCell), {direction, cell} (.cell), or plain Cell.
function noisePicker(items) {
  let bestIndex = 0, bestScore = -1;
  for (let i = 0; i < items.length; i++) {
    const c = items[i].outCell || items[i].cell || items[i];
    const s = noise(c.col * NOISE_SCALE, c.row * NOISE_SCALE);
    if (s > bestScore) { bestScore = s; bestIndex = i; }
  }
  return bestIndex;
}

// ─── Active Set ───────────────────────────────────────────
// Extracts the "pending" cells into a Set for O(1) frontier highlight lookup.
// PrimsGenerator entries are FrontierEntry objects (have .outCell).
// DFSGenerator entries are plain Cell objects.
function buildActiveSet(activeArr) {
  const set = new Set();
  for (const entry of activeArr) {
    set.add('outCell' in entry ? entry.outCell : entry);
  }
  return set;
}

// ─── HUD ──────────────────────────────────────────────────

function drawHUD() {
  const algoLabel = generatorType === "dfs" ? "DFS" : "Prim's";
  const shape     = PRESETS[presetIndex].name;
  const modeLabel = mode === MODES.SOLVING ? "SOLVING" :
                    mode === MODES.PLAYING  ? "PLAYING"  :
                    maze.isDone()           ? "done"     : "generating";
  const speedStr  = (!maze.isDone() && displayedCPS > 0) ? ` ${displayedCPS}c/s` : "";
  const flags     = [
    useNoise      ? "NOISE"    : null,
    instantMode   ? "INSTANT"  : null,
    showDistances ? "HEAT"     : null,
    showRegions   ? "REGIONS"  : null,
    showFog       ? "FOG"      : null,
  ].filter(Boolean).join(" ");

  noStroke();
  fill("#444");
  textSize(11);
  textAlign(LEFT, BOTTOM);
  textFont("monospace");

  text(
    `[${algoLabel}] ${shape}  |  ${modeLabel}${speedStr}${flags ? "  |  " + flags : ""}`,
    8, height - 20
  );
  text(
    "R=restart  ←/→=shape  N=noise  I=instant  S=solve  P=play  F=fog  G=regions  D=heat  E=export",
    8, height - 6
  );
}

// ─── Interaction: Mouse ───────────────────────────────────
// Click on any IN cell to place start (first click) then end (second click).
// Clicking while solving instantly re-runs the solver with the new endpoints.

function mousePressed() {
  if (!maze || !maze.isDone() || mode === MODES.PLAYING) return;
  if (mouseY >= ROWS * CELL_SIZE) return; // click landed in HUD

  const col = Math.floor(mouseX / CELL_SIZE);
  const row = Math.floor(mouseY / CELL_SIZE);
  if (!maze.grid.isInsideGrid(col, row)) return;

  const cell = maze.grid.getCell(col, row);
  if (!cell.isIn()) return;

  if (clickPhase === 0) {
    startCell  = cell;
    clickPhase = 1;
    if (mode === MODES.SOLVING) { mode = MODES.GENERATING; solver = null; }
  } else {
    endCell    = cell;
    clickPhase = 0;
    if (mode === MODES.SOLVING) startSolving();
  }
}

// ─── Interaction: Keyboard ────────────────────────────────

function keyPressed() {
  // E and ESC always work in any mode
  if (key === "e" || key === "E") { saveCanvas("maze", "png"); return; }

  if (keyCode === ESCAPE) {
    mode       = MODES.GENERATING;
    solver     = null;
    playerCell = null;
    revealedSet = new Set();
    return;
  }

  // P toggles PLAYING mode from/to GENERATING
  if (key === "p" || key === "P") {
    if (mode !== MODES.PLAYING) startPlaying();
    else { mode = MODES.GENERATING; playerCell = null; revealedSet = new Set(); }
    return;
  }

  // Arrow keys move the player while in PLAYING mode
  if (mode === MODES.PLAYING && playerCell) {
    const dirMap = {
      [UP_ARROW]:    "north",
      [DOWN_ARROW]:  "south",
      [RIGHT_ARROW]: "east",
      [LEFT_ARROW]:  "west",
    };
    const dir = dirMap[keyCode];
    if (dir && !playerCell.walls[dir]) {
      const d  = DIRECTIONS[dir];
      playerCell = maze.grid.getCell(
        playerCell.col + d.colDelta,
        playerCell.row + d.rowDelta
      );
      revealAround(playerCell);
    }
    return; // don't fall through to shape cycling or other controls
  }

  // All remaining controls operate in GENERATING / SOLVING modes
  if (key === "n" || key === "N") { useNoise = !useNoise; initMaze(); }
  if (key === "i" || key === "I") { instantMode = !instantMode; initMaze(); }
  if (key === "d" || key === "D") { if (distanceMap) showDistances = !showDistances; }
  if (key === "g" || key === "G") showRegions = !showRegions;
  if (key === "f" || key === "F") showFog     = !showFog;

  if (key === "s" || key === "S") {
    if (mode === MODES.GENERATING && maze.isDone()) {
      startSolving();
    } else if (mode === MODES.SOLVING) {
      mode = MODES.GENERATING;
      solver = null;
    }
  }

  if (keyCode === RIGHT_ARROW) {
    presetIndex = (presetIndex + 1) % PRESETS.length;
    initMaze();
  }
  if (keyCode === LEFT_ARROW) {
    presetIndex = (presetIndex - 1 + PRESETS.length) % PRESETS.length;
    initMaze();
  }
}

// ─── Input Setup ──────────────────────────────────────────

// Algorithm selector dropdown (Prim's / DFS).
// Adding a new generator: create the class in board.js, add an <option> in index.html,
// add a branch in initMaze() — nothing else changes.
function initAlgorithmSelector() {
  const sel = document.getElementById("algorithm");
  if (!sel) return;
  sel.addEventListener("change", (e) => {
    generatorType = e.target.value;
    initMaze();
  });
}

function initResolutionSlider() {
  const slider = document.getElementById("resolution");
  const label  = document.getElementById("resolutionValue");

  slider.addEventListener("input", (e) => {
    COLS      = Number(e.target.value);
    ROWS      = COLS;
    CELL_SIZE = Math.max(1, Math.floor(CANVAS_SIZE / COLS));
    label.textContent = `${COLS}×${ROWS}`;

    // Resize canvas to the exact pixel grid — eliminates any fractional remainder.
    resizeCanvas(COLS * CELL_SIZE, ROWS * CELL_SIZE + HUD_HEIGHT);

    // Rebuild the image mask at the new resolution so it always fits the grid.
    if (loadedImage) {
      customMask = MaskBuilder.fromImage(loadedImage, COLS, ROWS, maskThreshold);
    }

    initMaze();
  });
}

function initImageInput() {
  const fileInput       = document.getElementById("imgInput");
  const thresholdSlider = document.getElementById("threshold");
  const thresholdLabel  = document.getElementById("thresholdValue");

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      loadImage(ev.target.result, (img) => {
        loadedImage   = img;
        maskThreshold = MaskBuilder.otsuThreshold(img);
        thresholdSlider.value      = maskThreshold;
        thresholdLabel.textContent = maskThreshold;
        customMask  = MaskBuilder.fromImage(loadedImage, COLS, ROWS, maskThreshold);
        presetIndex = PRESETS.length - 1;
        initMaze();
      });
    };
    reader.readAsDataURL(file);
  });

  thresholdSlider.addEventListener("input", (e) => {
    maskThreshold = Number(e.target.value);
    thresholdLabel.textContent = maskThreshold;
    if (loadedImage) {
      customMask  = MaskBuilder.fromImage(loadedImage, COLS, ROWS, maskThreshold);
      presetIndex = PRESETS.length - 1;
      initMaze();
    }
  });
}
