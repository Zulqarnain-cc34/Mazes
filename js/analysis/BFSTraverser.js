// Traversal strategy that computes the shortest distance
// from a start cell to every reachable cell using BFS.
//
// Returns a Map<Cell, distance> where distance is the number
// of passages walked to reach it.
//
// To add a new algorithm (A*, DFS, Dijkstra), create a new
// class with the same traverse() signature and pass it to DistanceMap.
export default class BFSTraverser {
  // Walks the maze from startCell using BFS.
  // Only follows open passages (walls that are false).
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
