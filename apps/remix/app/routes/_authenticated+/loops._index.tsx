import { type MouseEvent, useEffect, useRef, useState } from 'react';

import { Link, useFetcher, useLoaderData, useNavigate, useSubmit } from 'react-router';

import { prisma } from '@documenso/prisma';

// Foraker charcoal accent, used across the Loops experience.
const INK = '#262626';

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: 'Purchase',
  LISTING: 'Listing for Sale',
  LEASE: 'Lease',
};

// States we have contracts for — picking one scopes the address search and sets
// the loop's state (which determines the contract used in the Fill view).
const SEARCH_STATES: [string, string][] = [
  ['DE', 'Delaware'],
  ['PA', 'Pennsylvania'],
  ['MD', 'Maryland'],
];

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const search = (url.searchParams.get('search') || '').trim();

  const loops = await prisma.transaction.findMany({
    where: {
      status: 'ACTIVE',
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
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return Response.json({ loops, search });
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData();

  // Archive (soft-delete) a loop — removes it from the active list.
  if (form.get('intent') === 'archive') {
    const loopId = String(form.get('loopId') || '');
    if (loopId) {
      await prisma.transaction.update({
        where: { id: loopId },
        data: { status: 'ARCHIVED' },
      });
    }
    return Response.json({ archived: true });
  }

  const address = String(form.get('address') || '').trim();
  if (!address) {
    return Response.json({ error: 'An address is required.' }, { status: 400 });
  }

  const priceRaw = String(form.get('price') || '');
  const bedsRaw = String(form.get('beds') || '');

  try {
    const loop = await prisma.transaction.create({
      data: {
        address,
        city: String(form.get('city') || '') || null,
        state: String(form.get('state') || '') || null,
        mlsNumber: String(form.get('mlsNumber') || '') || null,
        price: priceRaw ? Number(priceRaw) : null,
        beds: bedsRaw ? Number(bedsRaw) : null,
        transactionType: String(form.get('transactionType') || 'PURCHASE'),
      },
    });
    // Return the id (don't auto-redirect) so the modal can show the result and
    // any navigation error to the loop page is isolated from creation.
    return Response.json({ loopId: loop.id });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to create loop' },
      { status: 500 },
    );
  }
}

function formatPrice(price: number | null): string {
  if (!price) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

type Loop = {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  mlsNumber: string | null;
  price: number | null;
  beds: number | null;
  transactionType: string;
};

type PropertyResult = {
  mlsNumber: string;
  address: string;
  city: string;
  state: string | null;
  price: number | null;
  beds: number | null;
  listOfficeName: string | null;
};

function AddLoopModal({ onClose }: { onClose: () => void }) {
  const fetcher = useFetcher<{ results: PropertyResult[] }>();
  const createFetcher = useFetcher<{ loopId?: string; error?: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PropertyResult | null>(null);
  const [searchState, setSearchState] = useState<string | null>(null);
  const [type, setType] = useState('PURCHASE');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) return;
    debounceRef.current = setTimeout(() => {
      const stateParam = searchState ? `&state=${searchState}` : '';
      void fetcher.load(
        `/api/properties-search?q=${encodeURIComponent(query.trim())}${stateParam}`,
      );
    }, 80);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected, searchState, fetcher]);

  const results = fetcher.data?.results ?? [];
  const canContinue = Boolean(selected) || query.trim().length > 3;
  const creating = createFetcher.state !== 'idle';
  const createdId = createFetcher.data?.loopId;
  const createError = createFetcher.data?.error;

  // Once created, open the loop. This is also what prevents a second loop: the
  // modal navigates away, so the create button can't be clicked again.
  useEffect(() => {
    if (createdId) {
      void navigate(`/loops/${createdId}`);
    }
  }, [createdId, navigate]);

  function createLoop() {
    // Guard against double-submit (the original duplicate-loop bug).
    if (creating || createdId) return;
    const data = new FormData();
    data.set('transactionType', type);
    if (selected) {
      data.set('address', selected.address);
      data.set('city', selected.city);
      data.set('state', selected.state ?? searchState ?? '');
      data.set('mlsNumber', selected.mlsNumber);
      if (selected.price != null) data.set('price', String(selected.price));
      if (selected.beds != null) data.set('beds', String(selected.beds));
    } else {
      data.set('address', query.trim());
      // No MLS match — use the chosen state so the right contract loads.
      if (searchState) data.set('state', searchState);
    }
    void createFetcher.submit(data, { method: 'post' });
  }

  const displayAddress = selected
    ? `${selected.address}, ${selected.city}${selected.state ? `, ${selected.state}` : ''}`
    : query.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-20">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 text-2xl leading-none text-gray-400 hover:text-gray-600"
        >
          &times;
        </button>

        <h2 className="text-center text-2xl font-bold text-gray-900">Add a new loop</h2>

        {/* Stepper — driven by the current step */}
        <div className="mx-auto mt-6 flex max-w-lg items-center justify-between text-sm">
          {['Loop Name', 'Type', 'Finish'].map((label, i) => {
            const n = i + 1;
            const active = n <= step;
            return (
              <div key={label} className="flex flex-1 items-center">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: active ? INK : '#cbd5e1' }}
                >
                  {n}
                </span>
                <span
                  className="ml-2 font-medium"
                  style={{ color: active ? '#111827' : '#94a3b8' }}
                >
                  {label}
                </span>
                {i < 2 && <span className="mx-3 h-px flex-1 bg-gray-200" />}
              </div>
            );
          })}
        </div>

        {/* STEP 1 — Loop Name (address / MLS) */}
        {step === 1 && (
          <div className="mt-8">
            <label className="mb-1 block text-xs font-medium" style={{ color: INK }}>
              Property Address or MLS#
            </label>
            <input
              autoFocus
              value={selected ? `${selected.address}, ${selected.city}` : query}
              onChange={(e) => {
                setSelected(null);
                setQuery(e.target.value);
              }}
              placeholder="Start typing an address or MLS number…"
              className="w-full rounded-lg border-2 px-4 py-3 text-sm focus:outline-none"
              style={{ borderColor: INK }}
            />

            {/* State scope — pick a state to search within it (and set the loop's
                state, which picks the DE/PA/MD contract). */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">State:</span>
              {SEARCH_STATES.map(([code, label]) => {
                const active = searchState === code;
                return (
                  <button
                    key={code}
                    onClick={() => {
                      setSelected(null);
                      setSearchState(active ? null : code);
                    }}
                    className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
                    style={
                      active
                        ? { backgroundColor: INK, color: 'white', borderColor: INK }
                        : { color: '#374151', borderColor: '#e5e7eb' }
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {!selected && results.length > 0 && (
              <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                {results.map((r) => (
                  <button
                    key={r.mlsNumber}
                    onClick={() => setSelected(r)}
                    className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left last:border-0 hover:bg-gray-50"
                  >
                    <span>
                      <span className="block text-sm font-medium text-gray-900">
                        {r.address}, {r.city}
                        {r.state ? `, ${r.state}` : ''}
                      </span>
                      <span className="block text-xs text-gray-400">
                        {r.listOfficeName ?? 'Foraker'}
                        {r.price ? ` · ${formatPrice(r.price)}` : ''}
                      </span>
                    </span>
                    <span className="ml-3 shrink-0 text-xs text-gray-400">MLS# {r.mlsNumber}</span>
                  </button>
                ))}
              </div>
            )}

            <p className="mt-2 text-xs text-gray-400">
              Not in the list? Type the full address — you can still create the loop.
            </p>
          </div>
        )}

        {/* STEP 2 — Type */}
        {step === 2 && (
          <div className="mt-8">
            <p className="mb-1 truncate text-sm text-gray-500">{displayAddress}</p>
            <p className="mb-3 text-xs font-medium" style={{ color: INK }}>
              What kind of transaction is this?
            </p>
            <div className="flex gap-2">
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setType(value)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                  style={
                    type === value
                      ? { backgroundColor: INK, color: 'white', borderColor: INK }
                      : { color: '#374151', borderColor: '#e5e7eb' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3 — Finish (review + create) */}
        {step === 3 && (
          <div className="mt-8">
            <p className="mb-3 text-sm font-semibold" style={{ color: INK }}>
              Review
            </p>
            <dl className="space-y-2 rounded-lg border border-gray-200 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-400">Address</dt>
                <dd className="text-right font-medium text-gray-900">{displayAddress}</dd>
              </div>
              {selected?.mlsNumber && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-400">MLS#</dt>
                  <dd className="text-right font-medium text-gray-900">{selected.mlsNumber}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-gray-400">Type</dt>
                <dd className="text-right font-medium text-gray-900">
                  {TYPE_LABELS[type] ?? type}
                </dd>
              </div>
              {selected?.price ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-400">List price</dt>
                  <dd className="text-right font-medium text-gray-900">
                    {formatPrice(selected.price)}
                  </dd>
                </div>
              ) : null}
            </dl>

            {createError && (
              <div className="mt-4 break-words rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {createError}
              </div>
            )}
          </div>
        )}

        {/* Footer — Back/Cancel + Continue/Create */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <button
            onClick={step === 1 ? onClose : () => setStep(step - 1)}
            className="text-sm font-medium"
            style={{ color: INK }}
          >
            {step === 1 ? 'Cancel' : '‹ Back'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !canContinue}
              className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: INK }}
            >
              Continue
            </button>
          ) : (
            <button
              onClick={createLoop}
              disabled={creating || Boolean(createdId)}
              className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: INK }}
            >
              {creating ? 'Creating…' : createdId ? 'Opening…' : 'Create Loop'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const TABS = ['Loops', 'Tasks', 'People', 'Templates'];

export default function LoopsPage() {
  const { loops, search } = useLoaderData() as { loops: Loop[]; search: string };
  const submit = useSubmit();
  const archiveFetcher = useFetcher();
  const [showAdd, setShowAdd] = useState(false);

  function archiveLoop(e: MouseEvent, id: string, address: string) {
    // The button sits on top of the card's Link — don't navigate, just archive.
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Archive "${address}"? It will be removed from your loops.`)) {
      return;
    }
    const data = new FormData();
    data.set('intent', 'archive');
    data.set('loopId', id);
    void archiveFetcher.submit(data, { method: 'post' });
  }

  // The loop currently being archived (for an immediate optimistic fade-out).
  const archivingId =
    archiveFetcher.state !== 'idle' ? String(archiveFetcher.formData?.get('loopId') ?? '') : '';

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* dotloop-style top tabs */}
      <div className="mb-6 flex items-center gap-8 border-b border-gray-200">
        {TABS.map((tab) => {
          const active = tab === 'Loops';
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

      {/* Search + Add Loop */}
      <div className="mb-6 flex items-center gap-3">
        <input
          type="text"
          defaultValue={search}
          placeholder="Search by address, title, MLS#…"
          onChange={(e) => {
            const data = new FormData();
            if (e.target.value) data.set('search', e.target.value);
            void submit(data, { method: 'get' });
          }}
          className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
          style={{ outlineColor: INK }}
        />
        <button
          onClick={() => setShowAdd(true)}
          className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
          style={{ backgroundColor: INK }}
        >
          + Add Loop
        </button>
      </div>

      {/* Loop cards */}
      {loops.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-16 text-center text-gray-400">
          No loops yet. Click <span className="font-semibold">+ Add Loop</span> to start a
          transaction.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loops.map((loop) => (
            <div
              key={loop.id}
              className={`relative transition-opacity ${
                archivingId === loop.id ? 'pointer-events-none opacity-40' : ''
              }`}
            >
              <Link
                to={`/loops/${loop.id}`}
                className="block overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
              >
                <div
                  className="flex h-28 items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${INK}, #0077b6)` }}
                >
                  <svg
                    className="h-10 w-10 text-white/80"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 12l9-9 9 9M5 10v10h14V10"
                    />
                  </svg>
                </div>
                <div className="p-4">
                  <p className="truncate font-semibold text-gray-900">{loop.address}</p>
                  <p className="truncate text-sm text-gray-500">
                    {loop.city}
                    {loop.state ? `, ${loop.state}` : ''}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {TYPE_LABELS[loop.transactionType] ?? loop.transactionType}
                    </span>
                    {loop.price ? (
                      <span className="text-sm font-bold" style={{ color: INK }}>
                        {formatPrice(loop.price)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>

              <button
                onClick={(e) => archiveLoop(e, loop.id, loop.address)}
                title="Archive loop"
                aria-label="Archive loop"
                className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 text-gray-500 shadow-sm transition-colors hover:bg-white hover:text-red-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddLoopModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
