# Maze Generation: Prim's Algorithm

This document defines the Prim's Algorithm maze generation approach for a p5.js implementation.
It covers the problem, core concepts, the algorithm in detail, pseudocode, data model, and a
step-by-step implementation checklist.

---

## 1. What Is a Maze?

A maze is a grid of cells connected by passages.

- Every cell has up to 4 neighbors: **north**, **south**, **east**, **west**.
- A wall exists between two cells when there is no passage between them.
- A perfect maze has exactly one path between any two cells.
  - No loops.
  - No isolated regions.
  - Every cell is reachable from every other cell.

---

## 2. What Is Prim's Algorithm?

Prim's Algorithm is a method to generate a **perfect maze** by growing a spanning tree
one cell at a time from a random starting point.

It is adapted from the **Minimum Spanning Tree** algorithm used in graph theory.
In the maze context, there are no edge weights — the word "Prim's" refers to the
structural idea: start from one cell, keep a frontier of candidate walls, and
randomly pick one to open.

The result is a maze that feels **organic and branchy**, with many short dead ends
spreading outward from the start, rather than long winding corridors.

---

## 3. Core Concepts

### 3.1 Grid

The maze lives on a rectangular grid of **W columns** by **H rows**.

Each cell is identified by its column and row position:

```text
(col, row) where col is 0 to W-1, row is 0 to H-1
```

Cells are addressed in `(col, row)` format throughout this document.

### 3.2 Cell States

Every cell has one of two states at any point during generation:

| State | Meaning |
| --- | --- |
| `in` | The cell has been added to the maze (part of the growing tree). |
| `out` | The cell has not been added yet. |

At the start of the algorithm, all cells are `out`.
As the algorithm runs, cells move from `out` to `in` one at a time.

### 3.3 Walls

By default, every cell starts **fully walled**: all four sides are closed.

A wall between two adjacent cells is a shared boundary.
Removing a wall between cell A and cell B creates a passage between them.

Walls are stored **per cell**, as four flags:

```text
north: boolean  (wall on the top side of this cell)
south: boolean  (wall on the bottom side of this cell)
east:  boolean  (wall on the right side of this cell)
west:  boolean  (wall on the left side of this cell)
```

When a passage is opened between two cells, both cells update their shared wall:

- If moving **north** from cell A to cell B: remove A's north wall and B's south wall.
- If moving **south** from cell A to cell B: remove A's south wall and B's north wall.
- If moving **east**  from cell A to cell B: remove A's east wall  and B's west wall.
- If moving **west**  from cell A to cell B: remove A's west wall  and B's east wall.

### 3.4 The Frontier List

The frontier list is the heart of Prim's algorithm.

It is a collection of **wall candidates**: pairs of cells `(inCell, outCell)` where:
- `inCell` is already part of the maze.
- `outCell` is a neighbor of `inCell` that has not been added yet.

Each entry in the frontier represents a **potential passage** that could be opened.

The algorithm picks one entry at random, opens the passage, adds the new cell to
the maze, then expands the frontier with the new cell's unvisited neighbors.

---

## 4. The Algorithm Step by Step

### Step 1 — Initialize the grid

Create a W × H grid. Every cell starts with all four walls intact and state `out`.

### Step 2 — Pick a random starting cell

Choose any cell at random. Mark it as `in`.

Add all of its valid `out` neighbors to the frontier list as `(startCell, neighbor)` pairs.

### Step 3 — Pick a random frontier entry

While the frontier list is not empty:

1. Choose a random entry `(inCell, outCell)` from the frontier list.
2. Remove it from the frontier list.

### Step 4 — Check if the out cell is still out

It is possible that `outCell` has already been added to the maze by a different
frontier entry since this entry was added.

If `outCell` is already `in`, **skip this entry** and go back to Step 3.

### Step 5 — Open the passage

If `outCell` is still `out`:

