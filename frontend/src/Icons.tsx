import type { ReactNode } from "react";

const assets = {
  logo: "449f8.svg",
  home: "9dbac.svg",
  components: "4db5d.svg",
  chart: "d337d.svg",
  alerts: "2281c.svg",
  shield: "e960d.svg",
  shieldCheck: "889c7.svg",
  settings: "2b76b.svg",
  notification: "f1c8f.svg",
  plus: "721df.svg",
  arrow: "092c0.svg",
  check: "90c5b.svg",
  avatar: "bfe71.png",
  circle: "93ce4.svg",
  tooltip: "8f602.svg",
} as const;

export function Asset({
  name,
  className,
  alt = "",
}: {
  name: keyof typeof assets;
  className?: string;
  alt?: string;
}) {
  return <img className={className} src={`/assets/${assets[name]}`} alt={alt} />;
}

const glyphs: Record<string, ReactNode> = {
  cooler: (
    <>
      <path d="M12 2v20M4 7l16 10M4 17 20 7M9 4l3 3 3-3M9 20l3-3 3 3M4 11l4-1-1-4m13 7-4 1 1 4m-13-5 4 1-1 4m13-7-4-1 1-4" />
    </>
  ),
  valve: (
    <>
      <path d="M3 7v10l9-5-9-5Zm18 0v10l-9-5 9-5ZM12 12V4m-4 0h8" />
    </>
  ),
  pump: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M2 12h2m16 0h2m-12-4 6 4-6 4V8Z" />
    </>
  ),
  accumulator: (
    <>
      <rect x="7" y="3" width="10" height="17" rx="5" />
      <path d="M7 11h10m-5 9v2m-2-15h4" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6m-5 0v6L4.7 18a2 2 0 0 0 1.7 3h11.2a2 2 0 0 0 1.7-3L14 9V3M8 14h8" />
      <path d="M11 17h.01m3 1h.01" />
    </>
  ),
  activity: <path d="M2 12h5l3-7 4 14 3-7h5" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  right: <path d="m9 6 6 6-6 6" />,
  forward: <path d="M4 12h15m-6-6 6 6-6 6" />,
  back: <path d="M20 12H5m6 6-6-6 6-6" />,
  alert: (
    <>
      <path d="m10.3 4.9-7 12A2 2 0 0 0 5 20h14a2 2 0 0 0 1.7-3.1l-7-12a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4m0 3h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5m0-8h.01" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  filter: <path d="M4 7h16M7 12h10m-7 5h4" />,
  cube: <path d="m12 2 9 5v10l-9 5-9-5V7l9-5ZM3 7l9 5 9-5m-9 5v10M7 4.8l9 5" />,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />,
  cut: <path d="m12 2 9 5v10l-9 5-9-5V7l9-5ZM3 7l9 5 9-5m-9 5v10m-4-17 9 5v6" />,
  rotate: (
    <path d="M20 7v5h-5M4 17v-5h5m-4.8-1a8 8 0 0 1 13.2-4.6L20 9M4 15l2.4 2.6A8 8 0 0 0 19.8 13" />
  ),
  pause: <path d="M9 5v14m6-14v14" />,
  expand: <path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5" />,
  shrink: <path d="M4 9h5V4m11 5h-5V4M9 20v-5H4m11 5v-5h5" />,
  zoomIn: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5m-10-13v6m-3-3h6" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5m-13-10h6" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
    </>
  ),
  mouse: (
    <>
      <rect x="6.5" y="3" width="11" height="18" rx="5.5" />
      <path d="M12 6.5v4" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </>
  ),
  external: <path d="M13 5h6v6m0-6-8 8m5 0v6H5V8h6" />,
};

export function Icon({ name, size = 20 }: { name: keyof typeof glyphs; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyphs[name]}
    </svg>
  );
}
