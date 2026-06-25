// Diagnostic: in-memory ring buffer of recent server errors. React Router
// sanitizes thrown errors to a generic 500 page, so this lets us read the real
// message + stack via GET /api/last-errors?key=... Temporary — remove once the
// underlying error is fixed.
type Entry = { time: string; url: string; message: string; stack: string };

const RING: Entry[] = [];
const MAX = 25;

export function recordServerError(error: unknown, request?: Request): void {
  const e = error instanceof Error ? error : new Error(String(error));
  RING.unshift({
    time: new Date().toISOString(),
    url: request?.url ?? '',
    message: e.message,
    stack: e.stack ?? '',
  });
  if (RING.length > MAX) RING.length = MAX;
}

export function getRecentErrors(): Entry[] {
  return RING;
}
