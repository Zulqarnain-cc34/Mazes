// The two possible states a cell can be in during maze generation.
// "out" means the cell has not been added to the maze yet.
// "in"  means the cell has been added to the maze.
export const CELL_STATES = Object.freeze({
  OUT:      "out",       // not yet added to the maze
  IN:       "in",        // added to the maze
  EXCLUDED: "excluded",  // outside the shape — never touched by any algorithm
});

// The four directions a cell can connect to a neighbor.
// Each direction stores:
//   - colDelta: how many columns to move to reach the neighbor
//   - rowDelta: how many rows to move to reach the neighbor
//   - opposite: the direction name as seen from the neighbor's side
export const DIRECTIONS = Object.freeze({
  north: Object.freeze({ colDelta:  0, rowDelta: -1, opposite: "south" }),
  south: Object.freeze({ colDelta:  0, rowDelta:  1, opposite: "north" }),
  east:  Object.freeze({ colDelta:  1, rowDelta:  0, opposite: "west"  }),
  west:  Object.freeze({ colDelta: -1, rowDelta:  0, opposite: "east"  }),
});
