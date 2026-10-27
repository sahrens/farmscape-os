import { useState } from 'react';
import { useStore } from '@/lib/store';
import { useLocation } from 'wouter';
import farmConfig from '@/farm.config';
import type { FarmConfig } from '@/farm.config';

type FarmEvent = NonNullable<FarmConfig['events']>[number];

interface LightboxState {
  photos: string[];
  title: string;
  idx: number;
}

/**
 * Events page — members-only (all logged-in users).
 *
 * Fully config-driven: this open-source repo ships no events. Each
 * deployment defines its events in its local farm config (`events` in
 * `src/farms/local.config.ts`) and supplies the photo / program files
 * under its own `public/events/` directory (never committed here).
 */
export default function Events() {
  const user = useStore(s => s.user);
  const [, setLocation] = useLocation();
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  // Redirect to home if not logged in
  if (!user) {
    setLocation('/');
    return null;
  }

  const events = farmConfig.events ?? [];

  return (
    <div className="flex-1 overflow-y-auto bg-earth-900 text-earth-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-forest-300 mb-2">
            Events
          </h1>
          <p className="text-sm text-earth-400 mt-1">{farmConfig.name}</p>
        </header>

        {events.length === 0 && (
          <p className="text-center text-earth-400 text-sm leading-relaxed max-w-2xl mx-auto">
            No events have been published yet. Event galleries are supplied by
            this farm&rsquo;s deployment: add an{' '}
            <code className="bg-earth-800 px-1.5 py-0.5 rounded text-earth-200">events</code>{' '}
            section to the local farm config and place photo and program files
            in the deployment&rsquo;s{' '}
            <code className="bg-earth-800 px-1.5 py-0.5 rounded text-earth-200">public/events/</code>{' '}
            directory.
          </p>
        )}

        {events.map((event) => (
          <EventSection
            key={event.title}
            event={event}
            onOpen={(photos, idx) => setLightbox({ photos, title: event.title, idx })}
          />
        ))}

        {/* Lightbox */}
        {lightbox !== null && (
          <div
            className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
            onClick={() => setLightbox(null)}
          >
            {/* Close button */}
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl font-light z-10"
            >
              &times;
            </button>
            {/* Prev */}
            {lightbox.idx > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, idx: lightbox.idx - 1 }); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl font-light z-10"
              >
                &#8249;
              </button>
            )}
            {/* Next */}
            {lightbox.idx < lightbox.photos.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, idx: lightbox.idx + 1 }); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl font-light z-10"
              >
                &#8250;
              </button>
            )}
            {/* Image */}
            <img
              src={lightbox.photos[lightbox.idx]}
              alt={`${lightbox.title} photo ${lightbox.idx + 1}`}
              className="max-h-[90vh] max-w-[90vw] object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
            {/* Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
              {lightbox.idx + 1} / {lightbox.photos.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EventSection({
  event,
  onOpen,
}: {
  event: FarmEvent;
  onOpen: (photos: string[], idx: number) => void;
}) {
  const photos = event.photos ?? [];

  return (
    <section className="mb-12">
      {/* Header */}
      <header className="mb-6 text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-forest-300 mb-2">
          {event.title}
        </h2>
        {event.subtitle && (
          <p className="text-lg text-earth-300">{event.subtitle}</p>
        )}
        {event.description && (
          <p className="text-sm text-earth-400 mt-1 max-w-2xl mx-auto leading-relaxed">
            {event.description}
          </p>
        )}
      </header>

      {/* Program PDF download */}
      {event.programPdf && (
        <div className="flex justify-center mb-8">
          <a
            href={event.programPdf}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-forest-700 hover:bg-forest-600 text-white text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {event.programLabel ?? 'View Program (PDF)'}
          </a>
        </div>
      )}

      {/* Photo Gallery Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
          {photos.map((photo, idx) => (
            <button
              key={photo}
              onClick={() => onOpen(photos, idx)}
              className="relative aspect-[3/4] overflow-hidden rounded-lg bg-earth-800 hover:ring-2 hover:ring-forest-500 transition-all cursor-pointer group"
            >
              <img
                src={photo}
                alt={`${event.title} photo ${idx + 1}`}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
