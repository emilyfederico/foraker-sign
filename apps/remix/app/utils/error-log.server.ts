// In-memory ring buffer of recent server-side errors. React Router sanitizes
// errors before they reach the client ("Unexpected Server Error"), so the real
// message/stack is only available server-side. handleError (entry.server.tsx)
// records here; /api/last-errors reads it back (secret-gated). Temporary debug
// aid — remove once the current 500 is fixed.

export type CapturedError = {
  time: string;
  url: string;
  name: string;
  message: string;
  stack: string;
};

const buffer: CapturedError[] = [];
const MAX = 25;

export function recordError(url: string, error: unknown): void {
  const isErr = error instanceof Error;
  buffer.unshift({
    time: new Date().toISOString(),
    url,
    name: isErr ? error.name : typeof error,
    message: isErr ? error.message : String(error),
    stack: isErr ? (error.stack ?? '') : '',
  });
  if (buffer.length > MAX) buffer.length = MAX;
}

export function getRecentErrors(): CapturedError[] {
  return buffer;
}
