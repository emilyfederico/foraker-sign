import { useEffect, useMemo, useState } from 'react';

import { FOLDERS, TEMPLATES } from '~/utils/template-library';

const INK = '#262626';

/**
 * A popup that surfaces the whole dotloop template library so an agent can open
 * or download any form straight from a loop — instead of dragging files in.
 * Grouped by folder, filterable by a single search box.
 */
export function TemplateLibraryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');

  // Close on Escape while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const folderLabel = useMemo(() => {
    const m: Record<string, string> = {};
    for (const f of FOLDERS) m[f.id] = f.label;
    return m;
  }, []);

  // Templates that match the search, grouped by folder in FOLDERS order.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (t: (typeof TEMPLATES)[number]) =>
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.badge.toLowerCase().includes(q) ||
      (folderLabel[t.folder] ?? '').toLowerCase().includes(q);
    return FOLDERS.map((f) => ({
      folder: f,
      items: TEMPLATES.filter((t) => t.folder === f.id && match(t)),
    })).filter((g) => g.items.length > 0);
  }, [query, folderLabel]);

  const total = useMemo(() => grouped.reduce((n, g) => n + g.items.length, 0), [grouped]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add from templates"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Add from templates</h2>
            <p className="text-xs text-gray-400">{total} forms · open or download into this loop</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="border-b border-gray-100 px-6 py-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search forms — name, state, or folder…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {grouped.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">No forms match “{query}”.</p>
          ) : (
            grouped.map((g) => (
              <div key={g.folder.id} className="mb-6 last:mb-0">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {g.folder.label}
                </h3>
                <div className="space-y-2">
                  {g.items.map((t, i) => (
                    <div
                      key={`${t.file}-${i}`}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5"
                    >
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ backgroundColor: INK }}
                      >
                        {t.badge}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-400">
                          {t.pages} {t.pages === 1 ? 'page' : 'pages'}
                          {t.fillable ? ' · fillable' : ''}
                        </p>
                      </div>
                      <a
                        href={`/templates/${t.file}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                        style={{ backgroundColor: INK }}
                      >
                        Open
                      </a>
                      <a
                        href={`/templates/${t.file}`}
                        download
                        className="shrink-0 text-xs font-semibold"
                        style={{ color: INK }}
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
