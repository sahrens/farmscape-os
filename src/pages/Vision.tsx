import { useState, useRef, useCallback } from 'react';
import { marked } from 'marked';
import farmConfig from '@/farm.config';
import { DonationBanner } from '@/components/DonationBanner';

/**
 * Vision page — fully config-driven.
 *
 * This open-source repo ships no vision content. Each deployment supplies
 * its own through its local farm config (`vision` in
 * `src/farms/local.config.ts`): an optional markdown intro and optional
 * before/after comparison sliders. With no vision content configured, the
 * page renders the farm identity plus a short setup note.
 */

interface ComparisonSlide {
  title: string;
  desc: string;
  before: string;
  after: string;
}

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

/** Derive a /docs route slug from a markdown file path (generic). */
function docSlug(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.md$/, '').replace(/_+/g, '-').toLowerCase();
}

/** Render config-supplied markdown, normalizing relative asset/doc links. */
function renderMarkdown(md: string): string {
  let rendered = marked.parse(md, { async: false, mangle: false, headerIds: false } as any) as unknown as string;
  // Fix relative image paths for Workers: ./assets/ -> /assets/ , ./concepts/ -> /concepts/, etc.
  rendered = rendered.replace(/src="\.\/assets\//g, 'src="/assets/').replace(/src="assets\//g, 'src="/assets/').replace(/src="\.\/concepts\//g, 'src="/concepts/').replace(/src="concepts\//g, 'src="/concepts/');
  // Fix relative doc links -> internal /docs/{slug} routes, preserving hash fragments
  const toDocRoute = (_: string, p: string, hash: string | undefined) =>
    `href="/docs/${docSlug(p)}${hash || ''}"`;
  rendered = rendered.replace(/href="\.\/docs\/([^"]+?\.md)(#[^"]*)?"/g, toDocRoute);
  rendered = rendered.replace(/href="docs\/([^"]+?\.md)(#[^"]*)?"/g, toDocRoute);
  // External https links open in new tab
  rendered = rendered.replace(/href="https:\/\//g, 'target="_blank" rel="noopener" href="https://');
  // Make tables horizontally scrollable on small screens
  rendered = rendered.replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>');
  return rendered;
}

function Vision() {
  const vision = farmConfig.vision;
  const comparisons: ComparisonSlide[] = vision?.comparisons ?? [];
  const introHtml = vision?.introMarkdown ? renderMarkdown(vision.introMarkdown) : null;
  const hasContent = introHtml !== null || comparisons.length > 0;

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
        {introHtml && (
          <article className="max-w-2xl mx-auto mt-6 text-left doc-content" dangerouslySetInnerHTML={{ __html: introHtml }} />
        )}
        {!hasContent && (
          <p className="max-w-2xl mx-auto mt-6 text-earth-400 text-sm leading-relaxed">
            No vision content has been configured for this farm yet. To add an
            introduction and before/after comparisons, provide a{' '}
            <code className="bg-earth-800 px-1.5 py-0.5 rounded text-earth-200">vision</code>{' '}
            section in your local farm config (
            <code className="bg-earth-800 px-1.5 py-0.5 rounded text-earth-200">src/farms/local.config.ts</code>
            ).
          </p>
        )}
      </div>

      {/* Comparison sliders */}
      {comparisons.length > 0 && (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-12">
          {comparisons.map((slide, i) => (
            <ComparisonSlider key={i} slide={slide} />
          ))}
        </div>
      )}

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
      <style>{`
        .doc-content {
          color: var(--color-earth-200, #d4c8b8);
          line-height: 1.7;
          font-size: 0.9rem;
        }
        .doc-content h1 {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-forest-300, #86c98a);
          margin: 0 0 1rem 0;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--color-earth-700, #3d3528);
        }
        .doc-content h2 {
          font-size: 1.2rem;
          font-weight: 600;
          color: var(--color-forest-300, #86c98a);
          margin: 2rem 0 0.75rem 0;
        }
        .doc-content h3 {
          font-size: 1.05rem;
          font-weight: 500;
          color: var(--color-earth-100, #f0e8dc);
          margin: 1.5rem 0 0.5rem 0;
        }
        .doc-content p { margin: 0.75rem 0; }
        .doc-content strong { color: var(--color-earth-100, #f0e8dc); }
        .doc-content hr { border: none; border-top: 1px solid var(--color-earth-700, #3d3528); margin: 2rem 0; }
        .doc-content ul { margin: 0.75rem 0; padding-left: 1.5rem; }
        .doc-content li { margin: 0.35rem 0; }
        .doc-content li::marker { color: var(--color-earth-500, #7a6f62); }
        .doc-content blockquote { border-left: 3px solid var(--color-forest-600, #4a7a3a); padding: 0.5rem 1rem; margin: 1rem 0; background: var(--color-earth-800, #2a2419); font-style: italic; color: var(--color-earth-200, #d4c8b8); }
        .doc-content a { color: var(--color-forest-300, #86c98a); text-decoration: underline; text-underline-offset: 2px; }
        .doc-content a:hover { color: var(--color-forest-200, #a8d5aa); }
        .doc-content img { max-width: 100%; border-radius: 8px; margin: 1rem 0; }
        .doc-content .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 1rem 0; border: 1px solid var(--color-earth-700, #3d3528); border-radius: 6px; }
        .doc-content table { border-collapse: collapse; font-size: 0.8rem; width: 100%; min-width: max-content; }
        .doc-content tr { border-bottom: 1px solid var(--color-earth-700, #3d3528); }
        .doc-content tr:last-child { border-bottom: none; }
        .doc-content th { padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; color: var(--color-earth-100, #f0e8dc); background: var(--color-earth-800, #2a2419); border-bottom: 2px solid var(--color-earth-600, #5a5044); white-space: nowrap; }
        .doc-content td { padding: 0.5rem 0.75rem; color: var(--color-earth-200, #d4c8b8); }
        .doc-content code { background: var(--color-earth-800, #2a2419); padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.8rem; }
        @media (max-width: 640px) { .doc-content { font-size: 0.85rem; } .doc-content h1 { font-size: 1.3rem; } .doc-content h2 { font-size: 1.1rem; } }
      `}</style>
    </div>
  );
}

export default Vision;
