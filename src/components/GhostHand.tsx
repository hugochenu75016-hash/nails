interface GhostHandProps {
  good?: boolean;
  className?: string;
}

const FINGERS = [
  { key: "thumb", cx: 378, cy: 690, angle: -58, w: 84, len: 235 },
  { key: "index", cx: 432, cy: 545, angle: -16, w: 66, len: 300 },
  { key: "middle", cx: 500, cy: 530, angle: -3, w: 68, len: 335 },
  { key: "ring", cx: 568, cy: 538, angle: 10, w: 64, len: 310 },
  { key: "pinky", cx: 628, cy: 565, angle: 23, w: 54, len: 245 },
];

/** A translucent, gently animated outline of a spread hand, overlaid on the
 * live camera feed as a placement guide during the scan step. Turns green
 * once the detected pose matches it. */
export default function GhostHand({ good = false, className }: GhostHandProps) {
  const color = good ? "#22c55e" : "#ffffff";
  const strokeProps = {
    fill: "none",
    stroke: color,
    strokeWidth: 4,
    strokeDasharray: "10 8",
  };

  return (
    <svg viewBox="0 0 1000 1220" className={className} aria-hidden="true">
      <g
        className="animate-[ghost-pulse_2.6s_ease-in-out_infinite]"
        style={{ transformOrigin: "500px 600px", transformBox: "view-box" }}
      >
        <g
          className="animate-[ghost-spread_2.6s_ease-in-out_infinite]"
          style={{ transformOrigin: "500px 600px", transformBox: "view-box" }}
        >
          {FINGERS.map((f) => (
            <g key={f.key} transform={`translate(${f.cx},${f.cy}) rotate(${f.angle})`}>
              <rect
                x={-f.w / 2}
                y={-f.len}
                width={f.w}
                height={f.len}
                rx={f.w / 2}
                ry={f.w / 2}
                opacity={0.6}
                {...strokeProps}
              />
            </g>
          ))}
        </g>
        <rect x="392" y="545" width="240" height="330" rx="95" ry="95" opacity={0.6} {...strokeProps} />
        <rect x="440" y="820" width="144" height="150" rx="30" ry="30" opacity={0.45} {...strokeProps} />
      </g>
    </svg>
  );
}
