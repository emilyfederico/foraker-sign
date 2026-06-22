import { useState } from 'react';

import { useFetcher, useLoaderData } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { prisma } from '@documenso/prisma';

const INK = '#262626';

type Profile = {
  name: string;
  licenseNumber: string;
  brokerage: string;
  companyLicense: string;
  officeAddress: string;
  officePhone: string;
  cellPhone: string;
  email: string;
  fax: string;
};

const EMPTY: Profile = {
  name: '',
  licenseNumber: '',
  brokerage: '',
  companyLicense: '',
  officeAddress: '',
  officePhone: '',
  cellPhone: '',
  email: '',
  fax: '',
};

export async function loader({ request }: { request: Request }) {
  const { user } = await getSession(request);
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true, agentProfile: true },
  });
  const p = (dbUser?.agentProfile as Partial<Profile> | null) ?? {};

  return Response.json({
    profile: {
      ...EMPTY,
      ...p,
      name: p.name ?? dbUser?.name ?? '',
      email: p.email ?? dbUser?.email ?? '',
    } as Profile,
  });
}

export async function action({ request }: { request: Request }) {
  const { user } = await getSession(request);
  const form = await request.formData();
  const get = (k: keyof Profile) => String(form.get(k) || '').trim();

  const profile: Profile = {
    name: get('name'),
    licenseNumber: get('licenseNumber'),
    brokerage: get('brokerage'),
    companyLicense: get('companyLicense'),
    officeAddress: get('officeAddress'),
    officePhone: get('officePhone'),
    cellPhone: get('cellPhone'),
    email: get('email'),
    fax: get('fax'),
  };

  await prisma.user.update({ where: { id: user.id }, data: { agentProfile: profile } });
  return Response.json({ saved: true });
}

const FIELDS: { key: keyof Profile; label: string; placeholder?: string; wide?: boolean }[] = [
  { key: 'name', label: 'Your name' },
  { key: 'licenseNumber', label: 'Your license #' },
  { key: 'brokerage', label: 'Brokerage / company name', wide: true },
  { key: 'companyLicense', label: 'Brokerage license #' },
  { key: 'officeAddress', label: 'Office address', wide: true },
  { key: 'officePhone', label: 'Office phone' },
  { key: 'cellPhone', label: 'Cell phone' },
  { key: 'email', label: 'Email' },
  { key: 'fax', label: 'Fax (optional)' },
];

export default function AgentInfoPage() {
  const { profile } = useLoaderData() as { profile: Profile };
  const fetcher = useFetcher<{ saved?: boolean }>();
  const [values, setValues] = useState<Profile>(profile);

  const saving = fetcher.state !== 'idle';
  const justSaved = fetcher.data?.saved && fetcher.state === 'idle';

  function save() {
    const data = new FormData();
    (Object.keys(values) as (keyof Profile)[]).forEach((k) => data.set(k, values[k]));
    void fetcher.submit(data, { method: 'post' });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">My Info</h1>
      <p className="mt-1 text-sm text-gray-500">
        Saved once and auto-filled into the broker section of every contract you create — so you
        never re-type your name, license, or brokerage.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.wide ? 'sm:col-span-2' : ''}>
            <label className="mb-1 block text-xs font-medium" style={{ color: INK }}>
              {f.label}
            </label>
            <input
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: INK }}
        >
          {saving ? 'Saving…' : 'Save my info'}
        </button>
        {justSaved && <span className="text-sm text-green-600">Saved ✓</span>}
      </div>
    </div>
  );
}
