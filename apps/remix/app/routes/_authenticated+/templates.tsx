import { useState } from 'react';

import { Link } from 'react-router';

import { FOLDERS, TEMPLATES, type Template } from '~/utils/template-library';

const INK = '#262626';




const TABS = ['Loops', 'Tasks', 'People', 'Templates'];

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
      />
    </svg>
  );
}

function TemplateCard({ t }: { t: Template }) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: INK }}
        >
          {t.badge}
        </span>
        <span className="text-xs text-gray-400">{t.pages} pages</span>
      </div>
      <h3 className="text-base font-semibold text-gray-900">{t.name}</h3>
      <p className="mt-1 flex-1 text-sm text-gray-500">{t.desc}</p>
      {t.fillable && (
        <span className="mt-3 inline-block w-fit rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
          Fillable in a loop
        </span>
      )}
      <div className="mt-4 flex items-center gap-3 text-sm">
        <a
          href={`/templates/${t.file}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg px-4 py-2 font-semibold text-white"
          style={{ backgroundColor: INK }}
        >
          View
        </a>
        <a href={`/templates/${t.file}`} download className="font-semibold" style={{ color: INK }}>
          Download
        </a>
        {t.fillable && (
          <Link to="/loops" className="ml-auto text-xs text-gray-400 hover:text-gray-600">
            Fill in a loop →
          </Link>
        )}
      </div>
    </div>
  );
}

// Forms that ship in multiple languages (same form named "… — <Language>") are
// collapsed into one card with a language dropdown instead of N separate cards.
// Generic: works for any form, not just the Tenants Bill of Rights.
const LANG_RE =
  / — (English|Spanish|French|Chinese|Arabic|Vietnamese|Korean|Tagalog|Russian|Haitian Creole|Amharic|Burmese|Dari|Pashto|Swahili|Tigrinya|Ukrainian|Urdu|Portuguese|Hindi|Japanese|German|Italian|Polish|Farsi|Nepali|Somali)(\s*\([^)]*\))?\s*$/;

function languageOf(name: string): { base: string; lang: string } | null {
  const m = LANG_RE.exec(name);
  if (!m) return null;
  // Re-attach any trailing "(SUFFIX)" so all languages of a form share a base.
  const base = (name.slice(0, m.index) + (m[2] ?? '')).trim();
  return { base, lang: m[1] };
}

function LanguagePickerCard({ base, items }: { base: string; items: Template[] }) {
  const langs = items
    .map((t) => ({ lang: languageOf(t.name)?.lang ?? t.name, file: t.file }))
    .sort((a, b) =>
      a.lang === 'English' ? -1 : b.lang === 'English' ? 1 : a.lang.localeCompare(b.lang),
    );
  const [file, setFile] = useState(langs[0]?.file ?? '');
  const title = base.replace(/\s*\([^)]*\)\s*$/, '');
  const badge = items[0]?.badge ?? '';

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: INK }}
        >
          {badge}
        </span>
        <span className="text-xs text-gray-400">{langs.length} languages</span>
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-gray-500">
        Available in {langs.length} languages &mdash; pick one and the form opens.
      </p>
      <label className="mb-1 mt-3 block text-xs font-medium" style={{ color: INK }}>
        Language
      </label>
      <select
        value={file}
        onChange={(e) => setFile(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
      >
        {langs.map((l) => (
          <option key={l.file} value={l.file}>
            {l.lang}
          </option>
        ))}
      </select>
      <div className="mt-4 flex items-center gap-3 text-sm">
        <a
          href={`/templates/${file}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg px-4 py-2 font-semibold text-white"
          style={{ backgroundColor: INK }}
        >
          View
        </a>
        <a href={`/templates/${file}`} download className="font-semibold" style={{ color: INK }}>
          Download
        </a>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [openFolder, setOpenFolder] = useState<string | null>(null);

  const counts: Record<string, number> = {};
  for (const t of TEMPLATES) counts[t.folder] = (counts[t.folder] ?? 0) + 1;

  const openLabel = FOLDERS.find((f) => f.id === openFolder)?.label ?? '';
  const folderTemplates = TEMPLATES.filter((t) => t.folder === openFolder);

  // Collapse any multi-language form into a single picker card; everything else
  // (including a form that happens to have just one language) renders normally.
  const folderSingles: Template[] = [];
  const langGroups = new Map<string, Template[]>();
  for (const t of folderTemplates) {
    const v = languageOf(t.name);
    if (v) {
      langGroups.set(v.base, [...(langGroups.get(v.base) ?? []), t]);
    } else {
      folderSingles.push(t);
    }
  }
  const langPickers: { base: string; items: Template[] }[] = [];
  for (const [base, items] of langGroups) {
    if (items.length >= 2) {
      langPickers.push({ base, items });
    } else {
      folderSingles.push(...items);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* dotloop-style tabs */}
      <div className="mb-6 flex items-center gap-8 border-b border-gray-200">
        {TABS.map((tab) => {
          const active = tab === 'Templates';
          if (tab === 'Loops') {
            return (
              <Link
                key={tab}
                to="/loops"
                className="-mb-px border-b-2 border-transparent pb-3 text-sm font-medium text-gray-400 hover:text-gray-600"
              >
                {tab}
              </Link>
            );
          }
          return (
            <span
              key={tab}
              className="-mb-px border-b-2 pb-3 text-sm font-medium"
              style={
                active
                  ? { color: INK, borderColor: INK }
                  : { color: '#9ca3af', borderColor: 'transparent', cursor: 'default' }
              }
              title={active ? undefined : 'Coming soon'}
            >
              {tab}
            </span>
          );
        })}
      </div>

      {openFolder === null ? (
        <>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="mb-6 mt-1 text-sm text-gray-500">
            Foraker&rsquo;s form library. Click a folder to open it.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FOLDERS.map((f) => {
              const n = counts[f.id] ?? 0;
              return (
                <button
                  key={f.id}
                  onClick={() => setOpenFolder(f.id)}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
                >
                  <FolderIcon className="h-9 w-9 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-gray-900">{f.label}</span>
                    <span className="text-xs text-gray-400">
                      {n} {n === 1 ? 'form' : 'forms'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <button
            onClick={() => setOpenFolder(null)}
            className="mb-3 flex items-center gap-1 text-sm font-semibold"
            style={{ color: INK }}
          >
            ‹ All folders
          </button>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <FolderIcon className="h-6 w-6 text-gray-400" />
            {openLabel}
          </h1>
          <p className="mb-6 mt-1 text-sm text-gray-500">
            {folderTemplates.length} {folderTemplates.length === 1 ? 'form' : 'forms'}
          </p>

          {folderTemplates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-16 text-center text-sm text-gray-400">
              No forms in this folder yet. Send me the documents and I&rsquo;ll add them here.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {folderSingles.map((t) => (
                <TemplateCard key={t.file} t={t} />
              ))}
              {langPickers.map((p) => (
                <LanguagePickerCard key={p.base} base={p.base} items={p.items} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
