import { useState } from 'react';

import { Link } from 'react-router';

const INK = '#262626';

// dotloop-style folder set (recreated for Foraker).
const FOLDERS: { id: string; label: string }[] = [
  { id: 'md-buying', label: 'MD Buying Docs' },
  { id: 'de-buying', label: 'DE Buying Docs' },
  { id: 'pa-buying', label: 'PA Buying Documents' },
  { id: 'pa-listing', label: 'PA Listing Documents' },
  { id: 'master', label: 'Foraker Realty Co Master Documents' },
  { id: 'listing-lease', label: 'Listing Lease Documents' },
  { id: 'lease', label: 'Lease Documents' },
  { id: 'onboarding', label: 'Agent Onboarding Documents' },
  { id: 'de-interactive', label: 'Delaware Interactive Forms' },
  { id: 'de-spanish', label: 'Delaware Spanish Translations' },
  { id: 'nar', label: 'NAR Guides & Resources' },
  { id: 'bright-mls', label: 'Bright MLS Interactive Documents' },
  { id: 'mar', label: 'MAR Interactive Forms' },
  { id: 'par', label: 'PAR Interactive Documents' },
  { id: 'md-rec', label: 'Maryland REC Interactive Forms' },
  { id: 'dar', label: 'DAR Interactive Forms' },
];

type Template = {
  name: string;
  file: string;
  badge: string;
  pages: number;
  desc: string;
  folder: string;
  fillable?: boolean;
};

const TEMPLATES: Template[] = [
  {
    name: 'Agreement of Sale',
    file: 'de-agreement-of-sale.pdf',
    badge: 'DE',
    pages: 10,
    fillable: true,
    folder: 'de-buying',
    desc: 'Delaware residential purchase agreement (DAR).',
  },
  {
    name: 'Residential Contract of Sale',
    file: 'md-residential-contract-of-sale.pdf',
    badge: 'MD',
    pages: 11,
    fillable: true,
    folder: 'md-buying',
    desc: 'Maryland residential purchase contract.',
  },
  {
    name: 'Agreement of Sale',
    file: 'pa-agreement-of-sale.pdf',
    badge: 'PA',
    pages: 14,
    fillable: true,
    folder: 'pa-buying',
    desc: 'Pennsylvania standard agreement for the sale of real estate.',
  },
  {
    name: 'PA Forms Packet',
    file: 'pa-forms-packet.pdf',
    badge: 'PA',
    pages: 75,
    folder: 'pa-buying',
    desc: 'Full PA packet — consumer notice, guide, agreement of sale, and disclosures.',
  },
  {
    name: 'Consumer Notice',
    file: 'pa-consumer-notice.pdf',
    badge: 'PA',
    pages: 2,
    folder: 'pa-listing',
    desc: 'Pennsylvania consumer notice disclosure (listing).',
  },
  {
    name: 'MD Disclosures Packet',
    file: 'md-disclosures-packet.pdf',
    badge: 'MD',
    pages: 513,
    folder: 'md-buying',
    desc: 'Maryland disclosures — property disclosure/disclaimer, renters’ rights, tenants’ bill of rights (multi-language).',
  },
  {
    name: 'Affiliation Agreement',
    file: 'foraker-affiliation-agreement.pdf',
    badge: 'Foraker',
    pages: 9,
    folder: 'onboarding',
    desc: 'Agent affiliation / independent contractor agreement.',
  },
];

const TABS = ['Loops', 'Tasks', 'People', 'Templates'];

export default function TemplatesPage() {
  const [folder, setFolder] = useState<string>('all');

  const counts: Record<string, number> = {};
  for (const t of TEMPLATES) counts[t.folder] = (counts[t.folder] ?? 0) + 1;

  const visible = folder === 'all' ? TEMPLATES : TEMPLATES.filter((t) => t.folder === folder);
  const folderLabel =
    folder === 'all' ? 'All forms' : (FOLDERS.find((f) => f.id === folder)?.label ?? 'Folder');

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
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

      <h1 className="mb-1 text-2xl font-bold text-gray-900">Templates</h1>
      <p className="mb-6 text-sm text-gray-500">
        Foraker&rsquo;s form library, organized by folder. View or download any form; the state
        agreements are also fillable inside a loop.
      </p>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Folder sidebar */}
        <aside className="w-full shrink-0 md:w-64">
          <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 md:max-h-none md:overflow-visible">
            <button
              onClick={() => setFolder('all')}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold"
              style={
                folder === 'all' ? { backgroundColor: '#f3f4f6', color: INK } : { color: '#374151' }
              }
            >
              <span>All forms</span>
              <span className="text-xs text-gray-400">{TEMPLATES.length}</span>
            </button>
            <div className="my-1 h-px bg-gray-100" />
            {FOLDERS.map((f) => {
              const active = folder === f.id;
              const n = counts[f.id] ?? 0;
              return (
                <button
                  key={f.id}
                  onClick={() => setFolder(f.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm"
                  style={active ? { backgroundColor: '#f3f4f6', color: INK } : { color: '#4b5563' }}
                >
                  <span className="flex items-center gap-2 truncate">
                    <svg
                      className="h-4 w-4 shrink-0 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.6}
                        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                      />
                    </svg>
                    <span className="truncate">{f.label}</span>
                  </span>
                  {n > 0 && <span className="shrink-0 text-xs text-gray-400">{n}</span>}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Documents in the selected folder */}
        <section className="flex-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-gray-500">
              {folderLabel.toUpperCase()}
            </h2>
            <span className="text-xs text-gray-400">
              {visible.length} {visible.length === 1 ? 'form' : 'forms'}
            </span>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-16 text-center text-sm text-gray-400">
              No forms in this folder yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((t) => (
                <div
                  key={t.file}
                  className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
                >
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
                    <a
                      href={`/templates/${t.file}`}
                      download
                      className="font-semibold"
                      style={{ color: INK }}
                    >
                      Download
                    </a>
                    {t.fillable && (
                      <Link
                        to="/loops"
                        className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                      >
                        Fill in a loop →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
