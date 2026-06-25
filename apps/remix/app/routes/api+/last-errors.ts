import { getRecentErrors } from '~/utils/error-log.server';

// Diagnostic endpoint: returns recent server errors captured by handleError.
// Guarded by a key so it isn't casually readable. Temporary.
export function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  if (url.searchParams.get('key') !== 'foraker-debug-2026') {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  return Response.json({ errors: getRecentErrors() });
}
