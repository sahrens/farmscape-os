import { useState, useEffect } from 'react';
import { marked } from 'marked';
import { useStore } from '@/lib/store';
import * as api from '@/lib/api';

/**
 * AdminDocs — Generic admin-only document viewer.
 * Lists available docs from the API and renders selected markdown content.
 * Actual document content is provided by the private deployment repo — this
 * component contains NO sensitive content.
 */
export default function AdminDocs() {
  const user = useStore(s => s.user);
  const [docList, setDocList] = useState<{ slug: string; title: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    api.docs.list()
      .then(list => {
        setDocList(list);
        if (list.length > 0) setSelected(list[0].slug);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!selected) return;
    setContent(null);
    api.docs.get(selected)
      .then(res => setContent(res.content))
      .catch(err => setError(err.message));
  }, [selected]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-earth-900 text-earth-100">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <p className="text-earth-500">Admin access required.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-earth-900 text-earth-100">
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <p className="text-earth-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-earth-900 text-earth-100">
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <p className="text-sunset-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (docList.length === 0) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-earth-900 text-earth-100">
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <p className="text-earth-500">No documents available.</p>
        </div>
      </div>
    );
  }

  const rendered = content ? marked.parse(content, { async: false }) as string : '';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-earth-900 text-earth-100">
      <div className="max-w-3xl mx-auto px-4 py-6 pb-16">
        {/* Doc selector (if multiple docs) */}
        {docList.length > 1 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {docList.map(doc => (
              <button
                key={doc.slug}
                onClick={() => setSelected(doc.slug)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selected === doc.slug
                    ? 'bg-forest-600 text-white'
                    : 'text-earth-300 hover:bg-earth-700 hover:text-earth-100 border border-earth-700'
                }`}
              >
                {doc.title}
              </button>
            ))}
          </div>
        )}

        {/* Markdown content */}
        {content ? (
          <article
            className="doc-content"
            dangerouslySetInnerHTML={{ __html: rendered }}
          />
        ) : (
          <p className="text-earth-400 text-center">Loading document...</p>
        )}
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

        .doc-content p {
          margin: 0.75rem 0;
        }

        .doc-content strong {
          color: var(--color-earth-100, #f0e8dc);
        }

        .doc-content hr {
          border: none;
          border-top: 1px solid var(--color-earth-700, #3d3528);
          margin: 2rem 0;
        }

        .doc-content ul {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
        }

        .doc-content li {
          margin: 0.35rem 0;
        }

        .doc-content li::marker {
          color: var(--color-earth-500, #7a6f62);
        }

        /* Table wrapper for horizontal scroll on mobile */
        .doc-content table {
          display: block;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          margin: 1rem 0;
          border-collapse: collapse;
          font-size: 0.8rem;
          width: max-content;
          min-width: 100%;
        }

        .doc-content thead {
          display: table-header-group;
        }

        .doc-content tbody {
          display: table-row-group;
        }

        .doc-content tr {
          display: table-row;
          border-bottom: 1px solid var(--color-earth-700, #3d3528);
        }

        .doc-content th {
          display: table-cell;
          padding: 0.5rem 0.75rem;
          text-align: left;
          font-weight: 600;
          color: var(--color-earth-100, #f0e8dc);
          background: var(--color-earth-800, #2a2419);
          border-bottom: 2px solid var(--color-earth-600, #5a5044);
          white-space: nowrap;
        }

        .doc-content td {
          display: table-cell;
          padding: 0.5rem 0.75rem;
          color: var(--color-earth-200, #d4c8b8);
          border-bottom: 1px solid var(--color-earth-700, #3d3528);
        }

        .doc-content tr:hover td {
          background: var(--color-earth-800, #2a2419);
        }

        .doc-content code {
          background: var(--color-earth-800, #2a2419);
          padding: 0.15rem 0.4rem;
          border-radius: 3px;
          font-size: 0.8rem;
        }

        /* Mobile adjustments */
        @media (max-width: 640px) {
          .doc-content {
            font-size: 0.85rem;
          }
          .doc-content h1 {
            font-size: 1.3rem;
          }
          .doc-content h2 {
            font-size: 1.1rem;
          }
          .doc-content table {
            font-size: 0.75rem;
          }
          .doc-content th,
          .doc-content td {
            padding: 0.4rem 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
