import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type PoseIssue =
  | "no-hand"
  | "too-far"
  | "too-close"
  | "off-center"
  | "fingers-together"
  | "good";

export const POSE_MESSAGES: Record<PoseIssue, string> = {
  "no-hand": "Montre ta main, paume face à la caméra",
  "too-far": "Rapproche ta main de la caméra",
  "too-close": "Éloigne un peu ta main",
  "off-center": "Centre ta main dans le cadre",
  "fingers-together": "Écarte davantage les doigts",
  good: "Parfait, ne bouge plus…",
};

const TIP_INDICES = [4, 8, 12, 16, 20];
const MIN_SPREAD_DEG = 7;
const MIN_HAND_FRACTION = 0.35;
const MAX_HAND_FRACTION = 0.85;
const CENTER_BOX = { xMin: 0.25, xMax: 0.75, yMin: 0.2, yMax: 0.9 };

function angleDeg(
  center: { x: number; y: number },
  a: NormalizedLandmark,
  b: NormalizedLandmark
) {
  const v1 = { x: a.x - center.x, y: a.y - center.y };
  const v2 = { x: b.x - center.x, y: b.y - center.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag = (Math.hypot(v1.x, v1.y) || 1) * (Math.hypot(v2.x, v2.y) || 1);
  const cos = Math.min(1, Math.max(-1, dot / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Evaluates a single frame's hand landmarks against the conditions we
 * need for a reliable nail-width scan: hand present, at a sensible
 * distance, centered, with fingers spread apart. Returns the single
 * most relevant issue to show the user (or "good"). */
export function assessPose(
  landmarks: NormalizedLandmark[] | undefined
): PoseIssue {
  if (!landmarks || landmarks.length === 0) return "no-hand";

  const xs = landmarks.map((l) => l.x);
  const ys = landmarks.map((l) => l.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const heightFrac = maxY - minY;

  if (heightFrac < MIN_HAND_FRACTION) return "too-far";
  if (heightFrac > MAX_HAND_FRACTION) return "too-close";

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  if (
    cx < CENTER_BOX.xMin ||
    cx > CENTER_BOX.xMax ||
    cy < CENTER_BOX.yMin ||
    cy > CENTER_BOX.yMax
  ) {
    return "off-center";
  }

  const palmCenter = { x: (landmarks[0].x + landmarks[9].x) / 2, y: (landmarks[0].y + landmarks[9].y) / 2 };
  for (let i = 1; i < TIP_INDICES.length - 1; i++) {
    const a = landmarks[TIP_INDICES[i]];
    const b = landmarks[TIP_INDICES[i + 1]];
    if (angleDeg(palmCenter, a, b) < MIN_SPREAD_DEG) return "fingers-together";
  }

  return "good";
}
