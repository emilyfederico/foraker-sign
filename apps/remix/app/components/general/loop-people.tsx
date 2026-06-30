import { useState } from 'react';

import { useFetcher } from 'react-router';

const INK = '#262626';

export type Person = { id: string; name: string; email: string; role: string };

// Roles an agent assigns on a loop — mirrors the dotloop "People" panel.
const ROLES = [
  'Listing Agent',
  'Buyer Agent',
  'Buyer',
  'Seller',
  'Lender',
  'Title / Settlement',
  'Inspector',
  'Attorney',
  'Other',
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function PersonRow({
  person,
  onRemove,
  removing,
}: {
  person: Person;
  onRemove?: () => void;
  removing?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-gray-100 py-3 first:border-t-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
        {initials(person.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{person.name}</p>
        {person.email ? (
          <p className="truncate text-sm text-gray-400">{person.email}</p>
        ) : (
          <p className="text-sm italic text-gray-300">No email</p>
        )}
      </div>
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {person.role}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          aria-label={`Remove ${person.name}`}
          className="shrink-0 rounded-full px-2 py-1 text-lg leading-none text-gray-300 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
        >
          &times;
        </button>
      )}
    </div>
  );
}

export function LoopPeople({
  people,
  agent,
  buyer,
}: {
  people: Person[];
  agent: { name: string; email: string; role: string } | null;
  buyer: { name: string; email: string } | null;
}) {
  const fetcher = useFetcher();
  const [adding, setAdding] = useState(false);

  const busy = fetcher.state !== 'idle';
  const pendingIntent = fetcher.formData?.get('intent');
  const removingId =
    pendingIntent === 'removePerson' ? String(fetcher.formData?.get('id') ?? '') : '';

  function addPerson(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set('intent', 'addPerson');
    if (!String(form.get('name') || '').trim()) return;
    void fetcher.submit(form, { method: 'post' });
    setAdding(false);
  }

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">People</h2>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="rounded-full px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: INK }}
        >
          {adding ? 'Cancel' : 'Add person'}
        </button>
      </div>
      <p className="mb-4 text-sm text-gray-400">
        Invite your clients, vendors, and the other side of the negotiation. No one can see who you
        invite.
      </p>

      {adding && (
        <form
          onSubmit={addPerson}
          className="mb-4 grid grid-cols-1 gap-2 rounded-lg bg-gray-50 p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
        >
          <input
            name="name"
            placeholder="Full name"
            autoFocus
            className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
          <input
            name="email"
            type="email"
            placeholder="Email (optional)"
            className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
          <select
            name="role"
            defaultValue="Buyer"
            className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: INK }}
          >
            Add
          </button>
        </form>
      )}

      <div>
        {agent && <PersonRow person={{ id: 'agent', ...agent }} />}
        {buyer && buyer.name && (
          <PersonRow
            person={{ id: 'buyer', name: buyer.name, email: buyer.email, role: 'Buyer' }}
          />
        )}
        {people.map((p) => (
          <PersonRow
            key={p.id}
            person={p}
            removing={removingId === p.id}
            onRemove={() => {
              void fetcher.submit({ intent: 'removePerson', id: p.id }, { method: 'post' });
            }}
          />
        ))}
        {!agent && !buyer?.name && people.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">
            No one added yet. Use “Add person” to invite clients and vendors.
          </p>
        )}
      </div>
    </div>
  );
}
