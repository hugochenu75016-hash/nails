import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type FingerName =
  | "Pouce"
  | "Index"
  | "Majeur"
  | "Annulaire"
  | "Auriculaire";

/**
 * MediaPipe Hand landmark indices: for each finger, the joint just before
 * the tip (DIP, or IP for the thumb) and the tip itself. The segment
 * between them is used to find the finger's direction and a measurement
 * point roughly over the nail.
 */
export const FINGERS: { name: FingerName; dip: number; tip: number }[] = [
  { name: "Pouce", dip: 3, tip: 4 },
  { name: "Index", dip: 7, tip: 8 },
  { name: "Majeur", dip: 11, tip: 12 },
  { name: "Annulaire", dip: 15, tip: 16 },
  { name: "Auriculaire", dip: 19, tip: 20 },
];

export interface FingerMeasurement {
  name: FingerName;
  widthPx: number;
  confident: boolean;
  midPx: { x: number; y: number };
}

interface Point {
  x: number;
  y: number;
}

function toPixel(l: NormalizedLandmark, width: number, height: number): Point {
  return { x: l.x * width, y: l.y * height };
}

function sampleAt(data: Uint8ClampedArray, width: number, height: number, x: number, y: number) {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= width || yi >= height) return null;
  const i = (yi * width + xi) * 4;
  return [data[i], data[i + 1], data[i + 2]] as const;
}

function averagePatch(
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
function scanToEdge(
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

/**
 * Estimates each finger's width in pixels by scanning perpendicular to the
 * finger direction, near the tip, until the skin-tone color departs
 * (finger/background edge). This is a lightweight V1 heuristic, not a
 * trained segmentation model — accuracy depends on lighting and background
 * contrast.
 */
export function measureFingerWidths(
  imageData: ImageData,
  landmarks: NormalizedLandmark[],
  maxScanPx: number,
  threshold = 45
): FingerMeasurement[] {
  const { data, width, height } = imageData;

  return FINGERS.map(({ name, dip, tip }) => {
    const dipPx = toPixel(landmarks[dip], width, height);
    const tipPx = toPixel(landmarks[tip], width, height);

    const dx = tipPx.x - dipPx.x;
    const dy = tipPx.y - dipPx.y;
    const len = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / len, y: dy / len };
    const perp = { x: -dir.y, y: dir.x };

    const midPx = { x: (dipPx.x + tipPx.x) / 2, y: (dipPx.y + tipPx.y) / 2 };

    const refColor = averagePatch(data, width, height, midPx);
    if (!refColor) {
      return { name, widthPx: 0, confident: false, midPx };
    }

    const pos = scanToEdge(data, width, height, midPx, perp, refColor, maxScanPx, threshold);
    const neg = scanToEdge(
      data,
      width,
      height,
      midPx,
      { x: -perp.x, y: -perp.y },
      refColor,
      maxScanPx,
      threshold
    );

    return {
      name,
      widthPx: pos.dist + neg.dist,
      confident: pos.confident && neg.confident,
      midPx,
    };
  });
}
