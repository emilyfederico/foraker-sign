import { Link, isRouteErrorResponse, useLoaderData, useRouteError } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { prisma } from '@documenso/prisma';

import { LoopPeople, type Person } from '~/components/general/loop-people';
import { TemplateFolderBrowser } from '~/components/general/template-folder-browser';

const INK = '#262626';

// Surface the real error on-page instead of the generic 500, so failures are
// diagnosable without server logs.
export function ErrorBoundary() {
  const error = useRouteError();
  let detail = 'Unknown error';
  if (isRouteErrorResponse(error)) {
    detail = `${error.status} ${error.statusText}${typeof error.data === 'string' ? ` — ${error.data}` : ''}`;
  } else if (error instanceof Error) {
    detail = `${error.message}\n\n${error.stack ?? ''}`;
  } else {
    detail = String(error);
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-bold text-red-700">Loop page error</h1>
      <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-red-50 p-4 text-xs text-red-800">
        {detail}
      </pre>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: 'Purchase',
  LISTING: 'Listing for Sale',
  LEASE: 'Lease',
};

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { loopId: string };
}) {
  const { user } = await getSession(request);
  // Scoped to the owner so an agent can't open another agent's loop.
  const loop = await prisma.transaction.findFirst({
    where: { id: params.loopId, userId: user.id },
  });

  if (!loop) {
    throw new Response('Loop not found', { status: 404 });
  }

  // The owning agent always appears on the loop. Their role follows the deal
  // type: on a listing they're the listing agent, otherwise the buyer agent.
  const agent = {
    name: user.name ?? user.email,
    email: user.email,
    role: loop.transactionType === 'LISTING' ? 'Listing Agent' : 'Buyer Agent',
  };

  return Response.json({ loop, agent });
}

// Add or remove people on the loop. People live in the `people` JSON column as
// an array of { id, name, email, role }.
export async function action({
  request,
  params,
}: {
  request: Request;
  params: { loopId: string };
}) {
  const { user } = await getSession(request);
  const form = await request.formData();
  const intent = String(form.get('intent') || '');

  const loop = await prisma.transaction.findFirst({
    where: { id: params.loopId, userId: user.id },
    select: { people: true },
  });
  if (!loop) {
    throw new Response('Loop not found', { status: 404 });
  }

  const people = (Array.isArray(loop.people) ? loop.people : []) as Person[];
  let next = people;

  if (intent === 'addPerson') {
    const name = String(form.get('name') || '').trim();
    if (!name) {
      return Response.json({ error: 'Name is required' }, { status: 400 });
    }
    next = [
      ...people,
      {
        id: crypto.randomUUID(),
        name,
        email: String(form.get('email') || '').trim(),
        role: String(form.get('role') || 'Other').trim() || 'Other',
      },
    ];
  } else if (intent === 'removePerson') {
    const id = String(form.get('id') || '');
    next = people.filter((p) => p.id !== id);
  } else {
    return Response.json({ error: 'Unknown intent' }, { status: 400 });
  }

  await prisma.transaction.updateMany({
    where: { id: params.loopId, userId: user.id },
    data: { people: next },
  });

  return Response.json({ ok: true });
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
  sentAt: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  people: Person[] | null;
};

type Agent = { name: string; email: string; role: string };

export default function LoopDetailPage() {
  const { loop, agent } = useLoaderData() as { loop: Loop; agent: Agent };
  const buyer = loop.buyerName ? { name: loop.buyerName, email: loop.buyerEmail ?? '' } : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between text-sm">
        <Link to="/loops" className="font-semibold" style={{ color: INK }}>
          ‹ BACK TO MY LOOPS
        </Link>
        <span className="font-semibold tracking-wide" style={{ color: INK }}>
          ACTIVITY LOG
        </span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">{loop.address}</h1>
            {loop.sentAt && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                ✓ Texted to buyer
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-4 text-sm">
            <span className="font-semibold tracking-wide" style={{ color: INK }}>
              {(TYPE_LABELS[loop.transactionType] ?? loop.transactionType).toUpperCase()}
            </span>
            <span className="text-gray-400">
              {loop.city}
              {loop.state ? `, ${loop.state}` : ''}
              {loop.mlsNumber ? ` · MLS# ${loop.mlsNumber}` : ''}
            </span>
          </div>
        </div>
        <Link
          to={`/loops/${loop.id}/fill`}
          className="shrink-0 rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
          style={{ backgroundColor: '#262626' }}
        >
          {loop.sentAt ? 'Open contract →' : 'Fill out contract →'}
        </Link>
      </div>

      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Add documents</h2>
          <span className="text-sm font-semibold" style={{ color: INK }}>
            ADD FOLDER
          </span>
        </div>
        <p className="mb-5 text-sm text-gray-400">Anything you add is private until shared.</p>

        <TemplateFolderBrowser />
      </div>

      <LoopPeople people={loop.people ?? []} agent={agent} buyer={buyer} />
    </div>
  );
}
