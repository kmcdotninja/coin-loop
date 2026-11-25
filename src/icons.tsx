import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const ChevronUpDown = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 6l3-3 3 3M5 10l3 3 3-3" />
  </svg>
);
export const Plus = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 3v10M3 8h10" />
  </svg>
);