1. Remove the wall between `inCell` and `outCell`.
2. Mark `outCell` as `in`.
3. Add all of `outCell`'s valid `out` neighbors to the frontier list.

### Step 6 — Repeat

Go back to Step 3 until the frontier list is empty.

When the frontier is empty, every cell has been added to the maze.
The result is a complete perfect maze.

---

## 5. Pseudocode

```text
function generateMaze(grid):
  pick a random startCell
  mark startCell as in
  add all out neighbors of startCell to frontier

  while frontier is not empty:
    pick a random entry (inCell, outCell) from frontier
    remove that entry from frontier

    if outCell is already in:
      continue

    removeWall(inCell, outCell)
    mark outCell as in

    for each neighbor of outCell:
      if neighbor is out and neighbor is inside the grid:
        add (outCell, neighbor) to frontier

  return grid


function removeWall(cellA, cellB):
  if cellB is north of cellA:
    cellA.walls.north = false
    cellB.walls.south = false

  if cellB is south of cellA:
    cellA.walls.south = false
    cellB.walls.north = false

  if cellB is east of cellA:
    cellA.walls.east = false
    cellB.walls.west = false

  if cellB is west of cellA:
    cellA.walls.west = false
    cellB.walls.east = false
```

---

## 6. Visual Example (5 × 5 Grid)

Each step below shows the state of a small grid.
`S` = starting cell, `#` = in, `.` = out, `F` = cell just added.

```text
Step 0: Start at (2,2)

. . . . .
. . . . .
. . S . .
. . . . .
. . . . .

Step 1: Open passage to (2,1). Frontier grows.

. . . . .
. . F . .
. . # . .
. . . . .
. . . . .

Step 2: Open passage to (3,2). Frontier grows.

. . . . .
. . # . .
. . # F .
. . . . .
. . . . .

...and so on until every cell is #
```

---

## 7. Key Properties of the Result

| Property | Value |
| --- | --- |
| Maze type | Perfect (no loops, no isolated regions) |
| Visual texture | Dense branching, many short dead ends |
| Start bias | Heavy branching near the starting cell |
| Time complexity | O(W × H) — each cell is processed once |
| Space complexity | O(W × H) — frontier can grow up to total cell count |

Compared to other maze algorithms:

| Algorithm | Texture | Loop-free? |
| --- | --- | --- |
| Prim's | Dense branches, short dead ends | Yes |
| Recursive Backtracker (DFS) | Long winding corridors | Yes |
| Kruskal's | Uniform random texture | Yes |
| Binary Tree | Diagonal bias | Yes |

---

## 8. Directions and Neighbor Logic

For a cell at `(col, row)`, its four neighbors are:

| Direction | Neighbor position | Wall to remove on source | Wall to remove on neighbor |
| --- | --- | --- | --- |
| North | `(col, row - 1)` | `north` | `south` |
| South | `(col, row + 1)` | `south` | `north` |
| East  | `(col + 1, row)` | `east`  | `west`  |
| West  | `(col - 1, row)` | `west`  | `east`  |

A neighbor is only valid if its `col` is between `0` and `W - 1`
and its `row` is between `0` and `H - 1`.

---

## 9. Suggested Data Model

This describes the state shape the project will need.

```js
// A single cell on the grid
const cell = {
  col: 3,
  row: 2,
  state: "out",        // "in" or "out"
  walls: {
    north: true,
    south: true,
    east:  true,
    west:  true,
  },
};

// A frontier entry linking an in-cell to its out-neighbor
const frontierEntry = {
  inCell:  cell,       // already part of the maze
  outCell: cell,       // candidate to be added
};

// The full maze state
const mazeState = {
  cols:     20,
  rows:     20,
  cells:    [],        // 2D array: cells[row][col]
  frontier: [],        // array of frontierEntry objects
  done:     false,
};
```

---

## 10. Rendering Model (p5.js)

Each cell is drawn as a square of size `cellSize` pixels.

