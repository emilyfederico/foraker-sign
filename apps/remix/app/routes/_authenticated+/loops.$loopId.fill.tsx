import { useEffect, useMemo, useRef, useState } from 'react';

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
import { Link, isRouteErrorResponse, useFetcher, useLoaderData, useRouteError } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { prisma } from '@documenso/prisma';

import { CONTRACT_FIELD_MAP, type FieldBox } from '~/utils/contract-field-map.server';
import { CONTRACT_FORMS_BASE64 } from '~/utils/contract-forms.server';
import { formValuesForState } from '~/utils/contract-generation.server';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const DARK = '#262626';

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
      <h1 className="text-xl font-bold text-red-700">Fill page error</h1>
      <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-red-50 p-4 text-xs text-red-800">
        {detail}
      </pre>
    </div>
  );
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { loopId: string };
}) {
  const { user } = await getSession(request);
  const loop = await prisma.transaction.findFirst({
    where: { id: params.loopId, userId: user.id },
  });
  if (!loop) {
    throw new Response('Loop not found', { status: 404 });
  }

  const state = (loop.state || 'DE').toUpperCase();
  const pdfBase64 = CONTRACT_FORMS_BASE64[state];
  const fields = CONTRACT_FIELD_MAP[state] ?? [];

  // AI defaults from the loop's property data, overlaid with any saved values.
  const defaults = formValuesForState(
    state,
    {
      address: loop.address,
      city: loop.city,
      county: loop.city, // loop has no county; agent can correct
      price: loop.price,
      listOfficeName: '',
    },
    '',
  );
  const saved = (loop.fieldValues as Record<string, string> | null) ?? {};

  return Response.json({
    loopId: loop.id,
    address: loop.address,
    state,
    pdfBase64,
    fields,
    values: { ...defaults, ...saved },
  });
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { loopId: string };
}) {
  const { user } = await getSession(request);
  const form = await request.formData();
  const raw = form.get('values');
  let values: Record<string, string> = {};
  try {
    values = JSON.parse(String(raw || '{}'));
  } catch {
    return Response.json({ error: 'Invalid values' }, { status: 400 });
  }
  // Scoped to the owner so an agent can't save into another agent's loop.
  await prisma.transaction.updateMany({
    where: { id: params.loopId, userId: user.id },
    data: { fieldValues: values },
  });
  return Response.json({ saved: true });
}

