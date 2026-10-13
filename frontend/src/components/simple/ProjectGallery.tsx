import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { PROJECT_GALLERIES } from './projectGalleries';

/** A strip of project photos; click one to see it large and step through the rest. Renders nothing if the project has none. */
export const ProjectGallery: React.FC<{ projectCode: string }> = ({ projectCode }) => {
  const photos = PROJECT_GALLERIES[projectCode] ?? [];
  const [open, setOpen] = useState<number | null>(null);
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)), [photos.length]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step]);

  if (photos.length === 0) return null;
  return (
    <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Project photos">
      <h2 className="mb-3 text-base font-semibold text-slate-900">Project photos</h2>
      <ul className="flex gap-3 overflow-x-auto pb-2">
        {photos.map((p, i) => (
          <li key={p.src} className="shrink-0">
            <button onClick={() => setOpen(i)} className="block overflow-hidden rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" aria-label={`View photo: ${p.caption}`}>
              <img src={p.src} alt={p.caption} loading="lazy" className="h-36 w-auto object-cover transition-transform hover:scale-105" />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4" role="dialog" aria-modal="true" aria-label="Project photo" onClick={() => setOpen(null)}>
          <button aria-label="Close" onClick={() => setOpen(null)} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X className="h-5 w-5" /></button>
          {photos.length > 1 && <button aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); step(-1); }} className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><ChevronLeft className="h-6 w-6" /></button>}
          <figure className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <img src={photos[open].src} alt={photos[open].caption} className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain" />
            <figcaption className="mt-2 text-center text-sm text-white/90">{photos[open].caption} · {open + 1} of {photos.length}</figcaption>
          </figure>
          {photos.length > 1 && <button aria-label="Next photo" onClick={(e) => { e.stopPropagation(); step(1); }} className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><ChevronRight className="h-6 w-6" /></button>}
        </div>
      )}
    </section>
  );
};
