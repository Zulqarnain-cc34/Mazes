// Builds boolean masks that determine which cells are included in the maze.
// mask[row][col] = true  → cell is included
// mask[row][col] = false → cell is excluded (EXCLUDED state)
//
// To add a new shape, add a new static method here.
export default class MaskBuilder {
  // Full grid — all cells included. Default, no shape constraint.
  static fullGrid(cols, rows) {
    return Array.from({ length: rows }, () => Array(cols).fill(true));
  }

  // Cross / plus shape centered on the grid.
  static cross(cols, rows) {
    const midC = Math.floor(cols / 2);
    const midR = Math.floor(rows / 2);
    const armW = Math.floor(cols * 0.22);

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

      const mean0    = sum0 / w0;
      const mean1    = (sumTotal - sum0) / w1;
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
  // Uses area sampling with perceptual luminance weights (0.299R + 0.587G + 0.114B).
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
