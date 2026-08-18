"use client";

import { useEffect, useState } from "react";
import type { FingerLabel } from "@/lib/fingerBox";

const FINGER_POSE: Record<
  FingerLabel,
  { cx: number; cy: number; angle: number; w: number; len: number }
> = {
  Pouce: { cx: 378, cy: 690, angle: -58, w: 84, len: 235 },
  Index: { cx: 432, cy: 545, angle: -16, w: 66, len: 300 },
  Majeur: { cx: 500, cy: 530, angle: -3, w: 68, len: 335 },
  Annulaire: { cx: 568, cy: 538, angle: 10, w: 64, len: 310 },
  Auriculaire: { cx: 628, cy: 565, angle: 23, w: 54, len: 245 },
};

interface HandCueProps {
  target: FingerLabel;
}

/** Brief tutorial overlay shown when a new finger's scan begins: a ghost
 * hand slides in and highlights, in green, exactly which finger to present
 * to the guide box. */
export default function HandCue({ target }: HandCueProps) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(raf1);
  }, []);

  const pose = FINGER_POSE[target];

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/75">
      <svg
        viewBox="0 0 1000 1220"
        className={`h-3/5 transition-all duration-500 ease-out ${
          entered ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
        }`}
      >
        <rect x="392" y="545" width="240" height="330" rx="95" ry="95" fill="#ffffff" opacity={0.3} />
        <rect x="440" y="820" width="144" height="150" rx="30" ry="30" fill="#ffffff" opacity={0.22} />
        <g transform={`translate(${pose.cx},${pose.cy}) rotate(${pose.angle})`}>
          <rect
            x={-pose.w / 2}
            y={-pose.len}
            width={pose.w}
            height={pose.len}
            rx={pose.w / 2}
            ry={pose.w / 2}
            fill="#22c55e"
          />
        </g>
      </svg>
      <p className="text-xl font-bold text-white">{target}</p>
    </div>
  );
}
