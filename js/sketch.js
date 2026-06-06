import MazeGrid               from './core/MazeGrid.js';
import MaskBuilder             from './mask/MaskBuilder.js';
import BFSTraverser            from './analysis/BFSTraverser.js';
import DistanceMap             from './analysis/DistanceMap.js';
import PrimsGenerator          from './generators/PrimsGenerator.js';
import DFSGenerator            from './generators/DFSGenerator.js';
import AldousBroderGenerator   from './generators/AldousBroderGenerator.js';
import WilsonsGenerator        from './generators/WilsonsGenerator.js';
import KruskalGenerator        from './generators/KruskalGenerator.js';
import BinaryTreeGenerator     from './generators/BinaryTreeGenerator.js';
import SidewinderGenerator     from './generators/SidewinderGenerator.js';
import BFSSolver               from './solvers/BFSSolver.js';
import AStarSolver             from './solvers/AStarSolver.js';
import DeadEndFillSolver       from './solvers/DeadEndFillSolver.js';
import WallFollowerSolver      from './solvers/WallFollowerSolver.js';
import { DIRECTIONS }          from './core/constants.js';
import { mulberry32, randomSeed } from './core/prng.js';

// ─── Canvas / Grid Config ─────────────────────────────────
const CANVAS_SIZE = 600;

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
const COLOR_PATH       = "#2ecc71";
const COLOR_VISITED    = "#c8e6ff";
const COLOR_DEAD_FILL  = "#dde0e7";
const COLOR_START      = "#e74c3c";
const COLOR_END        = "#27ae60";
const COLOR_PLAYER     = "#e74c3c";
const COLOR_FOG        = "#2c2c2c";

const REGION_PALETTE = [
  "#4e9af1", "#ff8b94", "#a8e6cf", "#ffd3b6",
  "#c7ceea", "#b5ead7", "#ffeaa7", "#f0e6ff",
  "#ffe0e0", "#e0ffe0", "#e0e0ff", "#fff0e0",
];

// ─── App Modes ────────────────────────────────────────────
const MODES = Object.freeze({
  GENERATING: "generating",
  SOLVING:    "solving",
  PLAYING:    "playing",
});

// ─── Maps: algorithm id → constructor ────────────────────
const GENERATOR_MAP = {
  prims:      (grid) => new PrimsGenerator(grid),
  dfs:        (grid) => new DFSGenerator(grid),
  aldous:     (grid) => new AldousBroderGenerator(grid),
  wilsons:    (grid) => new WilsonsGenerator(grid),
  kruskal:    (grid) => new KruskalGenerator(grid),
  binarytree: (grid) => new BinaryTreeGenerator(grid),
  sidewinder: (grid) => new SidewinderGenerator(grid),
};

const SOLVER_MAP = {
  bfs:         (grid) => new BFSSolver(grid),
  astar:       (grid) => new AStarSolver(grid),
  deadend:     (grid) => new DeadEndFillSolver(grid),
  wallfollower:(grid) => new WallFollowerSolver(grid),
};

const ALGO_LABELS = {
  prims: "Prim's", dfs: "DFS", aldous: "Aldous-Broder",
  wilsons: "Wilson's", kruskal: "Kruskal", binarytree: "Binary Tree", sidewinder: "Sidewinder",
};

// ─── Image Mask State ─────────────────────────────────────
let customMask    = null;
let loadedImage   = null;
let maskThreshold = 128;

// ─── Preset Shapes ────────────────────────────────────────
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
let generatorType = "prims";
let solverType    = "bfs";
let presetIndex   = 0;

let stepsPerFrame   = 1;
let stepAccumulator = 0;

let instantMode   = false;
let showDistances = false;
let showRegions   = false;
let showFog       = false;

// ─── Seeded PRNG ──────────────────────────────────────────
// One seed → one deterministic maze. Stored as an unsigned 32-bit int.
// Set fixedSeed = true when the user types a specific seed so that
// restarting with R replays the exact same maze.
let currentSeed = randomSeed();
let fixedSeed   = false;
let rng         = mulberry32(currentSeed); // module-level; shared by randomPicker + generators

// ─── Web Worker ───────────────────────────────────────────
// When enabled, instant-mode generation runs in a background thread
// so the main thread (and therefore the UI) never blocks.
let useWorker    = false;
let activeWorker = null; // current Worker instance, or null

// ─── Ink Reveal State ────────────────────────────────────
// When inkReveal is on, the finished maze draws itself wall by
// wall onto an offscreen graphics buffer — like ink on paper.
let inkReveal      = false;  // feature toggle (persists across restarts)
let inkRevealPhase = false;  // true while the reveal animation is running
let wallQueue      = [];     // [{x1,y1,x2,y2}] all wall segments, shuffled
let wallQueueIdx   = 0;      // index of the next segment to draw
let wallBuffer     = null;   // p.Graphics accumulator