type LoaderData = {
  loopId: string;
  address: string;
  state: string;
  pdfBase64: string;
  fields: FieldBox[];
  values: Record<string, string>;
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export default function FillContractPage() {
  const {
    loopId,
    address,
    state,
    pdfBase64,
    fields,
    values: initialValues,
  } = useLoaderData() as LoaderData;
  const fetcher = useFetcher();

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [pages, setPages] = useState<{ width: number; height: number }[]>([]);
  const [renderError, setRenderError] = useState<string | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const targetWidthRef = useRef(820);

  const fieldsByPage = useMemo(() => {
    const map: Record<number, FieldBox[]> = {};
    for (const f of fields) (map[f.page] ??= []).push(f);
    return map;
  }, [fields]);

  // 1) Load the PDF and measure each page (this populates `pages`, which mounts
  // the canvases).
  useEffect(() => {
    let cancelled = false;
    setRenderError(null);
    const bytes = base64ToBytes(pdfBase64);
    const targetWidth = Math.min(containerRef.current?.clientWidth ?? 820, 900);
    targetWidthRef.current = targetWidth;

    void (async () => {
      try {
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        const sizes: { width: number; height: number }[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const scale = targetWidth / page.getViewport({ scale: 1 }).width;
          const viewport = page.getViewport({ scale });
          sizes.push({ width: viewport.width, height: viewport.height });
        }
        if (cancelled) return;
        setPages(sizes);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[FillRender] pdf load failed', err);
        if (!cancelled) setRenderError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfBase64]);

  // 2) Render into the canvases AFTER they mount. Keying on `pages` (an effect,
  // not requestAnimationFrame) guarantees the canvas refs exist — the rAF
  // approach raced the DOM commit and silently skipped rendering once the pages
  // gained many overlay children.
  useEffect(() => {
    const pdf = pdfRef.current;
    if (!pdf || pages.length === 0) return;
    let cancelled = false;
    const targetWidth = targetWidthRef.current;
    // Render at the screen's pixel density for sharp text. The CSS size stays
    // logical so overlays still line up. Per page we try the hi-res buffer first
    // and fall back to 1x if it fails — so the worst case is blurry, never blank.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    void (async () => {
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled) return;
        const canvas = canvasRefs.current[i - 1];
        if (!canvas) continue;
        try {
          const page = await pdf.getPage(i);
          const scale = targetWidth / page.getViewport({ scale: 1 }).width;
          const logical = page.getViewport({ scale });
          canvas.style.width = `${Math.floor(logical.width)}px`;
          canvas.style.height = `${Math.floor(logical.height)}px`;
          for (const factor of dpr > 1 ? [dpr, 1] : [1]) {
            try {
              const vp = page.getViewport({ scale: scale * factor });
              canvas.width = Math.floor(vp.width);
              canvas.height = Math.floor(vp.height);
              await page.render({ canvas, viewport: vp }).promise;
              break;
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error(`[FillRender] page ${i} @${factor}x failed`, err);
            }
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[FillRender] page ${i} failed`, err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pages]);

  function save() {
    void fetcher.submit({ values: JSON.stringify(values) }, { method: 'post' });
  }

  const saving = fetcher.state !== 'idle';
  const justSaved = fetcher.data && (fetcher.data as { saved?: boolean }).saved;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link to={`/loops/${loopId}`} className="text-sm font-semibold" style={{ color: DARK }}>
          ‹ Back to loop
        </Link>
        <div className="flex items-center gap-3">
          {justSaved && <span className="text-sm text-green-600">Saved</span>}
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: DARK }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <h1 className="mb-1 text-2xl font-bold text-gray-900">{address}</h1>
      <p className="mb-5 text-sm text-gray-500">
        {state} contract · click any blank and type. Pre-filled fields can be edited.
      </p>

      <div ref={containerRef} className="flex flex-col items-center gap-6">
        {pages.map((size, pageIndex) => (
          <div
            key={pageIndex}
            className="relative border border-gray-200 bg-white shadow-sm"
            style={{ width: size.width, height: size.height }}
          >
            <canvas
              ref={(el) => {
                canvasRefs.current[pageIndex] = el;
              }}
              className="absolute left-0 top-0"
            />
            {(fieldsByPage[pageIndex] ?? []).map((f, i) =>
              f.type === 'checkbox' ? (
                <button
                  key={`${pageIndex}-${i}`}
                  type="button"
                  aria-pressed={Boolean(values[f.name])}
                  title="Click to check / uncheck"
                  onClick={() =>
                    setValues((v) => {
                      const next = { ...v };
                      if (next[f.name]) {
                        delete next[f.name];
                      } else {
                        next[f.name] = 'X';
                      }
                      return next;
                    })
                  }
                  className="absolute flex items-center justify-center rounded-[1px] hover:bg-blue-300/40"
                  style={{
                    left: `${f.xPct * 100}%`,
                    top: `${f.yPct * 100}%`,
                    width: `${f.wPct * 100}%`,
                    height: `${f.hPct * 100}%`,
                  }}
                >
                  {values[f.name] ? (
                    <svg
                      viewBox="0 0 10 10"
                      className="h-full w-full"
                      style={{ color: DARK }}
                      aria-hidden="true"
                    >
                      <path
                        d="M2 2 L8 8 M8 2 L2 8"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : null}
                </button>
              ) : (
                (() => {
                  // Rest the value on the form's printed line. The AcroForm box
                  // (yPct/hPct) sits slightly above the line, so drop the text down
                  // by a fraction of the line height to land on it. The 0.55 nudge
                  // is tunable. Positioned in px off the rendered page size.
                  const widgetH = Math.max(f.hPct * size.height, 12);
                  const fontPx = Math.min(Math.max(widgetH * 0.8, 8.5), 13);
                  const boxH = fontPx * 1.2;
                  const lineY = (f.yPct + f.hPct) * size.height + widgetH * 0.55;
                  return (
                    <input
                      key={`${pageIndex}-${i}`}
                      value={values[f.name] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      className="absolute box-border bg-yellow-100/25 text-gray-900 outline-none focus:bg-yellow-100/70 focus:ring-1"
                      style={{
                        left: f.xPct * size.width,
                        top: lineY - boxH,
                        width: f.wPct * size.width,
                        height: boxH,
                        fontSize: fontPx,
                        lineHeight: `${boxH}px`,
                        padding: '0 2px',
                      }}
                    />
                  );
                })()
              ),
            )}
          </div>
        ))}
        {renderError ? (
          <div className="w-full max-w-2xl break-words rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800">
            <p className="mb-1 font-semibold">Contract failed to render</p>
            <pre className="whitespace-pre-wrap">{renderError}</pre>
          </div>
        ) : (
          pages.length === 0 && <p className="py-12 text-sm text-gray-400">Loading contract…</p>
        )}
      </div>
    </div>
  );
}
