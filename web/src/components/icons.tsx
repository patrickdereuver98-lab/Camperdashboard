import type { SVGProps } from "react";

const PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20.5 20.5-4.5-4.5" /></>,
  map: <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4ZM9 4v14M15 6v14" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  pin: <><path d="M19.5 10c0 5-5.6 10.2-7.5 11.8a.8.8 0 0 1-1 0C9.1 20.2 4.5 15 4.5 10a7.5 7.5 0 0 1 15 0Z" /><circle cx="12" cy="10" r="2.6" /></>,
  heart: <path d="M19.4 13.6c1.5-1.5 2.6-3.2 2.6-5.1A5 5 0 0 0 17 3.5c-1.8 0-3.2.8-5 2.6-1.8-1.8-3.2-2.6-5-2.6a5 5 0 0 0-5 5c0 1.9 1.1 3.6 2.6 5.1L12 21Z" />,
  route: <><circle cx="6" cy="19" r="2.5" /><path d="M8.5 19h8.5a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5" /><circle cx="18" cy="5" r="2.5" /></>,
  phone: <path d="M21.5 16.4v3a2 2 0 0 1-2.2 2 19.6 19.6 0 0 1-8.6-3.1 19.3 19.3 0 0 1-6-6A19.6 19.6 0 0 1 1.6 3.7 2 2 0 0 1 3.6 1.5h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.6 9.4a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />,
  globe: <><circle cx="12" cy="12" r="9.5" /><path d="M12 2.5a14.5 14.5 0 0 0 0 19 14.5 14.5 0 0 0 0-19M2.5 12h19" /></>,
  mail: <><rect x="2.5" y="4.5" width="19" height="15" rx="2" /><path d="m3 6 9 7 9-7" /></>,
  clock: <><circle cx="12" cy="12" r="9.5" /><path d="M12 6.5V12l3.5 2" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  arrowLeft: <path d="M19 12H5m6-7-7 7 7 7" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m18 15-6-6-6 6" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  locate: <><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /></>,
  sliders: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2.2" /><circle cx="9" cy="17" r="2.2" /></>,
  sort: <path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4m-3.5 3.5L17 4l3.5 3.5" />,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 13.3 7.6 4.4M15.8 6.3l-7.6 4.4" /></>,
  external: <path d="M14 3.5h6.5V10M10 14 20.5 3.5M18 13.5v6a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 3 19.5v-12A1.5 1.5 0 0 1 4.5 6h6" />,
  info: <><circle cx="12" cy="12" r="9.5" /><path d="M12 16.5v-5M12 8h.01" /></>,
  alert: <><path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4.5M12 17h.01" /></>,
  trash: <path d="M3.5 6h17M8.5 6V4.5A1.5 1.5 0 0 1 10 3h4a1.5 1.5 0 0 1 1.5 1.5V6m3 0-.8 13.1a2 2 0 0 1-2 1.9H8.3a2 2 0 0 1-2-1.9L5.5 6" />,
  grip: <path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01" />,
  star: <path d="m12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9Z" />,
  fuel: <path d="M3.5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M2.5 21h13M14.5 10h2a2 2 0 0 1 2 2v4.5a1.5 1.5 0 0 0 3 0V8.2a2 2 0 0 0-.6-1.4L18 4M6.5 8h5" />,
  help: <><circle cx="12" cy="12" r="9.5" /><path d="M9.2 9a3 3 0 0 1 5.8 1c0 2-3 2.8-3 2.8M12 17h.01" /></>,
  menu: <path d="M3.5 6h17M3.5 12h17M3.5 18h17" />,
  home: <path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1Z" />,
  inbox: <path d="M21.5 12.5h-6l-2 3h-3l-2-3h-6M5.4 5.6 2.5 12.5V19a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-6.5l-2.9-6.9A2 2 0 0 0 16.7 4.5H7.3a2 2 0 0 0-1.9 1.1Z" />,
  chart: <path d="M3.5 3.5v17h17M8 16v-4M12.5 16V8M17 16v-6" />,
  log: <path d="M14.5 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14.5 2.5V8H20M8 13h8M8 17h5" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  edit: <path d="M12 20.5h8.5M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5l-4 1 1-4Z" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  refresh: <path d="M3 12a9 9 0 0 1 15.4-6.4L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.4 6.4L3 16m0 5v-5h5" />,
  database: <><ellipse cx="12" cy="5" rx="8.5" ry="3" /><path d="M3.5 5v14c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3V5M3.5 12c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3" /></>,
  shield: <path d="M12 21.5s8-3.5 8-9.5V5l-8-3-8 3v7c0 6 8 9.5 8 9.5Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  wifiOff: <path d="M2 2l20 20M8.5 16.4a4.8 4.8 0 0 1 5.6-.4M5 12.9a10 10 0 0 1 5.2-2.6M16.7 11.5a10 10 0 0 1 2.3 1.4M2 9a15 15 0 0 1 4.3-2.6M10.7 5.1A15 15 0 0 1 22 9M12 20h.01" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  filled,
  strokeWidth = 1.9,
  ...rest
}: { name: IconName; size?: number; filled?: boolean } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

/** Beeldmerk: een campingbord met camper */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#0f4c8a" />
      <rect x="1.6" y="1.6" width="28.8" height="28.8" rx="5.6" fill="none" stroke="#fff" strokeWidth="1.3" />
      <g transform="translate(4 5)">
        <path d="M2.5 7.4c0-.8.6-1.4 1.4-1.4h10.6c.5 0 .9.2 1.2.6l3.3 4.2h.9c1.1 0 2 .9 2 2v3.3c0 .5-.4.9-.9.9H19.6a2.4 2.4 0 0 0-4.7 0H9a2.4 2.4 0 0 0-4.7 0H3.4a.9.9 0 0 1-.9-.9Z" fill="#fff" />
        <path d="M14.6 8.2h-2.2v2.7h4.3Z M5 8.2h5.4v2.7H5Z" fill="#0f4c8a" />
        <circle cx="6.7" cy="17.4" r="1.9" fill="#fff" />
        <circle cx="17.3" cy="17.4" r="1.9" fill="#fff" />
      </g>
      <rect x="22" y="3.5" width="6.5" height="4" rx="1.2" fill="#ffc629" />
    </svg>
  );
}