let maze        = null;
let frontierSet = new Set();
let distanceMap = null;
let regionDMs   = new Map();

let solver     = null;
let startCell  = null;
let endCell    = null;
let pathStep   = 0;
let clickPhase = 0;

let playerCell    = null;
let revealedSet   = new Set();
let playStepCount = 0;
let playStartTime = null;
let playWon       = false;

const HOLD_DELAY    = 18;
const HOLD_INTERVAL = 7;
let   rHoldFrames   = 0;

let displayedCPS  = 0;
let cpsFrameCount = 0;

// ─── p5 Instance ──────────────────────────────────────────
new p5(function(p) {

  // ── Lifecycle ───────────────────────────────────────────
  p.setup = function() {
    const cnv = p.createCanvas(COLS * CELL_SIZE, ROWS * CELL_SIZE);
    cnv.parent("canvas-container");
    p.strokeCap(p.SQUARE);
    initImageInput();
    initResolutionSlider();
    initAlgorithmSelector();
    initSolverSelector();
    initSpeedSlider();
    initShapeButtons();
    initToggleButtons();
    initActionButtons();
    initSeedInput();
    initMaze();
    updateUI();
  };

  p.draw = function() {
    p.background(COLOR_BG);

    // Advance generation
    if (mode === MODES.GENERATING) {
      if (!maze.isDone()) {
        if (!activeWorker) {
          // Normal step-by-step on the main thread
          stepAccumulator += stepsPerFrame;
          while (stepAccumulator >= 1 && !maze.isDone()) {
            maze.step(randomPicker);
            stepAccumulator -= 1;
          }
          frontierSet = buildActiveSet(maze.frontier);
          cpsFrameCount++;
          if (cpsFrameCount % 20 === 0) displayedCPS = maze.cellsPerSecond;
        }
        // else: worker is running in the background — nothing to step here
      } else if (!distanceMap) {
        computeDistanceMaps();
        if (inkReveal) startInkReveal();
      }
    }

    // Advance solver
    if (mode === MODES.SOLVING) {
      if (solver && !solver.isDone()) {
        const solverSteps = Math.max(1, Math.round(stepsPerFrame));
        for (let i = 0; i < solverSteps && !solver.isDone(); i++) solver.step();
      } else if (solver && solver.found && pathStep < solver.path.length) {
        const pathAdvance = Math.max(2, Math.round(stepsPerFrame * 2));
        pathStep = Math.min(pathStep + pathAdvance, solver.path.length);
      }
    }

    if (inkRevealPhase) drawInkReveal(); else drawGrid();
    drawModeOverlay();
    if (mode === MODES.PLAYING) drawPlayHUD();
    if (mode === MODES.PLAYING && playWon) drawWinOverlay();

    if (p.frameCount % 20 === 0) updateUI();

    // R key: tap to restart animated, hold to rapid-cycle
    if (p.keyIsDown(82)) {
      rHoldFrames++;
      if (rHoldFrames === 1) {
        initMaze();
      } else if (rHoldFrames > HOLD_DELAY && (rHoldFrames - HOLD_DELAY) % HOLD_INTERVAL === 0) {
        rapidRestart();
      }
    } else {
      rHoldFrames = 0;
    }
  };

  p.mousePressed = function() {
    if (!maze || !maze.isDone() || mode === MODES.PLAYING) return;
    if (p.mouseY >= ROWS * CELL_SIZE) return;

    const col = Math.floor(p.mouseX / CELL_SIZE);
    const row = Math.floor(p.mouseY / CELL_SIZE);
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
  };

  p.keyPressed = function() {
    if (p.key === "e" || p.key === "E") { p.saveCanvas("maze", "png"); return; }
    if (p.key === "v" || p.key === "V") { exportSVG(); return; }

    if (p.keyCode === p.ESCAPE) {
      mode          = MODES.GENERATING;
      solver        = null;
      playerCell    = null;
      revealedSet   = new Set();
      playWon       = false;
      playStepCount = 0;
      playStartTime = null;
      updateUI();
      return;
    }

    if (p.key === "p" || p.key === "P") {
      if (mode !== MODES.PLAYING) {
        startPlaying();
      } else {
        mode          = MODES.GENERATING;
        playerCell    = null;
        revealedSet   = new Set();
        playWon       = false;
        playStepCount = 0;
        playStartTime = null;
      }
      updateUI();
      return;
    }

    // Arrow keys: player movement in PLAYING mode
    if (mode === MODES.PLAYING && playerCell && !playWon) {
      const dirMap = {
        [p.UP_ARROW]:    "north",
        [p.DOWN_ARROW]:  "south",
        [p.RIGHT_ARROW]: "east",
        [p.LEFT_ARROW]:  "west",
      };
      const dir = dirMap[p.keyCode];
      if (dir && !playerCell.walls[dir]) {
        const d = DIRECTIONS[dir];
        playerCell = maze.grid.getCell(
          playerCell.col + d.colDelta,
          playerCell.row + d.rowDelta
        );
        revealAround(playerCell);
        playStepCount++;
        if (endCell && playerCell === endCell) playWon = true;
      }
      return;
    }

    if (mode === MODES.PLAYING && playWon &&
        p.key !== "p" && p.key !== "P" &&
        p.keyCode !== p.ESCAPE && !p.keyIsDown(82)) {
      return;
    }

    // Arrow keys cycle presets when not in PLAYING mode
    if (p.keyCode === p.RIGHT_ARROW) { presetIndex = (presetIndex + 1) % PRESETS.length; initMaze(); }
    if (p.keyCode === p.LEFT_ARROW)  { presetIndex = (presetIndex - 1 + PRESETS.length) % PRESETS.length; initMaze(); }

    if (p.key === "i" || p.key === "I") { instantMode = !instantMode; initMaze(); }
    if (p.key === "d" || p.key === "D") { if (distanceMap) showDistances = !showDistances; updateToggleStates(); }
    if (p.key === "g" || p.key === "G") { showRegions = !showRegions; updateToggleStates(); }
    if (p.key === "f" || p.key === "F") { showFog     = !showFog;     updateToggleStates(); }

    if (p.key === "w" || p.key === "W") {
      inkReveal = !inkReveal;
      if (inkReveal && maze.isDone() && !inkRevealPhase) {
        // Replay reveal on the current finished maze
        startInkReveal();
      } else if (!inkReveal) {
        inkRevealPhase = false;
      }
      updateToggleStates();
    }

    if (p.key === "s" || p.key === "S") {
      if (mode === MODES.GENERATING && maze.isDone()) {
        startSolving();
      } else if (mode === MODES.SOLVING) {
        mode   = MODES.GENERATING;
        solver = null;
      }
      updateActionButtonStates();
      updateUI();
    }
  };

  // ── Maze Initialization ─────────────────────────────────
  function initMaze() {
    // Cancel any worker still running from the previous maze
    if (activeWorker) { activeWorker.terminate(); activeWorker = null; }

    // Advance to a new seed unless the user has locked one in via the seed input
    if (!fixedSeed) currentSeed = randomSeed();
    rng = mulberry32(currentSeed);
    updateSeedDisplay();

    const grid = new MazeGrid(COLS, ROWS);
    grid.applyMask(PRESETS[presetIndex].build());

    const factory = GENERATOR_MAP[generatorType] ?? GENERATOR_MAP.prims;
    maze = factory(grid);
    maze.rng = rng; // inject seeded PRNG — all generators use this.rng() internally

    frontierSet    = new Set();
    distanceMap    = null;
    regionDMs      = new Map();
    solver         = null;
    pathStep       = 0;
    startCell      = null;
    endCell        = null;
    clickPhase     = 0;
    playerCell     = null;
    revealedSet    = new Set();
    playStepCount  = 0;
    playStartTime  = null;
    playWon        = false;
    mode           = MODES.GENERATING;
    cpsFrameCount  = 0;
    displayedCPS   = 0;
    stepAccumulator = 0;
    inkRevealPhase = false;
    wallQueue      = [];
    wallQueueIdx   = 0;
    if (wallBuffer) { wallBuffer.remove(); wallBuffer = null; }

    maze.init();

    if (instantMode) {
      if (useWorker) {
        runWithWorker(); // async — completes via onmessage callback
      } else {
        maze.complete(randomPicker);
        computeDistanceMaps();
        if (inkReveal) startInkReveal();
      }
    }

    updateUI();
    updateCanvasMeta();
  }

  // Instantly finishes a maze. Called while R is held for rapid-cycling.
  function rapidRestart() {
    if (activeWorker) { activeWorker.terminate(); activeWorker = null; }

    // Fresh seed for each rapid cycle (unless the user has a fixed seed)
    if (!fixedSeed) currentSeed = randomSeed();
    rng = mulberry32(currentSeed);
    updateSeedDisplay();

    const grid = new MazeGrid(COLS, ROWS);
    grid.applyMask(PRESETS[presetIndex].build());

    const factory = GENERATOR_MAP[generatorType] ?? GENERATOR_MAP.prims;
    maze = factory(grid);
    maze.rng = rng;

    frontierSet   = new Set();
    solver        = null;
    pathStep      = 0;
    startCell     = null;
    endCell       = null;
    playerCell    = null;
    revealedSet   = new Set();
    playStepCount = 0;
    playStartTime = null;
    playWon       = false;
    mode          = MODES.GENERATING;

    inkRevealPhase = false;
    wallQueue      = [];
    wallQueueIdx   = 0;
    if (wallBuffer) { wallBuffer.remove(); wallBuffer = null; }

    maze.init();

    if (useWorker) {
      runWithWorker(); // async — updateUI() fires in the worker's onmessage
      return;
    }

    maze.complete(randomPicker);
    computeDistanceMaps();
    if (inkReveal) startInkReveal();
    updateUI();
  }

  // ── Distance Maps ───────────────────────────────────────
  function computeDistanceMaps() {
    regionDMs   = new Map();
    distanceMap = null;

    const seeds = new Map();
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
      const dm1 = new DistanceMap(maze.grid, new BFSTraverser());
      dm1.compute(seed.col, seed.row);
      const f1 = getFarthestCell(dm1);
      if (!f1) continue;

      const dm = new DistanceMap(maze.grid, new BFSTraverser());
      dm.compute(f1.col, f1.row);
      regionDMs.set(rIdx, dm);

      if (dm.maxDistance > bestMaxDist) {
        bestMaxDist = dm.maxDistance;
        bestF1      = f1;
        bestF2      = getFarthestCell(dm);
        distanceMap = dm;
      }
    }

    if (!distanceMap && regionDMs.size > 0) {
      distanceMap = regionDMs.values().next().value;
    }

    if (!startCell && bestF1) startCell = bestF1;
    if (!endCell   && bestF2) endCell   = bestF2;
  }

  function getFarthestCell(dm) {
    let maxDist = -1, farthest = null;
    for (const [cell, dist] of dm.distances) {
      if (dist > maxDist) { maxDist = dist; farthest = cell; }
    }
    return farthest;
  }

  // ── Solver ──────────────────────────────────────────────
  function startSolving() {
    if (!maze.isDone() || !startCell || !endCell) return;
    if (startCell === endCell || !startCell.isIn() || !endCell.isIn()) return;

    const factory = SOLVER_MAP[solverType] ?? SOLVER_MAP.bfs;
    solver = factory(maze.grid);
    solver.init(startCell, endCell);
    pathStep = 0;
    mode     = MODES.SOLVING;
  }

  // ── Player ──────────────────────────────────────────────
  function startPlaying() {
    if (!maze.isDone()) return;
    playerCell    = startCell || maze.grid.findFirstInCell();
    revealedSet   = new Set();
    playStepCount = 0;
    playStartTime = p.millis();
    playWon       = false;
    if (playerCell) revealAround(playerCell);
    mode = MODES.PLAYING;
  }

  function revealAround(cell) {
    revealedSet.add(cell);
    for (const n of maze.grid.getPassableNeighbors(cell.col, cell.row)) {
      revealedSet.add(n);
    }
  }

  // ── Ink Reveal ──────────────────────────────────────────
  // Creates an offscreen graphics buffer and populates the wall
  // segment queue with every wall in the finished maze, shuffled
  // so they draw in a random, organic order.
  function startInkReveal() {
    if (wallBuffer) wallBuffer.remove();
    wallBuffer = p.createGraphics(p.width, p.height);
    wallBuffer.background(255);           // white paper base
    wallBuffer.strokeCap(p.SQUARE);
    wallBuffer.noFill();

    wallQueue    = buildWallSegments();
    wallQueueIdx = 0;
    inkRevealPhase = true;
  }

  // Collects every wall line segment in the maze exactly once,
  // then Fisher-Yates shuffles for a random draw order.
  // Same "draw each wall once" logic as SVG export to avoid double lines.
  function buildWallSegments() {
    const segs = [];
    const sw   = CELL_SIZE >= 8 ? 1.5 : 1;

    for (let row = 0; row < maze.grid.rows; row++) {
      for (let col = 0; col < maze.grid.cols; col++) {
        const cell = maze.grid.getCell(col, row);
        if (cell.isExcluded()) continue;

        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;
        const s = CELL_SIZE;

        if (row === 0 && cell.walls.north) segs.push({ x1: x,   y1: y,   x2: x+s, y2: y,   sw });
        if (col === 0 && cell.walls.west)  segs.push({ x1: x,   y1: y,   x2: x,   y2: y+s, sw });
        if (cell.walls.south)              segs.push({ x1: x,   y1: y+s, x2: x+s, y2: y+s, sw });
        if (cell.walls.east)               segs.push({ x1: x+s, y1: y,   x2: x+s, y2: y+s, sw });
      }
    }

    // Fisher-Yates shuffle — uses seeded rng for a reproducible draw order
    for (let i = segs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [segs[i], segs[j]] = [segs[j], segs[i]];
    }

    return segs;
  }

  // Called each frame instead of drawGrid() while inkRevealPhase is true.
  // Draws a batch of wall segments to the offscreen buffer, then blits
  // the buffer to the main canvas. Overlays (start/end pins, mode pill)
  // are drawn on top of the blit by the normal code path.
  function drawInkReveal() {
    // Paper-white background for the ink aesthetic
    p.background("#faf9f6");

    // Advance the queue: more segments per frame at higher speed settings
    const segPerFrame = Math.max(1, Math.round(stepsPerFrame * 8));
    wallBuffer.stroke(COLOR_WALL);

    for (let i = 0; i < segPerFrame && wallQueueIdx < wallQueue.length; i++) {
      const { x1, y1, x2, y2, sw } = wallQueue[wallQueueIdx++];
      wallBuffer.strokeWeight(sw);
      wallBuffer.line(x1, y1, x2, y2);
    }

    // Blit accumulated lines onto the main canvas
    p.image(wallBuffer, 0, 0);

    // Draw start / end pins on top so they remain visible during reveal
    if (startCell) {
      p.noStroke();
      p.fill(COLOR_START);
      const r = Math.max(3, CELL_SIZE * 0.3);
      p.ellipse(
        startCell.col * CELL_SIZE + CELL_SIZE / 2,
        startCell.row * CELL_SIZE + CELL_SIZE / 2,
        r * 2
      );
    }
    if (endCell) {
      p.noStroke();
      p.fill(COLOR_END);
      const r = Math.max(3, CELL_SIZE * 0.3);
      p.ellipse(
        endCell.col * CELL_SIZE + CELL_SIZE / 2,
        endCell.row * CELL_SIZE + CELL_SIZE / 2,
        r * 2
      );
    }

    // Finish reveal phase once all segments are drawn
    if (wallQueueIdx >= wallQueue.length) inkRevealPhase = false;
  }

  // ── Rendering ───────────────────────────────────────────
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

    if (cell.isExcluded()) {
      p.noStroke(); p.fill(COLOR_EXCLUDED);
      p.rect(x, y, CELL_SIZE, CELL_SIZE);
      return;
    }

    if (mode === MODES.PLAYING && showFog && !revealedSet.has(cell)) {
      p.noStroke(); p.fill(COLOR_FOG);
      p.rect(x, y, CELL_SIZE, CELL_SIZE);
      return;
    }

    p.noStroke();
    p.fill(getCellColor(cell));
    p.rect(x, y, CELL_SIZE, CELL_SIZE);

    p.stroke(COLOR_WALL);
    p.strokeWeight(CELL_SIZE >= 8 ? 1.5 : 1);

    if (cell.walls.north) p.line(x,             y,             x + CELL_SIZE, y            );
    if (cell.walls.south) p.line(x,             y + CELL_SIZE, x + CELL_SIZE, y + CELL_SIZE);
    if (cell.walls.east)  p.line(x + CELL_SIZE, y,             x + CELL_SIZE, y + CELL_SIZE);
    if (cell.walls.west)  p.line(x,             y,             x,             y + CELL_SIZE);
  }

  // Priority order (highest wins): player → start/end → path → visited →
  // heatmap → regions → generation state
  function getCellColor(cell) {
    if (mode === MODES.PLAYING && cell === playerCell) return COLOR_PLAYER;
    if (cell === startCell) return COLOR_START;
    if (cell === endCell)   return COLOR_END;

    if (solver && solver.found && pathStep > 0 && solver.solverType !== "wallfollower") {
      const idx = solver.pathIndexMap.get(cell);
      if (idx !== undefined && idx < pathStep) return COLOR_PATH;
    }

    if (solver && solver.visitedSet.has(cell)) {
      const showAlways = solver.showVisitedAlways ?? false;
      if (!solver.found || showAlways) {
        const sType = solver.solverType;
        if (sType === "deadend")      return COLOR_DEAD_FILL;
        if (sType === "wallfollower") {
          const idx = solver.pathIndexMap.get(cell);
          return (idx !== undefined) ? COLOR_PATH : COLOR_VISITED;
        }
        return COLOR_VISITED;
      }
    }

    if (showDistances && cell.isIn() && cell.regionIndex >= 0) {
      const dm = regionDMs.get(cell.regionIndex);
      if (dm && dm.distances.has(cell)) {
        return p.lerpColor(p.color(COLOR_NEAR), p.color(COLOR_FAR), dm.getNormalized(cell));
      }
    }

    if (showRegions && cell.isIn() && cell.regionIndex >= 0) {
      return REGION_PALETTE[cell.regionIndex % REGION_PALETTE.length];
    }

    if (cell === maze.lastAddedCell) return COLOR_LAST_ADDED;
    if (cell.isIn())                 return COLOR_IN;
    if (frontierSet.has(cell))       return COLOR_FRONTIER;
    return COLOR_OUT;
  }

  // ── Pickers ─────────────────────────────────────────────
  function randomPicker(items) {
    return Math.floor(rng() * items.length);
  }

  // ── Active Set ──────────────────────────────────────────
  function buildActiveSet(activeArr) {
    const set = new Set();
    for (const entry of activeArr) {
      set.add('outCell' in entry ? entry.outCell : entry);
    }
    return set;
  }

  // ── Canvas Mode Overlay ─────────────────────────────────
  function drawModeOverlay() {
    const modeLabel = activeWorker !== null    ? "WORKING"    :
                      inkRevealPhase           ? "REVEAL"     :
                      mode === MODES.SOLVING   ? "SOLVING"    :
                      mode === MODES.PLAYING   ? "PLAYING"    :
                      maze.isDone()            ? "DONE"       : "GENERATING";
    const speedStr  = (!maze.isDone() && !activeWorker && displayedCPS > 0) ? `  ${displayedCPS}c/s` : "";
    const revealStr = inkRevealPhase ? `  ${wallQueueIdx}/${wallQueue.length}` : "";
    const label     = modeLabel + speedStr + revealStr;

    p.textFont("monospace");
    p.textSize(11);

    const tw = p.textWidth(label);
    const bx = p.width - tw - 22;

    p.noStroke();
    p.fill(255, 255, 255, 220);
    p.rect(bx - 2, 7, tw + 18, 20, 5);
    p.stroke(220, 220, 228);
    p.strokeWeight(1);
    p.rect(bx - 2, 7, tw + 18, 20, 5);
    p.noStroke();

    if      (activeWorker !== null)  p.fill("#7c3aed");  // worker running
    else if (inkRevealPhase)         p.fill("#6d28d9");
    else if (mode === MODES.SOLVING) p.fill("#92400e");
    else if (mode === MODES.PLAYING) p.fill("#b91c1c");
    else if (maze.isDone())          p.fill("#15803d");
    else                             p.fill("#2563eb");

    p.textAlign(p.CENTER, p.CENTER);
    p.text(label, bx + (tw + 14) / 2, 17);
    p.textAlign(p.LEFT, p.BOTTOM);
  }

  // ── Play HUD & Win Overlay ──────────────────────────────
  function drawPlayHUD() {
    if (!playerCell || playWon) return;
    const elapsed = playStartTime ? ((p.millis() - playStartTime) / 1000).toFixed(1) + 's' : '0.0s';
    const label   = `${playStepCount} steps  ·  ${elapsed}`;

    p.textFont("monospace");
    p.textSize(11);
    const tw = p.textWidth(label);
    const px = 6, py = p.height - 26;

    p.noStroke(); p.fill(255, 255, 255, 200);
    p.rect(px, py, tw + 16, 20, 4);
    p.stroke(200, 200, 210); p.strokeWeight(1);
    p.rect(px, py, tw + 16, 20, 4);
    p.noStroke(); p.fill("#333");
    p.textAlign(p.LEFT, p.CENTER);
    p.text(label, px + 8, py + 10);
    p.textAlign(p.LEFT, p.BOTTOM);
  }

  function drawWinOverlay() {
    const elapsed = playStartTime ? ((p.millis() - playStartTime) / 1000).toFixed(1) : "0.0";
    p.noStroke(); p.fill(255, 255, 255, 210);
    p.rect(0, 0, p.width, p.height);

    p.textAlign(p.CENTER, p.CENTER);
    p.fill("#15803d"); p.textFont("sans-serif"); p.textSize(28);
    p.text("Solved!", p.width / 2, p.height / 2 - 28);

    p.fill("#555"); p.textSize(15);
    p.text(`${playStepCount} steps  ·  ${elapsed}s`, p.width / 2, p.height / 2 + 6);

    p.fill("#999"); p.textSize(12);
    p.text("Press P to play again  ·  R to generate a new maze", p.width / 2, p.height / 2 + 30);
    p.textAlign(p.LEFT, p.BOTTOM);
  }

  // ── SVG Export ──────────────────────────────────────────
  function exportSVG() {
    if (!maze || !maze.isDone()) return;

    const sw = CELL_SIZE >= 8 ? 1.5 : 1;
    let lines = '';

    for (let row = 0; row < maze.grid.rows; row++) {
      for (let col = 0; col < maze.grid.cols; col++) {
        const cell = maze.grid.getCell(col, row);
        if (cell.isExcluded()) continue;

        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;
        const s = CELL_SIZE;

        if (row === 0 && cell.walls.north)
          lines += `<line x1="${x}" y1="${y}" x2="${x + s}" y2="${y}"/>`;
        if (col === 0 && cell.walls.west)
          lines += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + s}"/>`;
        if (cell.walls.south)
          lines += `<line x1="${x}" y1="${y + s}" x2="${x + s}" y2="${y + s}"/>`;
        if (cell.walls.east)
          lines += `<line x1="${x + s}" y1="${y}" x2="${x + s}" y2="${y + s}"/>`;
      }
    }

    const W   = COLS * CELL_SIZE;
    const H   = ROWS * CELL_SIZE;
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  <g stroke="black" stroke-width="${sw}" stroke-linecap="square" fill="none">
    ${lines}
  </g>
