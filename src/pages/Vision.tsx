import { useState, useRef, useCallback } from 'react';
import farmConfig from '@/farm.config';
import { DonationBanner } from '@/components/DonationBanner';

const CDN = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663345748967/Pm5jx5ySBXXcq8KhZzi9vg';

interface ComparisonSlide {
  title: string;
  desc: string;
  before: string;
  after: string;
}

const COMPARISONS: ComparisonSlide[] = [
  {
    title: 'Aerial View — Food Forest Canopy',
    desc: 'Breadfruit canopy with vanilla on living tutors, banana, and understory crops replace the open pasture. A drying shade for vanilla curing sits near the garage.',
    after: `${CDN}/concept-01_10aa161c.jpg`,
    before: `${CDN}/original-01_f4598322.jpg`,
  },
  {
    title: 'Mountain View — Breadfruit Orchard',
    desc: 'Organized rows of breadfruit and vanilla fill the foreground, framed by the dramatic Namahana mountains. The ranch house sits nestled among productive plantings.',
    after: `${CDN}/concept-02_a9866b1d.jpg`,
    before: `${CDN}/original-05_c698052a.jpg`,
  },
  {
    title: 'Cottage View — Immersive Food Forest',
    desc: 'Walking through the farm at eye level: breadfruit overhead, vanilla vines climbing tutor posts, taro and ginger below, with a rustic farm stand for fresh harvest.',
    after: `${CDN}/concept-03_9100d9e9.jpg`,
    before: `${CDN}/original-19_a7589699.jpg`,
  },
  {
    title: 'Guesthouse — Kitchen Garden & Vanilla Rows',
    desc: 'The guesthouse cottage surrounded by raised herb beds, vanilla on posts, and breadfruit canopy, with the mountains as a stunning backdrop.',
    after: `${CDN}/concept-04_d0ef9b66.jpg`,
    before: `${CDN}/original-25_b91e6e8d.jpg`,
  },
  {
    title: 'Aerial View — Three Mandala Gardens',
    desc: 'Kitchen garden near the house, market garden in the central pasture, and specialty garden near the vanilla shade house. Young breadfruit trees planted in curved rows between the mandalas.',
    after: `${CDN}/concept-05-mandala-aerial_3221d81a.jpg`,
    before: `${CDN}/original-01_f4598322.jpg`,
  },
  {
    title: 'Ground Level — Kitchen Garden Pagoda',
    desc: 'Standing inside the kitchen mandala: raised beds of lettuce, beets, carrots, and herbs radiating from a wooden pagoda, with Norfolk pines and Kauai mountains beyond.',
    after: `${CDN}/concept-06-mandala-ground_787170ae.jpg`,
    before: `${CDN}/original-05_c698052a.jpg`,
  },
  {
    title: 'Overhead — Market Garden Fountain',
    desc: 'Drone view of the 8-bed market mandala: baby greens, rainbow carrots, Japanese cucumbers, and beets radiating from a stone fountain, ringed by lemongrass and marigolds.',
    after: `${CDN}/concept-07-mandala-fountain_e6f32e09.jpg`,
    before: `${CDN}/original-01_f4598322.jpg`,
  },
];

function ComparisonSlider({ slide }: { slide: ComparisonSlide }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const dragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(pct);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  }, [updatePosition]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    updatePosition(e.clientX);
  }, [updatePosition]);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-amber-400">{slide.title}</h2>
      <p className="text-earth-400 text-sm leading-relaxed">{slide.desc}</p>
      <div
        ref={containerRef}
        className="relative w-full aspect-[4/3] rounded-xl overflow-hidden cursor-col-resize select-none touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          src={slide.after}
          alt="Vision"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${position}%` }}
        >
          <img
            src={slide.before}
            alt="Current"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100vw' }}
            draggable={false}
          />
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/80 shadow-lg"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7 4L3 10L7 16" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13 4L17 10L13 16" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur text-white text-xs px-2 py-1 rounded">
          Now
        </div>
        <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur text-white text-xs px-2 py-1 rounded">
          Vision
        </div>
      </div>
    </div>
  );
}

function Vision() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-earth-900 text-earth-100">
      {/* Hero */}
      <div className="text-center py-12 px-4 border-b border-earth-800">
        <h1 className="text-4xl font-bold text-amber-400 tracking-wide mb-2">
          {farmConfig.name}
        </h1>
        {farmConfig.subtitle && (
          <p className="text-earth-400 text-lg italic mb-2">{farmConfig.subtitle}</p>
        )}
        {farmConfig.address && (
          <p className="text-earth-500 text-sm">{farmConfig.address}</p>
        )}
        <p className="max-w-2xl mx-auto mt-6 text-earth-300 leading-relaxed">
          A vision for transforming 5 acres of former horse pasture into a thriving
          biodynamic agroforestry system anchored by vanilla and breadfruit, with layered
          permaculture plantings of banana, cacao, turmeric, taro, and more.
          Drag the slider to see the transformation.
        </p>
      </div>

      {/* Comparison sliders */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-12">
        {COMPARISONS.map((slide, i) => (
          <ComparisonSlider key={i} slide={slide} />
        ))}
      </div>

      {/* Donation */}
      <div className="max-w-3xl mx-auto px-4 pb-8">
        <DonationBanner />
      </div>

      <div className="text-center pb-8">
        <p className="text-earth-600 text-xs">
          Powered by{' '}
          <a
            href="https://github.com/sahrens/farmscape-os"
            className="text-earth-500 hover:text-earth-400 underline"
            target="_blank"
            rel="noopener"
          >
            FarmscapeOS
          </a>
        </p>
      </div>
    </div>
  );
}

export default Vision;
