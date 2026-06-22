import { Link } from 'react-router';

const INK = '#262626';

type Template = {
  name: string;
  file: string;
  badge: string;
  pages: number;
  desc: string;
  fillable?: boolean;
};

// Foraker's standard form library. Files live in /public/templates.
const TEMPLATES: Template[] = [
  {
    name: 'Agreement of Sale',
    file: 'de-agreement-of-sale.pdf',
    badge: 'DE',
    pages: 10,
    fillable: true,
    desc: 'Delaware residential purchase agreement (DAR).',
  },
  {
    name: 'Residential Contract of Sale',
    file: 'md-residential-contract-of-sale.pdf',
    badge: 'MD',
    pages: 11,
    fillable: true,
    desc: 'Maryland residential purchase contract.',
  },
  {
    name: 'Agreement of Sale',
    file: 'pa-agreement-of-sale.pdf',
    badge: 'PA',
    pages: 14,
    fillable: true,
    desc: 'Pennsylvania standard agreement for the sale of real estate.',
  },
  {
    name: 'Affiliation Agreement',
    file: 'foraker-affiliation-agreement.pdf',
    badge: 'Foraker',
    pages: 9,
    desc: 'Agent affiliation / independent contractor agreement.',
  },
  {
    name: 'Consumer Notice',
    file: 'pa-consumer-notice.pdf',
    badge: 'PA',
    pages: 2,
    desc: 'Pennsylvania consumer notice disclosure.',
  },
  {
    name: 'PA Forms Packet',
    file: 'pa-forms-packet.pdf',
    badge: 'PA',
    pages: 75,
    desc: 'Full PA packet — consumer notice, guide, agreement of sale, and disclosures.',
  },
  {
    name: 'MD Disclosures Packet',
    file: 'md-disclosures-packet.pdf',
    badge: 'MD',
    pages: 513,
    desc: 'Maryland disclosures — property disclosure/disclaimer, renters’ rights, and tenants’ bill of rights (multi-language).',
  },
];

const TABS = ['Loops', 'Tasks', 'People', 'Templates'];

export default function TemplatesPage() {
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

      <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
      <p className="mt-1 text-sm text-gray-500">
        Foraker&rsquo;s standard forms. View or download any template; the state agreements are also
        fillable inside a loop.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => (
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
                <Link to="/loops" className="ml-auto text-xs text-gray-400 hover:text-gray-600">
                  Fill in a loop →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