</svg>`;

    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "maze.svg";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Sidebar UI Sync ─────────────────────────────────────
  function updateUI() {
    const modeLabel = mode === MODES.SOLVING ? "SOLVING" :
                      mode === MODES.PLAYING  ? "PLAYING"  :
                      maze.isDone()           ? "DONE"     : "GENERATING";
    const modeCls   = mode === MODES.SOLVING ? "solving" :
                      mode === MODES.PLAYING  ? "playing"  :
                      maze.isDone()           ? "done"     : "generating";

    const statusMode = document.getElementById("statusMode");
    if (statusMode) { statusMode.textContent = modeLabel; statusMode.className = `mode-badge ${modeCls}`; }

    const statusAlgo = document.getElementById("statusAlgo");
    if (statusAlgo) statusAlgo.textContent = ALGO_LABELS[generatorType] ?? generatorType;

    const statusSpeed = document.getElementById("statusSpeed");
    if (statusSpeed) statusSpeed.textContent = (!maze.isDone() && displayedCPS > 0) ? `${displayedCPS} cells/s` : "";

    updateToggleStates();
    updateActionButtonStates();
    updateShapeButtonStates();
  }

  function updateToggleStates() {
    const toggleMap = {
      toggleInstant:    instantMode,
      toggleWorker:     useWorker,
      toggleHeat:       showDistances,
      toggleRegions:    showRegions,
      toggleFog:        showFog,
      toggleInkReveal:  inkReveal,
    };
    for (const [id, active] of Object.entries(toggleMap)) {
      const btn = document.getElementById(id);
      if (btn) btn.classList.toggle("active", active);
    }
  }

  function updateActionButtonStates() {
    document.getElementById("btnSolve")?.classList.toggle("active", mode === MODES.SOLVING);
    document.getElementById("btnPlay")?.classList.toggle("active",  mode === MODES.PLAYING);
  }

  function updateShapeButtonStates() {
    document.querySelectorAll(".shape-btn").forEach(btn => {
      btn.classList.toggle("active", parseInt(btn.dataset.preset) === presetIndex);
    });
  }

  function updateCanvasMeta() {
    const el = document.getElementById("canvasMeta");
    if (el) el.textContent = `${COLS * CELL_SIZE} × ${ROWS * CELL_SIZE} px  ·  ${COLS} × ${ROWS} cells`;
  }

  // ── Input Setup ─────────────────────────────────────────
  function initShapeButtons() {
    document.querySelectorAll(".shape-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        presetIndex = parseInt(btn.dataset.preset);
        initMaze();
      });
    });
  }

  function initToggleButtons() {
    const actions = {
      toggleInstant:   () => { instantMode = !instantMode; initMaze(); },
      toggleWorker:    () => {
        useWorker = !useWorker;
        // If turning off while a worker is running, abort it gracefully
        if (!useWorker && activeWorker) { activeWorker.terminate(); activeWorker = null; }
        updateToggleStates();
      },
      toggleHeat:      () => { if (distanceMap) showDistances = !showDistances; updateToggleStates(); },
      toggleRegions:   () => { showRegions   = !showRegions;                     updateToggleStates(); },
      toggleFog:       () => { showFog       = !showFog;                         updateToggleStates(); },
      toggleInkReveal: () => {
        inkReveal = !inkReveal;
        if (inkReveal && maze.isDone() && !inkRevealPhase) startInkReveal();
        else if (!inkReveal) inkRevealPhase = false;
        updateToggleStates();
      },
    };
    for (const [id, fn] of Object.entries(actions)) {
      document.getElementById(id)?.addEventListener("click", fn);
    }
  }

  function initActionButtons() {
    document.getElementById("btnSolve")?.addEventListener("click", () => {
      if (mode === MODES.GENERATING && maze.isDone()) startSolving();
      else if (mode === MODES.SOLVING) { mode = MODES.GENERATING; solver = null; }
      updateActionButtonStates();
      updateUI();
    });

    document.getElementById("btnPlay")?.addEventListener("click", () => {
      if (mode !== MODES.PLAYING) startPlaying();
      else { mode = MODES.GENERATING; playerCell = null; revealedSet = new Set(); }
      updateActionButtonStates();
      updateUI();
    });

    document.getElementById("btnExport")?.addEventListener("click", () => p.saveCanvas("maze", "png"));
    document.getElementById("btnExportSVG")?.addEventListener("click", exportSVG);
  }

  function initAlgorithmSelector() {
    const sel = document.getElementById("algorithm");
    if (!sel) return;
    sel.addEventListener("change", (e) => {
      generatorType = e.target.value;
      initMaze();
    });
  }

  function initSolverSelector() {
    const sel = document.getElementById("solver");
    if (!sel) return;
    sel.addEventListener("change", (e) => {
      solverType = e.target.value;
      if (mode === MODES.SOLVING) startSolving();
    });
  }

  function initSpeedSlider() {
    const slider = document.getElementById("speed");
    const label  = document.getElementById("speedValue");
    if (!slider) return;
    slider.addEventListener("input", (e) => {
      stepsPerFrame = Number(e.target.value);
      if (label) label.textContent = stepsPerFrame === 1 ? "1× (default)" : `${stepsPerFrame}×`;
    });
  }

  function initResolutionSlider() {
    const slider = document.getElementById("resolution");
    const label  = document.getElementById("resolutionValue");

    slider.addEventListener("input", (e) => {
      COLS      = Number(e.target.value);
      ROWS      = COLS;
      CELL_SIZE = Math.max(1, Math.floor(CANVAS_SIZE / COLS));
      label.textContent = `${COLS} × ${ROWS}`;

      p.resizeCanvas(COLS * CELL_SIZE, ROWS * CELL_SIZE);

      if (loadedImage) {
        customMask = MaskBuilder.fromImage(loadedImage, COLS, ROWS, maskThreshold);
      }

      initMaze();
      updateCanvasMeta();
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
        p.loadImage(ev.target.result, (img) => {
          loadedImage   = img;
          maskThreshold = MaskBuilder.otsuThreshold(img);
          thresholdSlider.value      = maskThreshold;
          thresholdLabel.textContent = maskThreshold;
          customMask  = MaskBuilder.fromImage(loadedImage, COLS, ROWS, maskThreshold);
          presetIndex = PRESETS.length - 1;
          initMaze();
          updateShapeButtonStates();
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

  // ── Web Worker ──────────────────────────────────────────
  // Serialises the current mask, spins up a module Worker, and lets it
  // run the maze to completion on a background thread.  When the worker
  // posts back the result, we apply the packed cell data in-place and
  // trigger the same post-generation steps as the synchronous path.
  function runWithWorker() {
    if (activeWorker) { activeWorker.terminate(); activeWorker = null; }

    // Serialise mask as a flat Uint8Array (transferred zero-copy)
    const mask2d   = PRESETS[presetIndex].build();
    const maskFlat = new Uint8Array(COLS * ROWS);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        maskFlat[r * COLS + c] = mask2d[r][c] ? 1 : 0;

    activeWorker = new Worker(
      new URL('./worker/generatorWorker.js', import.meta.url),
      { type: 'module' }
    );

    activeWorker.onmessage = ({ data: { buf } }) => {
      applyWorkerResult(buf);
      activeWorker = null;
      computeDistanceMaps();
      if (inkReveal) startInkReveal();
      updateUI();
    };

    activeWorker.onerror = (err) => {
      console.error('Generator worker error:', err.message);
      activeWorker = null;
      // Graceful fallback: finish synchronously on the main thread
      maze.complete(randomPicker);
      computeDistanceMaps();
      if (inkReveal) startInkReveal();
      updateUI();
    };

    // Transfer maskFlat.buffer (zero-copy) and send config to the worker
    activeWorker.postMessage(
      { cols: COLS, rows: ROWS, maskFlat, generatorType, seed: currentSeed },
      [maskFlat.buffer]
    );
  }

  // Unpacks the packed Int16Array sent by the worker and writes each
  // cell's state, walls, and region back into maze.grid in-place.
  // Format: 5 Int16 values per cell — [col, row, stateCode, wallBits, regionIndex]
  //   stateCode : 0=OUT  1=IN  2=EXCLUDED
  //   wallBits  : bit3=north  bit2=south  bit1=east  bit0=west  (1=wall present)
  function applyWorkerResult(buf) {
    const STATE_NAMES = ['out', 'in', 'excluded'];
    for (let i = 0; i < buf.length; i += 5) {
      const col    = buf[i];
      const row    = buf[i + 1];
      const code   = buf[i + 2];
      const bits   = buf[i + 3];
      const region = buf[i + 4];

      const cell       = maze.grid.getCell(col, row);
      cell.state       = STATE_NAMES[code] ?? 'out';
      cell.walls.north = !!(bits & 8);
      cell.walls.south = !!(bits & 4);
      cell.walls.east  = !!(bits & 2);
      cell.walls.west  = !!(bits & 1);
      cell.regionIndex = region;
    }
    maze.done = true; // mark generator as complete
  }

  // ── Seed UI ─────────────────────────────────────────────
  function updateSeedDisplay() {
    const el = document.getElementById("seedDisplay");
    if (el) el.textContent = currentSeed;
    // Keep the input in sync unless the user has typed a custom value
    const input = document.getElementById("seedInput");
    if (input && !fixedSeed) input.value = currentSeed;
  }

  function initSeedInput() {
    const input     = document.getElementById("seedInput");
    const btnReseed = document.getElementById("btnReseed");

    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const v = parseInt(input.value, 10);
          if (!isNaN(v)) {
            currentSeed = v >>> 0; // force unsigned 32-bit
            fixedSeed   = true;
            initMaze();
          }
        }
      });
      // Clear fixedSeed flag when the user empties the field
      input.addEventListener("input", () => {
        if (input.value.trim() === "") fixedSeed = false;
      });
    }

    if (btnReseed) {
      btnReseed.addEventListener("click", () => {
        fixedSeed = false;
        if (input) input.value = "";
        initMaze(); // picks a fresh random seed in initMaze()
      });
    }

    updateSeedDisplay();
  }

}); // end new p5
