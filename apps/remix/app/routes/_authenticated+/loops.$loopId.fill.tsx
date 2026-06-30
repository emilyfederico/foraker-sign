import { useEffect, useMemo, useRef, useState } from 'react';

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
import { Link, isRouteErrorResponse, useFetcher, useLoaderData, useRouteError } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { prisma } from '@documenso/prisma';

import {
  type BuyerMarker,
  buyerFieldNames,
  buyerMarkers,
} from '~/utils/contract-buyer-fields.server';
import { CONTRACT_FIELD_MAP, type FieldBox } from '~/utils/contract-field-map.server';
import { CONTRACT_FORMS_BASE64 } from '~/utils/contract-forms.server';
import { formValuesForState } from '~/utils/contract-generation.server';
import { sendLoopToBuyer } from '~/utils/contract-send.server';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const DARK = '#262626';

// A few wide fill-in fields begin at the left margin, directly under a printed
// "(Specify)" label that the form draws inside the field's own area — so a typed
// value would sit on top of that label. Shift the input's start past the label
// for these specific fields (fraction of page width).
const LABEL_INDENT: Record<string, number> = {
  // DE "ADDITIONAL INCLUSIONS (Specify)" / "ADDITIONAL EXCLUSIONS (Specify):"
  p2_field_4: 0.075,
  p2_field_6: 0.083,
};

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

  // The buyer completes their signature/initials/date when signing, so hide
  // those from the agent's editable inputs and show grey markers instead.
  const buyerNames = buyerFieldNames(state);
  const fields = (CONTRACT_FIELD_MAP[state] ?? []).filter((f) => !buyerNames.has(f.name));
  const markers = buyerMarkers(state);

  // AI defaults from the loop's property + buyer data, overlaid with saved values.
  const defaults = formValuesForState(
    state,
    {
      address: loop.address,
      city: loop.city,
      county: loop.city, // loop has no county; agent can correct
      price: loop.price,
      listOfficeName: '',
    },
    loop.buyerName ?? '',
  );
  const saved = (loop.fieldValues as Record<string, string> | null) ?? {};

  // If already sent, link to the buyer's signing document.
  let sentUrl: string | null = null;
  if (loop.sentDocumentId) {
    const team = await prisma.team.findFirst({
      where: { organisation: { ownerUserId: user.id } },
      select: { url: true },
    });
    if (team) {
      const base = process.env.NEXT_PUBLIC_WEBAPP_URL ?? '';
      sentUrl = `${base}/t/${team.url}/documents/${loop.sentDocumentId}`;
    }
  }

  return Response.json({
    loopId: loop.id,
    address: loop.address,
    state,
    pdfBase64,
    fields,
    markers,
    values: { ...defaults, ...saved },
    sentAt: loop.sentAt ? loop.sentAt.toISOString() : null,
    sentUrl,
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
  const intent = String(form.get('intent') || 'save');
  const raw = form.get('values');
  let values: Record<string, string> = {};
  try {
    values = JSON.parse(String(raw || '{}'));
  } catch {
    return Response.json({ error: 'Invalid values' }, { status: 400 });
  }

  // Always persist the latest field values first. Scoped to the owner so an
  // agent can't write into another agent's loop.
  await prisma.transaction.updateMany({
    where: { id: params.loopId, userId: user.id },
    data: { fieldValues: values },
  });

  if (intent !== 'send') {
    return Response.json({ saved: true });
  }

  // Text to buyer(s): collect up to two mobile numbers (one per buyer signer).
  const phones = [String(form.get('phone') || ''), String(form.get('phone2') || '')];
  if (!phones.some((p) => p.replace(/\D/g, '').length >= 10)) {
    return Response.json({ error: 'Enter a valid mobile number to text.' }, { status: 200 });
  }

  const loop = await prisma.transaction.findFirst({
    where: { id: params.loopId, userId: user.id },
  });
  if (!loop) {
    return Response.json({ error: 'Loop not found.' }, { status: 404 });
  }

  const result = await sendLoopToBuyer({
    userId: user.id,
    loop: {
      id: loop.id,
      state: loop.state,
      address: loop.address,
      city: loop.city,
      price: loop.price,
      buyerName: loop.buyerName,
      buyerEmail: loop.buyerEmail,
      fieldValues: loop.fieldValues,
    },
    phones,
    request,
  });

  if ('error' in result) {
    return Response.json({ error: result.error }, { status: 200 });
  }

  await prisma.transaction.updateMany({
    where: { id: params.loopId, userId: user.id },
    data: { sentDocumentId: result.documentId, sentAt: new Date() },
  });

  return Response.json({ sent: true, url: result.url, textedTo: result.textedTo });
}

type LoaderData = {
  loopId: string;
  address: string;
  state: string;
  pdfBase64: string;
  fields: FieldBox[];
  markers: BuyerMarker[];
  values: Record<string, string>;
  sentAt: string | null;
  sentUrl: string | null;
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
    markers,
    values: initialValues,
    sentAt,
    sentUrl,
  } = useLoaderData() as LoaderData;
  const fetcher = useFetcher<{
    saved?: boolean;
    sent?: boolean;
    url?: string;
    textedTo?: string;
    error?: string;
  }>();

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
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

  const markersByPage = useMemo(() => {
    const map: Record<number, BuyerMarker[]> = {};
    for (const m of markers) (map[m.page] ??= []).push(m);
    return map;
  }, [markers]);

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
    void fetcher.submit({ intent: 'save', values: JSON.stringify(values) }, { method: 'post' });
  }

  function sendToBuyer() {
    if (!phone.trim() || saving) return;
    void fetcher.submit(
      {
        intent: 'send',
        phone: phone.trim(),
        phone2: phone2.trim(),
        values: JSON.stringify(values),
      },
      { method: 'post' },
    );
  }

  const saving = fetcher.state !== 'idle';
  const pendingIntent = fetcher.formData?.get('intent');
  const data = fetcher.data;
  const justSaved = data?.saved;
  // Sent either earlier (from the loader) or just now (this submission).
  const sent = Boolean(sentAt) || Boolean(data?.sent);
  const docUrl = data?.url ?? sentUrl;
  const sendError = data?.error;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/loops/${loopId}`} className="text-sm font-semibold" style={{ color: DARK }}>
          ‹ Back to loop
        </Link>

        {sent ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-green-600">✓ Texted to buyer</span>
            {docUrl && (
              <a
                href={docUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline"
                style={{ color: DARK }}
              >
                View signing status →
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {justSaved && <span className="text-sm text-green-600">Saved</span>}
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ borderColor: DARK, color: DARK }}
            >
              {saving && pendingIntent === 'save' ? 'Saving…' : 'Save'}
            </button>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Buyer 1 mobile · +1 302 555 1234"
              className="w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1"
              style={{ outlineColor: DARK }}
            />
            <input
              type="tel"
              value={phone2}
              onChange={(e) => setPhone2(e.target.value)}
              placeholder="Buyer 2 mobile (optional)"
              className="w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1"
              style={{ outlineColor: DARK }}
            />
            <button
              onClick={sendToBuyer}
              disabled={saving || !phone.trim()}
              className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: DARK }}
            >
              {saving && pendingIntent === 'send'
                ? 'Texting…'
                : phone2.trim()
                  ? 'Text to buyers'
                  : 'Text to buyer'}
            </button>
          </div>
        )}
      </div>

      {sendError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {sendError}
        </p>
      )}

      <h1 className="mb-1 text-2xl font-bold text-gray-900">{address}</h1>
      <p className="mb-5 text-sm text-gray-500">
        {sent
          ? 'This contract has been texted to the buyer to sign. The grey spots are theirs to complete.'
          : `${state} contract · click any blank and type. Yellow fields are yours; grey spots are where the buyer signs.`}
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
                  // The AcroForm box bottom coincides with the form's printed
                  // fill-in line, so anchor the typed value's BASELINE to rest just
                  // on that line — level with the printed label beside it, never
                  // floating above it or dropping onto the next row.
                  //
                  // A single-line input (height == line-height) vertically centers
                  // its text. With the system-ui font (ascent ≈ 1.0em, descent ≈
                  // 0.231em) the baseline lands at
                  //   top + (boxH - 1.231 * fontPx) / 2 + fontPx
                  // so we solve `top` to put the baseline 1px above the line.
                  const widgetH = Math.max(f.hPct * size.height, 12);
                  const fontPx = Math.min(Math.max(widgetH * 0.85, 9), 13);
                  const boxH = fontPx * 1.3;
                  const line = (f.yPct + f.hPct) * size.height;
                  const baselineFromTop = (boxH - 1.231 * fontPx) / 2 + fontPx;
                  const top = line - 1 - baselineFromTop;
                  // Clear any printed label the form draws inside this field.
                  const indent = LABEL_INDENT[f.name] ?? 0;
                  return (
                    <input
                      key={`${pageIndex}-${i}`}
                      value={values[f.name] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      className="absolute box-border bg-yellow-100/25 text-gray-900 outline-none focus:bg-yellow-100/70 focus:ring-1"
                      style={{
                        left: (f.xPct + indent) * size.width,
                        top,
                        width: (f.wPct - indent) * size.width,
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
            {/* Grey markers for the spots the buyer completes when signing. */}
            {(markersByPage[pageIndex] ?? []).map((m, i) => (
              <div
                key={`m-${pageIndex}-${i}`}
                title="The buyer completes this when you send the contract"
                className="pointer-events-none absolute flex items-center justify-center overflow-hidden rounded-[2px] border border-dashed text-[8px] font-semibold uppercase leading-none tracking-wide"
                style={{
                  left: m.xPct * size.width,
                  top: m.yPct * size.height,
                  width: m.wPct * size.width,
                  height: Math.max(m.hPct * size.height, 16),
                  borderColor: '#9ca3af',
                  backgroundColor: 'rgba(156,163,175,0.14)',
                  color: '#6b7280',
                }}
              >
                {m.label}
              </div>
            ))}
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
