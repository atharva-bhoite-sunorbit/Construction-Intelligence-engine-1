import React, { useState } from 'react';

const PALETTES = [['#1e3a5f', '#3b6ea5'], ['#14532d', '#3f8f5b'], ['#78350f', '#c2813b'], ['#312e81', '#6366a8'], ['#134e4a', '#3b9a93']];

/** The project photo; until one is added (frontend/public/projects), a calm building illustration in the project's own colour. */
export const ProjectCover: React.FC<{ name: string; src?: string | null; className?: string }> = ({ name, src, className = 'h-40' }) => {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img src={src} alt={`${name}`} onError={() => setBroken(true)} className={`${className} w-full object-cover`} style={{ objectPosition: '50% 22%' }} loading="lazy" />;
  }
  const hash = [...name].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  const [from, to] = PALETTES[hash % PALETTES.length];
  const towers = 3 + (hash % 3);
  return (
    <svg role="img" aria-label={`${name} (photo not added yet)`} viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice" className={`${className} w-full`}>
      <defs><linearGradient id={`g${hash}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient></defs>
      <rect width="400" height="160" fill={`url(#g${hash})`} />
      {Array.from({ length: towers }).map((_, i) => {
        const w = 44 + ((hash >> (i + 1)) % 20);
        const h = 70 + ((hash >> (i + 3)) % 60);
        const x = 40 + i * (320 / towers);
        return (
          <g key={i} opacity={0.88 - i * 0.1}>
            <rect x={x} y={160 - h} width={w} height={h} fill="#ffffff" fillOpacity="0.22" />
            {Array.from({ length: Math.floor(h / 14) }).map((__, r) => (
              <rect key={r} x={x + 6} y={160 - h + 6 + r * 14} width={w - 12} height="6" fill="#ffffff" fillOpacity="0.28" />
            ))}
          </g>
        );
      })}
    </svg>
  );
};
