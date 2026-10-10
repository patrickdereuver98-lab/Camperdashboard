/**
 * Gegenereerd landschap als vervanging voor (nog) ontbrekende foto's.
 * Deterministisch per `seed`, zodat elke plek altijd hetzelfde "plaatje" heeft.
 */

const SKIES = [
  // dageraad
  {
    top: "#f1d3b8",
    bottom: "#f8eadb",
    sun: "#e59a63",
    hills: ["#c3cdb0", "#97ad84", "#66845b", "#3f5f42"],
  },
  // middag
  {
    top: "#c9ddd6",
    bottom: "#eef1e4",
    sun: "#f3dfaa",
    hills: ["#b2c6a7", "#86a47f", "#5a7d58", "#35583d"],
  },
  // avond
  {
    top: "#dfb19a",
    bottom: "#f1d4bf",
    sun: "#d26e45",
    hills: ["#b3a495", "#8a7c6c", "#5d5f4d", "#323e34"],
  },
  // nevel
  {
    top: "#d6dcd4",
    bottom: "#ece9df",
    sun: "#f5efe0",
    hills: ["#bcc6b8", "#9aab95", "#71876c", "#4a6249"],
  },
];

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++)
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function hill(
  rand: () => number,
  base: number,
  amp: number,
  w: number,
  h: number,
) {
  const n = 5;
  const phase = rand() * Math.PI * 2;
  const freq = 0.8 + rand() * 1.4;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const x = (i / n) * w;
    const y =
      base -
      amp *
        (0.55 + 0.45 * Math.sin(phase + (i / n) * Math.PI * freq)) *
        (0.7 + rand() * 0.6);
    return [x, y] as const;
  });
  let d = `M0 ${h} L0 ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const mx = (x0 + x1) / 2;
    d += ` C${mx.toFixed(1)} ${y0.toFixed(1)} ${mx.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return { d: `${d} L${w} ${h} Z`, pts };
}

export function Landscape({
  seed,
  water,
  variant,
  van,
  wide,
  className,
}: {
  seed: string;
  water?: boolean;
  variant?: 0 | 1 | 2 | 3;
  van?: boolean;
  /** Brede banner: snijd de bovenste lucht weg zodat heuvels én water zichtbaar blijven. */
  wide?: boolean;
  className?: string;
}) {
  const W = 400;
  const H = 240;
  const rand = rng(seed);
  const sky = SKIES[variant ?? Math.floor(rand() * SKIES.length)];
  const id = `ls-${seed.replace(/[^a-z0-9]/gi, "").slice(0, 24)}-${variant ?? "r"}`;
  const sunX = 60 + rand() * 280;
  const sunY = wide ? 100 + rand() * 12 : 55 + rand() * 45;
  const sunR = 16 + rand() * 14;
  const waterTop = water ? 196 : H;

  const layers = sky.hills.map((color, i) => {
    const base = (water ? 120 : 130) + i * (water ? 22 : 28);
    return {
      color,
      ...hill(rand, Math.min(base, waterTop + 6), 46 - i * 8, W, waterTop + 8),
    };
  });

  const near = layers[layers.length - 1];
  const trees = Array.from({ length: 3 + Math.floor(rand() * 5) }, () => {
    const t = 0.05 + rand() * 0.9;
    const seg = Math.min(
      near.pts.length - 2,
      Math.floor(t * (near.pts.length - 1)),
    );
    const [x0, y0] = near.pts[seg];
    const [x1, y1] = near.pts[seg + 1];
    const f = t * (near.pts.length - 1) - seg;
    const s = 10 + rand() * 12;
    return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f + 6, s };
  });
  const vanX = 120 + rand() * 160;

  return (
    <svg
      viewBox={wide ? `0 70 ${W} ${H - 70}` : `0 0 ${W} ${H}`}
      preserveAspectRatio={wide ? "xMidYMid slice" : "xMidYMax slice"}
      className={className}
      role="img"
      data-landscape=""
      aria-label="Illustratie van een landschap"
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={sky.top} />
          <stop offset="1" stopColor={sky.bottom} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}-sky)`} />
      <circle cx={sunX} cy={sunY} r={sunR} fill={sky.sun} opacity="0.9" />
      {layers.map((l, i) => (
        <path key={i} d={l.d} fill={l.color} />
      ))}
      {trees.map((t, i) => (
        <path
          key={i}
          d={`M${t.x} ${t.y - t.s * 2} L${t.x + t.s * 0.55} ${t.y} L${t.x - t.s * 0.55} ${t.y} Z`}
          fill={sky.hills[3]}
        />
      ))}
      {van && (
        <g
          transform={`translate(${vanX} ${(water ? waterTop : 214) - 20})`}
          fill="#f7f1e4"
        >
          <path d="M0 6a4 4 0 0 1 4-4h22l8 7v9H0Z" />
          <rect
            x="4"
            y="5"
            width="7"
            height="5"
            rx="1"
            fill={sky.hills[3]}
            opacity="0.6"
          />
          <circle cx="7" cy="18" r="3" fill={sky.hills[3]} />
          <circle cx="26" cy="18" r="3" fill={sky.hills[3]} />
        </g>
      )}
      {water && (
        <g>
          <rect y={waterTop} width={W} height={H - waterTop} fill="#6f9ea6" />
          <rect y={waterTop} width={W} height="3" fill="#9cc0c4" />
          {Array.from({ length: 5 }, (_, i) => (
            <rect
              key={i}
              x={(i * 83 + sunX) % W}
              y={waterTop + 10 + (i % 3) * 9}
              width={30 + (i % 2) * 24}
              height="1.6"
              rx="1"
              fill="#d6e6e4"
              opacity="0.7"
            />
          ))}
        </g>
      )}
    </svg>
  );
}
