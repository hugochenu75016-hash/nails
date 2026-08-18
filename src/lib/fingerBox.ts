import { averagePatch, scanToEdge } from "@/lib/edgeScan";

export const FINGER_ORDER = [
  "Pouce",
  "Index",
  "Majeur",
  "Annulaire",
  "Auriculaire",
] as const;
export type FingerLabel = (typeof FINGER_ORDER)[number];

/** The guide box, as a fraction of the video frame — the client centers
 * one finger inside it at a time, close to the camera. */
export const BOX_WIDTH_FRAC = 0.4;
export const BOX_HEIGHT_FRAC = 0.55;

/** How far down from the top of the box we measure width — roughly where
 * the nail sits once the fingertip is aligned near the top of the box. */
export const MEASURE_LINE_FRAC = 0.28;

export const MIN_WIDTH_MM = 5;
export const MAX_WIDTH_MM = 28;

export interface BoxScanResult {
  widthPx: number;
  confident: boolean;
}

/** Scans a cropped ImageData containing exactly the guide box's pixels,
 * along a fixed horizontal line, from the center outward, looking for the
 * finger/background edges on each side. */
export function scanFingerBox(imageData: ImageData): BoxScanResult {
  const { data, width, height } = imageData;
  const center = { x: width / 2, y: height * MEASURE_LINE_FRAC };
  const ref = averagePatch(data, width, height, center);
  if (!ref) return { widthPx: 0, confident: false };

  const maxDist = width / 2 - 2;
  const right = scanToEdge(data, width, height, center, { x: 1, y: 0 }, ref, maxDist, 45);
  const left = scanToEdge(data, width, height, center, { x: -1, y: 0 }, ref, maxDist, 45);

  return {
    widthPx: left.dist + right.dist,
    confident: left.confident && right.confident,
  };
}