The top-left corner of cell `(col, row)` on the canvas is:

```text
x = col * cellSize
y = row * cellSize
```

To draw walls, check each flag and draw a line on the matching side of the cell:

```text
north wall: line from (x, y)            to (x + cellSize, y)
south wall: line from (x, y + cellSize) to (x + cellSize, y + cellSize)
east wall:  line from (x + cellSize, y) to (x + cellSize, y + cellSize)
west wall:  line from (x, y)            to (x, y + cellSize)
```

To avoid drawing every shared wall twice, you can draw only the **north** and **west**
walls for each cell, then draw the outer border of the grid separately.
Alternatively, draw all four walls per cell — it is simpler and the lines overlap
cleanly at the same pixel coordinates.

Cell coloring suggestions:

| Cell state | Suggested color |
| --- | --- |
| `out` (not yet in maze) | dark fill, e.g. `#1a1a2e` |
| `in` (added to maze) | light fill, e.g. `#eaeaea` |
| frontier neighbors | accent color, e.g. `#4e9af1` |
| most recently added | highlight color, e.g. `#f6d365` |

---

## 11. Animation Strategy

There are two ways to animate the generation:

### Option A — Step per frame

Run one iteration of the algorithm per `draw()` call.
This is the simplest approach and makes the growth clearly visible at normal frame rates.

```text
draw():
  if frontier is not empty:
    run one Prim's step
  render the grid
```

### Option B — Steps per frame (speed control)

Run N iterations per `draw()` call, where N is a configurable speed.
This lets the user watch fast or slow.

```text
draw():
  repeat N times:
    if frontier is not empty:
      run one Prim's step
  render the grid
```

---

## 12. Implementation Checklist

Build in this order. Each layer should work before adding the next.

### Layer 1 — Grid and Cell Model

- [ ] Define a `Cell` class with `col`, `row`, `state`, and `walls`.
- [ ] Define a `MazeGrid` class that creates a 2D array of cells.
- [ ] Add a `getCell(col, row)` method.
- [ ] Add a `getNeighbors(col, row)` method that returns valid in-bounds neighbors.
- [ ] Add a `removeWall(cellA, cellB)` method that updates both cells.

### Layer 2 — Prim's Algorithm Logic

- [ ] Define a `PrimsMaze` class (or logic module) that holds `grid` and `frontier`.
- [ ] Add an `init(startCol, startRow)` method: marks start cell as `in`, populates frontier.
- [ ] Add a `step()` method: runs one iteration of the algorithm.
- [ ] Add an `isDone()` method: returns true when frontier is empty.

### Layer 3 — p5.js Rendering

- [ ] Create `index.html` that loads p5.js and your scripts.
- [ ] In `setup()`: create canvas, initialize `MazeGrid` and `PrimsMaze`.
- [ ] In `draw()`: call `maze.step()`, then render every cell and its walls.
- [ ] Draw walls as lines based on each cell's wall flags.
- [ ] Color cells differently based on their `state`.

### Layer 4 — Polish

- [ ] Highlight the current frontier cells in a distinct color.
- [ ] Highlight the most recently added cell.
- [ ] Add a restart button or keyboard shortcut to regenerate.
- [ ] Add speed control (steps per frame).

---

## 13. Common Mistakes to Avoid

| Mistake | What goes wrong | Fix |
| --- | --- | --- |
| Not checking if `outCell` is already `in` | Duplicate passages, non-perfect maze | Always check state before opening wall |
| Storing cell references instead of positions in frontier | Stale references if cells are recreated | Store `(col, row)` pairs or stable references |
| Forgetting to remove wall on both cells | One-sided walls break rendering | Always call `removeWall` which updates both |
| Not validating neighbors are inside the grid | Array out-of-bounds errors | Check `col >= 0 && col < cols && row >= 0 && row < rows` |
| Running the full algorithm before rendering | No animation, just instant result | Use `step()` called once per frame |
