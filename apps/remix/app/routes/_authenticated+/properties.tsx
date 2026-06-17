import { useState } from 'react';

import { useLoaderData, useSearchParams } from 'react-router';

import { prisma } from '@documenso/prisma';

const TEMPLATE_IDS: Record<string, string> = {
  MD: 'envelope_ehhkmtoavtzehidr',
  DE: 'envelope_frxrloufaakhzovu',
  PA: 'envelope_mbmsavzmmtflutns',
};

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const city = url.searchParams.get('city') || '';
  const status = url.searchParams.get('status') || '';
  const search = url.searchParams.get('search') || '';

  // Get distinct cities
  const cities = await prisma.property.findMany({
    select: { city: true },
    distinct: ['city'],
    orderBy: { city: 'asc' },
    where: { city: { not: '' } },
  });

  // Get distinct statuses
  const statuses = await prisma.property.findMany({
    select: { status: true },
    distinct: ['status'],
    orderBy: { status: 'asc' },
  });

  // Get properties with filters
  const properties = await prisma.property.findMany({
    where: {
      ...(city ? { city } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { address: { contains: search, mode: 'insensitive' } },
              { mlsNumber: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { contractDate: 'desc' },
    take: 200,
  });

  return Response.json({
    properties,
    cities: cities.map((c: { city: string }) => c.city),
    statuses: statuses.map((s: { status: string }) => s.status),
    filters: { city, status, search },
  });
}

const STATUS_LABELS: Record<string, string> = {
  ACT: 'Active',
  'C/S': 'Under Contract',
  CLS: 'Closed',
  PND: 'Pending',
  'A/C': 'Active/Contract',
  EXP: 'Expired',
  WTH: 'Withdrawn',
  CNL: 'Cancelled',
  'T/O': 'Taking Offers',
};

const STATUS_COLORS: Record<string, string> = {
  ACT: 'bg-green-100 text-green-800',
  'C/S': 'bg-yellow-100 text-yellow-800',
  CLS: 'bg-gray-100 text-gray-800',
  PND: 'bg-blue-100 text-blue-800',
  'A/C': 'bg-orange-100 text-orange-800',
  EXP: 'bg-red-100 text-red-800',
  WTH: 'bg-red-100 text-red-800',
  CNL: 'bg-red-100 text-red-800',
  'T/O': 'bg-purple-100 text-purple-800',
};

function formatPrice(price: number | null): string {
  if (!price) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

type Property = {
  id: string;
  mlsNumber: string;
  status: string;
  address: string;
  city: string;
  county: string;
  state: string | null;
  beds: number | null;
  baths: string | null;
  structureType: string | null;
  price: number | null;
  contractDate: string | null;
  listOfficeName: string | null;
};

function PropertyModal({ property, onClose }: { property: Property; onClose: () => void }) {
  const [generating, setGenerating] = useState(false);

  async function handleGenerateContract() {
    const templateId = TEMPLATE_IDS[property.state ?? 'MD'];
    if (!templateId) {
      alert('No contract template found for state: ' + property.state);
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/generate-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, property }),
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
        onClose();
      } else {
        alert(data.error ?? 'Failed to generate contract');
      }
    } catch {
      alert('Failed to generate contract');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-2xl leading-none text-gray-400 hover:text-gray-600"
        >
          &times;
        </button>

        <div className="p-6">
          <div className="mb-1 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[property.status] ?? 'bg-gray-100 text-gray-800'}`}
            >
              {STATUS_LABELS[property.status] ?? property.status}
            </span>
            <span className="text-xs text-gray-400">{property.mlsNumber}</span>
          </div>

          <h2 className="mt-1 text-xl font-semibold text-gray-900">{property.address}</h2>
          <p className="text-gray-500">
            {property.city}, {property.county}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Price</p>
              <p className="text-lg font-semibold text-gray-900">{formatPrice(property.price)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Beds / Baths</p>
              <p className="text-lg font-semibold text-gray-900">
                {property.beds ?? '—'} bd / {property.baths ?? '—'} ba
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Type</p>
              <p className="text-sm font-medium text-gray-900">{property.structureType ?? '—'}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Date</p>
              <p className="text-sm font-medium text-gray-900">
                {property.contractDate ? new Date(property.contractDate).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>

          {property.listOfficeName && (
            <p className="mt-3 text-xs text-gray-400">Listed by: {property.listOfficeName}</p>
          )}

          <button
            onClick={handleGenerateContract}
            disabled={generating}
            className="mt-5 w-full rounded-lg bg-[#4a7c59] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#3d6649] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? 'Generating...' : 'Generate Contract'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PropertiesPage() {
  const { properties, cities, statuses, filters } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<Property | null>(null);

  function updateFilter(key: string, value: string) {
    setSearchParams((prev: URLSearchParams) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Property Browser</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse MLS listings · {properties.length} results
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search address or MLS#..."
          defaultValue={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="w-64 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
        />

        <select
          value={filters.city}
          onChange={(e) => updateFilter('city', e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
        >
          <option value="">All Cities</option>
          {cities.map((c: string) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
        >
          <option value="">All Statuses</option>
          {statuses.map((s: string) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s] ?? s}
            </option>
          ))}
        </select>
      </div>

      {/* Property Grid */}
      {properties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
          No properties found. Try adjusting your filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(properties as Property[]).map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p as Property)}
              className="rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-[#4a7c59] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-800'}`}
                >
                  {STATUS_LABELS[p.status] ?? p.status}
                </span>
                <span className="truncate text-xs text-gray-400">{p.mlsNumber}</span>
              </div>
              <p className="mt-2 truncate font-semibold text-gray-900">{p.address}</p>
              <p className="text-sm text-gray-500">{p.city}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg font-bold text-[#4a7c59]">{formatPrice(p.price)}</span>
                <span className="text-sm text-gray-400">
                  {p.beds ?? '—'} bd · {p.baths ?? '—'} ba
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && <PropertyModal property={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
