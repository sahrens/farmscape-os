import { useState, useEffect, useMemo, useCallback } from 'react';
import { data, type ColumnInfo, type QueryResult } from '@/lib/api';

const TABLES = ['elements', 'activities', 'observations', 'changelog'];

const FILTERABLE_COLUMNS: Record<string, string[]> = {
  elements: ['type', 'subtype', 'status'],
  activities: ['type', 'is_test', 'element_id'],
  observations: ['type', 'is_test', 'element_id'],
  changelog: ['table_name', 'action', 'author'],
};

function DataExplorer() {
  const [activeTable, setActiveTable] = useState('elements');
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set());
  const [showColPicker, setShowColPicker] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(200);
  const [orderBy, setOrderBy] = useState('rowid');
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filterOptions, setFilterOptions] = useState<Record<string, string[]>>({});
  const [showSql, setShowSql] = useState(false);
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResult, setSqlResult] = useState<QueryResult | null>(null);
  const [sqlError, setSqlError] = useState('');
  const [sqlLoading, setSqlLoading] = useState(false);

  useEffect(() => {
    data.tables().then(tables => {
      const counts: Record<string, number> = {};
      tables.forEach(t => { counts[t.name] = t.count; });
      setTableCounts(counts);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    setColumns([]);
    setRows([]);
    setPage(0);
    setFilters({});
    setOrderBy('rowid');
    setOrderDir('desc');

    data.schema(activeTable).then(cols => {
      setColumns(cols);
      const defaultVisible = new Set(cols.map(c => c.name));
      setVisibleCols(defaultVisible);
    }).catch(console.error);

    const filterCols = FILTERABLE_COLUMNS[activeTable] || [];
    filterCols.forEach(col => {
      data.distinct(activeTable, col).then(vals => {
        setFilterOptions(prev => ({ ...prev, [`${activeTable}.${col}`]: vals.map(String) }));
      }).catch(() => {});
    });
  }, [activeTable]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        limit: String(pageSize),
        offset: String(page * pageSize),
        order_by: orderBy,
        order_dir: orderDir,
      };
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      const result = await data.query(activeTable, params);
      setRows(result.rows);
      setTotal(result.total);
    } catch (err) {
      console.error('Query failed:', err);
    }
    setLoading(false);
  }, [activeTable, page, pageSize, orderBy, orderDir, filters]);

  useEffect(() => {
    if (columns.length > 0) loadData();
  }, [loadData, columns.length]);

  const runSql = async () => {
    if (!sqlQuery.trim()) return;
    setSqlLoading(true);
    setSqlError('');
    setSqlResult(null);
    try {
      const result = await data.sql(sqlQuery);
      if ('rows' in result) {
        setSqlResult(result as QueryResult);
      } else {
        setSqlResult({ rows: [{ result: `OK — ${(result as any).changes} rows affected` }], total: 1 });
      }
    } catch (err: any) {
      setSqlError(err.message || 'SQL error');
    }
    setSqlLoading(false);
  };

  const totalPages = Math.ceil(total / pageSize);
  const filterableCols = FILTERABLE_COLUMNS[activeTable] || [];

  const toggleCol = (col: string) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const handleSort = (col: string) => {
    if (orderBy === col) {
      setOrderDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderBy(col);
      setOrderDir('desc');
    }
    setPage(0);
  };

  const handleFilter = (col: string, value: string) => {
    setFilters(prev => {
      const next = { ...prev };
      if (value === '') delete next[col];
      else next[col] = value;
      return next;
    });
    setPage(0);
  };

  const displayCols = columns.filter(c => visibleCols.has(c.name));

  const formatCell = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const truncate = (s: string, max: number) =>
    s.length > max ? s.slice(0, max) + '...' : s;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-earth-900 text-earth-100">
      {/* Sub-header: SQL toggle + table tabs */}
      <div className="shrink-0">
        {/* SQL toggle bar */}
        <div className="bg-earth-800/50 border-b border-earth-700 px-4 py-2 flex items-center justify-between">
          <div className="flex gap-2 overflow-x-auto">
            {TABLES.map(t => (
              <button
                key={t}
                onClick={() => setActiveTable(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap active:scale-95 ${
                  activeTable === t
                    ? 'bg-forest-600 text-white'
                    : 'bg-earth-700 text-earth-300 hover:bg-earth-600'
                }`}
              >
                {t} <span className="text-xs opacity-70">({tableCounts[t] || 0})</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowSql(!showSql)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors shrink-0 ml-2 ${
              showSql ? 'bg-forest-600 text-white' : 'bg-earth-700 text-earth-300 hover:bg-earth-600'
            }`}
          >
            {showSql ? 'Hide SQL' : 'SQL'}
          </button>
        </div>

        {/* SQL Editor Panel */}
        {showSql && (
          <div className="bg-earth-850 border-b border-earth-700 p-4 space-y-2">
            <div className="flex gap-2">
              <textarea
                value={sqlQuery}
                onChange={e => setSqlQuery(e.target.value)}
                placeholder="SELECT * FROM elements WHERE type = 'tree' LIMIT 10"
                rows={3}
                className="flex-1 bg-earth-900 border border-earth-600 rounded-lg px-3 py-2 text-sm text-earth-100 font-mono placeholder-earth-500 focus:outline-none focus:ring-2 focus:ring-forest-500 resize-y"
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    runSql();
                  }
                }}
              />
              <button
                onClick={runSql}
                disabled={sqlLoading || !sqlQuery.trim()}
                className="px-4 py-2 bg-forest-600 hover:bg-forest-500 disabled:bg-earth-600 disabled:text-earth-400 text-white rounded-lg text-sm font-medium self-end active:scale-95"
              >
                {sqlLoading ? 'Running...' : 'Run ⌘↵'}
              </button>
            </div>
            {sqlError && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2 text-sm text-red-300">
                {sqlError}
              </div>
            )}
            {sqlResult && (
              <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-lg border border-earth-700">
                <table className="w-full text-xs">
                  <thead className="bg-earth-800 sticky top-0">
                    <tr>
                      {sqlResult.rows.length > 0 && Object.keys(sqlResult.rows[0]).map(col => (
                        <th key={col} className="px-3 py-2 text-left text-earth-400 font-medium">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sqlResult.rows.map((row, i) => (
                      <tr key={i} className="border-t border-earth-700 hover:bg-earth-800/50">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-1.5 text-earth-200 whitespace-nowrap">
                            {truncate(formatCell(val), 60)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-1.5 text-xs text-earth-500 bg-earth-800 border-t border-earth-700">
                  {sqlResult.total} row{sqlResult.total !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters & Column Picker */}
        <div className="px-4 py-3 flex flex-wrap gap-2 items-center border-b border-earth-700/50">
          <div className="relative">
            <button
              onClick={() => setShowColPicker(!showColPicker)}
              className="px-3 py-1.5 bg-earth-700 text-earth-300 hover:bg-earth-600 rounded text-xs font-medium active:scale-95"
            >
              Columns ({displayCols.length}/{columns.length})
            </button>
            {showColPicker && (
              <div className="absolute top-full left-0 mt-1 bg-earth-800 border border-earth-600 rounded-lg shadow-xl z-40 p-2 max-h-64 overflow-y-auto min-w-48">
                <div className="flex gap-2 mb-2 pb-2 border-b border-earth-700">
                  <button
                    onClick={() => setVisibleCols(new Set(columns.map(c => c.name)))}
                    className="text-xs text-forest-400 hover:text-forest-300"
                  >
                    All
                  </button>
                  <button
                    onClick={() => setVisibleCols(new Set(['id', 'name', 'type', 'status', 'created_at']))}
                    className="text-xs text-forest-400 hover:text-forest-300"
                  >
                    Minimal
                  </button>
                </div>
                {columns.map(col => (
                  <label key={col.name} className="flex items-center gap-2 px-2 py-1 hover:bg-earth-700 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleCols.has(col.name)}
                      onChange={() => toggleCol(col.name)}
                      className="rounded border-earth-500"
                    />
                    <span className="text-xs text-earth-200">{col.name}</span>
                    <span className="text-xs text-earth-500 ml-auto">{col.type || 'TEXT'}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {filterableCols.map(col => {
            const options = filterOptions[`${activeTable}.${col}`] || [];
            return (
              <select
                key={col}
                value={filters[col] || ''}
                onChange={e => handleFilter(col, e.target.value)}
                className="px-2 py-1.5 bg-earth-700 border border-earth-600 rounded text-xs text-earth-200 focus:outline-none focus:ring-2 focus:ring-forest-500"
              >
                <option value="">{col}: all</option>
                {options.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            );
          })}

          {Object.keys(filters).length > 0 && (
            <button
              onClick={() => { setFilters({}); setPage(0); }}
              className="px-2 py-1.5 bg-red-900/30 text-red-300 rounded text-xs hover:bg-red-900/50 active:scale-95"
            >
              Clear {Object.keys(filters).length} filter{Object.keys(filters).length > 1 ? 's' : ''}
            </button>
          )}

          <div className="ml-auto text-xs text-earth-500">
            {total} row{total !== 1 ? 's' : ''}{loading ? ' (loading...)' : ''}
          </div>
        </div>
      </div>

      {/* Data Table — scrollable area fills remaining space, sticky header at top of this container */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-earth-800 sticky top-0 z-30">
            <tr>
              <th className="px-3 py-2 text-left text-earth-500 text-xs font-medium w-8">#</th>
              {displayCols.map(col => (
                <th
                  key={col.name}
                  onClick={() => handleSort(col.name)}
                  className="px-3 py-2 text-left text-earth-400 text-xs font-medium cursor-pointer hover:text-earth-200 whitespace-nowrap select-none"
                >
                  {col.name}
                  {orderBy === col.name && (
                    <span className="ml-1">{orderDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={String(row.id || i)}
                className="border-t border-earth-800 hover:bg-earth-800/50 transition-colors"
              >
                <td className="px-3 py-2 text-earth-600 text-xs">{page * pageSize + i + 1}</td>
                {displayCols.map(col => {
                  const val = row[col.name];
                  const display = formatCell(val);
                  const isLong = display.length > 50;
                  return (
                    <td
                      key={col.name}
                      className="px-3 py-2 text-earth-200 text-xs whitespace-nowrap max-w-xs overflow-hidden text-ellipsis"
                      title={isLong ? display : undefined}
                    >
                      {col.name === 'is_test' ? (
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          val ? 'bg-yellow-900/40 text-yellow-300' : 'bg-earth-700 text-earth-400'
                        }`}>
                          {val ? 'test' : 'real'}
                        </span>
                      ) : col.name === 'status' ? (
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          val === 'active' ? 'bg-forest-900/40 text-forest-300' :
                          val === 'planned' ? 'bg-vanilla-900/40 text-vanilla-300' :
                          'bg-earth-700 text-earth-400'
                        }`}>
                          {display}
                        </span>
                      ) : col.name === 'action' ? (
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          val === 'upsert' || val === 'create' ? 'bg-forest-900/40 text-forest-300' :
                          val === 'update' ? 'bg-blue-900/40 text-blue-300' :
                          val === 'delete' ? 'bg-red-900/40 text-red-300' :
                          'bg-earth-700 text-earth-400'
                        }`}>
                          {display}
                        </span>
                      ) : (
                        truncate(display, 50)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={displayCols.length + 1} className="px-4 py-8 text-center text-earth-500 text-sm italic">
                  No data found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 flex items-center justify-between border-t border-earth-700 bg-earth-800/50 shrink-0">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 bg-earth-700 text-earth-300 hover:bg-earth-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-xs active:scale-95"
          >
            ← Previous
          </button>
          <span className="text-xs text-earth-400">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 bg-earth-700 text-earth-300 hover:bg-earth-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-xs active:scale-95"
          >
            Next →
          </button>
        </div>
      )}

      {/* Click outside to close column picker */}
      {showColPicker && (
        <div className="fixed inset-0 z-30" onClick={() => setShowColPicker(false)} />
      )}
    </div>
  );
}

export default DataExplorer;
