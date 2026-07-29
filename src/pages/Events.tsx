import { useState } from 'react';
import { useStore } from '@/lib/store';
import { useLocation } from 'wouter';
import farmConfig from '@/farm.config';

/**
 * List of ceremony photos served from /events/ in the public directory.
 * Order is intentional — curated sequence for the gallery.
 */
const CEREMONY_PHOTOS = [
  'IMG_7186.jpeg',
  'IMG_7189.jpeg',
  'IMG_7193.jpeg',
  'IMG_7205.jpeg',
  'IMG_7213.jpeg',
  'IMG_7218.jpeg',
  '4413c6c8-6878-475b-a720-df2a26a54992.jpeg',
  'e6592ac0-832d-4544-be5a-183ab1d3f4fc.jpeg',
  'ee24d4d6-3f57-4bea-a7f3-1197e23e0c2f.jpeg',
  '84b29c31-9b63-4490-8c31-ed80670a38f4.jpeg',
  '23b95b86-0d5c-4eb7-beed-c39063768e9a.jpeg',
  '6256f4ca-77d2-4ae8-920d-572bff6fe83f.jpeg',
  '86871326-be0e-4e30-9b8c-f3293f2cd92e.jpeg',
];

const PROGRAM_PDF = '/events/ceremony_booklet_v6_short_edge.pdf';

/**
 * Events page — members-only (all logged-in users).
 * Shows the ʻAha Hoʻolaʻa ʻĀina ceremony with photo gallery and program PDF.
 */
export default function Events() {
  const user = useStore(s => s.user);
  const [, setLocation] = useLocation();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Redirect to home if not logged in
  if (!user) {
    setLocation('/');
    return null;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-earth-900 text-earth-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-forest-300 mb-2">
            ʻAha Hoʻolaʻa ʻĀina
          </h1>
          <p className="text-lg text-earth-300">
            Spencer &amp; Eva Kalihiwai
          </p>
          <p className="text-sm text-earth-400 mt-1">
            Land Blessing Ceremony — {farmConfig.name}
          </p>
        </header>

        {/* Program PDF download */}
        <div className="flex justify-center mb-8">
          <a
            href={PROGRAM_PDF}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-forest-700 hover:bg-forest-600 text-white text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Ceremony Program (PDF)
          </a>
        </div>

        {/* Photo Gallery Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
          {CEREMONY_PHOTOS.map((photo, idx) => (
            <button
              key={photo}
              onClick={() => setLightboxIdx(idx)}
              className="relative aspect-[3/4] overflow-hidden rounded-lg bg-earth-800 hover:ring-2 hover:ring-forest-500 transition-all cursor-pointer group"
            >
              <img
                src={`/events/${photo}`}
                alt={`Ceremony photo ${idx + 1}`}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </button>
          ))}
        </div>

        {/* Lightbox */}
        {lightboxIdx !== null && (
          <div
            className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
            onClick={() => setLightboxIdx(null)}
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxIdx(null)}
              className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl font-light z-10"
            >
              &times;
            </button>
            {/* Prev */}
            {lightboxIdx > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl font-light z-10"
              >
                &#8249;
              </button>
            )}
            {/* Next */}
            {lightboxIdx < CEREMONY_PHOTOS.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl font-light z-10"
              >
                &#8250;
              </button>
            )}
            {/* Image */}
            <img
              src={`/events/${CEREMONY_PHOTOS[lightboxIdx]}`}
              alt={`Ceremony photo ${lightboxIdx + 1}`}
              className="max-h-[90vh] max-w-[90vw] object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
            {/* Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
              {lightboxIdx + 1} / {CEREMONY_PHOTOS.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
