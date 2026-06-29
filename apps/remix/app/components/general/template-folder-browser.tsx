import { useMemo, useState } from 'react';

import { FOLDERS, TEMPLATES } from '~/utils/template-library';

const INK = '#262626';
const FOLDER_BLUE = '#5b93cf';

function FolderIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
      />
    </svg>
  );
}

/**
 * Inline, dotloop-style document browser for a loop: the template folders are
 * listed right on the page; clicking one drills into its forms (open/download).
 * No popup — the folders are always visible.
 */
export function TemplateFolderBrowser() {
  const [openFolder, setOpenFolder] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TEMPLATES) c[t.folder] = (c[t.folder] ?? 0) + 1;
    return c;
  }, []);

  if (openFolder) {
    const folder = FOLDERS.find((f) => f.id === openFolder);
    const forms = TEMPLATES.filter((t) => t.folder === openFolder);
    return (
      <div>
        <button
          onClick={() => setOpenFolder(null)}
          className="mb-3 flex items-center gap-1 text-sm font-semibold"
          style={{ color: INK }}
        >
          ‹ All folders
        </button>
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900">
          <FolderIcon className="h-5 w-5 text-gray-400" />
          {folder?.label ?? 'Folder'}
        </h3>
        {forms.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No forms in this folder yet.</p>
        ) : (
          <div className="space-y-2">
            {forms.map((t, i) => (
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
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-100">
      {FOLDERS.map((f) => {
        const n = counts[f.id] ?? 0;
        return (
          <button
            key={f.id}
            onClick={() => setOpenFolder(f.id)}
            className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3.5 text-left last:border-b-0 hover:bg-gray-50"
          >
            <FolderIcon className="h-5 w-5 shrink-0" style={{ color: FOLDER_BLUE }} />
            <span
              className="flex-1 truncate text-sm font-semibold uppercase tracking-wide"
              style={{ color: FOLDER_BLUE }}
            >
              {f.label}
            </span>
            <span className="shrink-0 text-xs text-gray-400">
              {n} {n === 1 ? 'form' : 'forms'}
            </span>
            <svg
              className="h-4 w-4 shrink-0 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
