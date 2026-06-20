import { getRecentErrors } from '~/utils/error-log.server';

// Secret-gated readout of recent server-side errors captured by handleError.
// Temporary debug aid — remove once the current 500 is fixed.
const SECRET = process.env.PROPERTY_SYNC_SECRET ?? 'foraker-sync-secret';

export function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const secret = request.headers.get('x-sync-secret') ?? url.searchParams.get('secret');

  if (secret !== SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Response.json({ errors: getRecentErrors() });
}
