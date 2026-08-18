export interface Point {
  x: number;
  y: number;
}

function sampleAt(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
) {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= width || yi >= height) return null;
  const i = (yi * width + xi) * 4;
  return [data[i], data[i + 1], data[i + 2]] as const;
}

export function averagePatch(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  center: Point,
  radius = 2
) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const c = sampleAt(data, width, height, center.x + dx, center.y + dy);
      if (c) {
        r += c[0];
        g += c[1];
        b += c[2];
        n++;
      }
    }
  }
  if (n === 0) return null;
  return [r / n, g / n, b / n] as const;
}

function colorDist(a: readonly number[], b: readonly number[]) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/** Walks outward from `start` along `dir` until the pixel color departs from
 * `refColor` for two consecutive steps (an edge), or `maxDist` is reached. */
export function scanToEdge(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  start: Point,
  dir: Point,
  refColor: readonly number[],
  maxDist: number,
  threshold: number
): { dist: number; confident: boolean } {
  let overCount = 0;
  for (let d = 1; d <= maxDist; d++) {
    const p = { x: start.x + dir.x * d, y: start.y + dir.y * d };
    const c = sampleAt(data, width, height, p.x, p.y);
    if (!c) return { dist: d, confident: false };
    if (colorDist(c, refColor) > threshold) {
      overCount++;
      if (overCount >= 2) return { dist: d - 1, confident: true };
    } else {
      overCount = 0;
    }
  }
  return { dist: maxDist, confident: false };
}
