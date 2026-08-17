export type NailShape = "round" | "almond" | "square";

const SHAPE_PATHS: Record<NailShape, string> = {
  round: "M20,150 L20,70 Q20,10 60,10 Q100,10 100,70 L100,150 Z",
  almond: "M20,150 L20,90 Q22,28 60,8 Q98,28 100,90 L100,150 Z",
  square: "M20,150 L20,42 Q20,15 47,15 L73,15 Q100,15 100,42 L100,150 Z",
};

interface NailSwatchProps {
  id: string;
  shape: NailShape;
  colorFrom: string;
  colorTo?: string;
  className?: string;
}

export default function NailSwatch({
  id,
  shape,
  colorFrom,
  colorTo,
  className,
}: NailSwatchProps) {
  const gradId = `nail-grad-${id}`;
  return (
    <svg
      viewBox="0 0 120 160"
      className={className}
      role="img"
      aria-label="Aperçu du modèle"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorFrom} />
          <stop offset="100%" stopColor={colorTo ?? colorFrom} />
        </linearGradient>
        <clipPath id={`nail-clip-${id}`}>
          <path d={SHAPE_PATHS[shape]} />
        </clipPath>
      </defs>
      <path
        d={SHAPE_PATHS[shape]}
        fill={`url(#${gradId})`}
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="2"
      />
      <ellipse
        cx="45"
        cy="55"
        rx="22"
        ry="46"
        fill="white"
        opacity="0.16"
        clipPath={`url(#nail-clip-${id})`}
      />
    </svg>
  );
}
