import { Outlet, isRouteErrorResponse, useRouteError } from 'react-router';

// Thin layout for /loops/:loopId so the detail (._index) and the fill (.fill)
// routes are siblings that each fully replace the view — rather than the detail
// page acting as a parent with no <Outlet/>, which made "Fill out contract" look
// dead (it navigated but the child never rendered).
export default function LoopIdLayout() {
  return <Outlet />;
}

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
