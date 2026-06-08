import { useState, useEffect } from 'react';
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

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-earth-900 text-earth-100">
      <div className="max-w-3xl mx-auto px-4 py-6 pb-12">
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
          <div className="prose prose-invert prose-sm max-w-none
            prose-headings:text-forest-300
            prose-h1:text-xl prose-h1:font-bold prose-h1:mb-4
            prose-h2:text-lg prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-3
            prose-h3:text-base prose-h3:font-medium prose-h3:mt-6 prose-h3:mb-2
            prose-p:text-earth-200 prose-p:leading-relaxed
            prose-strong:text-earth-100
            prose-li:text-earth-200
            prose-table:text-sm
            prose-th:text-earth-300 prose-th:font-medium prose-th:border-earth-600 prose-th:px-3 prose-th:py-2
            prose-td:text-earth-200 prose-td:border-earth-700 prose-td:px-3 prose-td:py-2
            prose-hr:border-earth-700
          ">
            <div dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }} />
          </div>
        ) : (
          <p className="text-earth-400 text-center">Loading document...</p>
        )}
      </div>
    </div>
  );
}

/**
 * Minimal markdown-to-HTML converter.
 * Handles headings, bold, italic, code, lists, tables, and horizontal rules.
 */
function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  let html = '';
  let inTable = false;
  let inList = false;
  let headerRow = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      if (inTable) { html += '</tbody></table>'; inTable = false; }
      if (inList) { html += '</ul>'; inList = false; }
      html += '<hr />';
      continue;
    }

    // Table row
    if (line.trim().startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (cells.every(c => /^[-: ]+$/.test(c))) continue;

      if (!inTable) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<table><thead>';
        inTable = true;
        headerRow = true;
      }

      if (headerRow) {
        html += '<tr>' + cells.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
        headerRow = false;
      } else {
        html += '<tr>' + cells.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>';
      }
      continue;
    } else if (inTable) {
      html += '</tbody></table>';
      inTable = false;
    }

    // Headings
    if (line.startsWith('### ')) { if (inList) { html += '</ul>'; inList = false; } html += `<h3>${inline(line.slice(4))}</h3>`; continue; }
    if (line.startsWith('## ')) { if (inList) { html += '</ul>'; inList = false; } html += `<h2>${inline(line.slice(3))}</h2>`; continue; }
    if (line.startsWith('# ')) { if (inList) { html += '</ul>'; inList = false; } html += `<h1>${inline(line.slice(2))}</h1>`; continue; }

    // List items
    if (/^[-*] /.test(line.trim())) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.trim().slice(2))}</li>`;
      continue;
    } else if (inList) {
      html += '</ul>';
      inList = false;
    }

    // Empty line
    if (line.trim() === '') continue;

    // Paragraph
    html += `<p>${inline(line)}</p>`;
  }

  if (inTable) html += '</tbody></table>';
  if (inList) html += '</ul>';
  return html;
}

function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}
