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

export default function TemplatesPage() {
  const [openFolder, setOpenFolder] = useState<string | null>(null);

  const counts: Record<string, number> = {};
  for (const t of TEMPLATES) counts[t.folder] = (counts[t.folder] ?? 0) + 1;

  const openLabel = FOLDERS.find((f) => f.id === openFolder)?.label ?? '';
  const folderTemplates = TEMPLATES.filter((t) => t.folder === openFolder);

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
              {folderTemplates.map((t) => (
                <TemplateCard key={t.file} t={t} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
