import { Link, isRouteErrorResponse, useLoaderData, useRouteError } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { prisma } from '@documenso/prisma';

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

  return Response.json({ loop });
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
};

function DropZone({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 px-6 py-10 text-center">
      <div style={{ color: INK }}>{icon}</div>
      <p className="mt-3 text-sm font-semibold" style={{ color: INK }}>
        {title}
      </p>
      <p className="mt-1 text-xs text-gray-400">{description}</p>
    </div>
  );
}

export default function LoopDetailPage() {
  const { loop } = useLoaderData() as { loop: Loop };

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
        <p className="mb-6 text-sm text-gray-400">Anything you add is private until shared.</p>

        <p className="mb-2 text-center text-xs font-medium tracking-wide text-gray-400">
          DRAG &amp; DROP FILES HERE
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <DropZone
            title="TEMPLATES"
            description="Add a live form by selecting from templates."
            icon={
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            }
          />
          <DropZone
            title="BROWSE"
            description="Search and add any PDF from your computer into this folder."
            icon={
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
          />
          <DropZone
            title="EMAIL"
            description="Attach the files you need to an email and send them directly into this folder."
            icon={
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  );
}
