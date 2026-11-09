import type { SVGProps } from "react";

/** Icônes SVG maison (trait 1.8, 24×24), sans dépendance externe. */
type P = SVGProps<SVGSVGElement> & { size?: number };
const base = ({ size = 20, ...p }: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const IconHome = (p: P) => (<svg {...base(p)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h5v-6h4v6h5V9.5" /></svg>);
export const IconSparkle = (p: P) => (<svg {...base(p)}><path d="M12 3l1.8 4.9L19 9.5l-5.2 1.7L12 16l-1.8-4.8L5 9.5l5.2-1.6z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>);
export const IconGrid = (p: P) => (<svg {...base(p)}><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></svg>);
export const IconLong = (p: P) => (<svg {...base(p)}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M10 9.5v5l4-2.5z" fill="currentColor" stroke="none" /><path d="M6 21.5h12" /></svg>);
export const IconCar = (p: P) => (<svg {...base(p)}><path d="M3 15.5v-3l2-5.2A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.3l2 5.2v3a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 15.5z" /><path d="M3.5 12h17" /><circle cx="7" cy="17" r="1.8" /><circle cx="17" cy="17" r="1.8" /></svg>);
export const IconMoto = (p: P) => (<svg {...base(p)}><circle cx="5.5" cy="16.5" r="3.5" /><circle cx="18.5" cy="16.5" r="3.5" /><path d="M5.5 16.5 9 10h5l2 6.5" /><path d="M14 10l1.5-3H18" /><path d="M9 10 7.5 7.5H5" /></svg>);
export const IconPlane = (p: P) => (<svg {...base(p)}><path d="M10.5 3.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5V9l8 4.5V16l-8-2.5V18l2.5 2v1.5L12 20.5l-4 1V20l2.5-2v-4.5L2.5 16v-2.5l8-4.5z" /></svg>);
export const IconBoat = (p: P) => (<svg {...base(p)}><path d="M3 14h18l-2.5 4.5a2 2 0 0 1-1.8 1H7.3a2 2 0 0 1-1.8-1z" /><path d="M6 14V9h9l3 5" /><path d="M9 9V5.5h3V9" /><path d="M2 21.5c1.5 0 1.5-.8 3-.8s1.5.8 3 .8 1.5-.8 3-.8 1.5.8 3 .8 1.5-.8 3-.8 1.5.8 3 .8" /></svg>);
export const IconRocket = (p: P) => (<svg {...base(p)}><path d="M12 2.5c3 2 4.5 5.5 4.5 9.5v4h-9v-4c0-4 1.5-7.5 4.5-9.5z" /><circle cx="12" cy="9.5" r="1.6" /><path d="M7.5 13 4.5 16v3l3-1.5M16.5 13l3 3v3l-3-1.5" /><path d="M10.5 19.5 12 22l1.5-2.5" /></svg>);
export const IconCog = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>);
export const IconPiston = (p: P) => (<svg {...base(p)}><rect x="7" y="3" width="10" height="7" rx="1.5" /><path d="M7 6h10" /><path d="M12 10v4" /><circle cx="12" cy="16.5" r="2.5" /><path d="M12 19v2.5" /></svg>);
export const IconCompass = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></svg>);
export const IconStar = (p: P) => (<svg {...base(p)}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></svg>);
export const IconHeart = ({ filled, ...p }: P & { filled?: boolean }) => (<svg {...base(p)} fill={filled ? "currentColor" : "none"}><path d="M12 20.5s-7.5-4.6-9.3-9.4C1.6 8 3.5 4.5 7 4.5c2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.5 0 5.4 3.5 4.3 6.6-1.8 4.8-9.3 9.4-9.3 9.4z" /></svg>);
export const IconHistory = (p: P) => (<svg {...base(p)}><path d="M3 12a9 9 0 1 0 2.6-6.4" /><path d="M3 4v4.5h4.5" /><path d="M12 7.5V12l3 2" /></svg>);
export const IconClock = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>);
export const IconFolder = (p: P) => (<svg {...base(p)}><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" /></svg>);
export const IconList = (p: P) => (<svg {...base(p)}><path d="M4 6h11M4 12h11M4 18h7" /><path d="m17 15 4 2.5-4 2.5z" fill="currentColor" stroke="none" /></svg>);
export const IconSettings = IconCog;
export const IconSearch = (p: P) => (<svg {...base(p)}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.8-4.8" /></svg>);
export const IconSun = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
export const IconMoon = (p: P) => (<svg {...base(p)}><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" /></svg>);
export const IconMenu = (p: P) => (<svg {...base(p)}><path d="M4 6.5h16M4 12h16M4 17.5h16" /></svg>);
export const IconX = (p: P) => (<svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const IconPlay = (p: P) => (<svg {...base(p)}><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none" /></svg>);
export const IconExternal = (p: P) => (<svg {...base(p)}><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V7.5A1.5 1.5 0 0 1 5.5 6H10" /></svg>);
export const IconShare = (p: P) => (<svg {...base(p)}><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" /></svg>);
export const IconCheck = (p: P) => (<svg {...base(p)}><path d="m4.5 12.5 4.5 4.5 10.5-11" /></svg>);
export const IconGlobe = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></svg>);
export const IconChevron = (p: P) => (<svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>);
export const IconFilter = (p: P) => (<svg {...base(p)}><path d="M4 6h16M7 12h10M10 18h4" /></svg>);
export const IconInfo = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.5v.5" /></svg>);
export const IconFlag = (p: P) => (<svg {...base(p)}><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></svg>);
export const IconPlus = (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconEyeOff = (p: P) => (<svg {...base(p)}><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c5.5 0 9 7 9 7a16.5 16.5 0 0 1-3.2 4M6.6 6.6C4 8.3 3 12 3 12s3.5 7 9 7a9.6 9.6 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>);
export const IconTag = (p: P) => (<svg {...base(p)}><path d="M3 12V4.5A1.5 1.5 0 0 1 4.5 3H12l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.3" /></svg>);

export { Logo } from "./brand/logo";

export const UNIVERSE_ICONS: Record<string, (p: P) => React.JSX.Element> = {
  automobile: IconCar,
  moto: IconMoto,
  aviation: IconPlane,
  nautisme: IconBoat,
  "autres-vehicules": IconRocket,
};
