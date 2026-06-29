// Server-only: derives the BUYER's signing fields for a contract from the
// page-relative coordinate map. These become Documenso overlay fields on the
// envelope sent to the buyer (so the buyer signs/initials/dates exactly where
// the form requires) and grey "buyer completes this" markers on the agent's
// Fill page. Imported only from loaders/actions — never the client bundle.
import { CONTRACT_FIELD_MAP } from './contract-field-map.server';

// A box in the coordinate-map convention: page is 0-based, positions are
// fractions (0..1) of page width/height with a TOP-LEFT origin.
type FractionBox = {
  page: number;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
};

// Where the buyer signs/dates on each state's contract. Initials are derived
// automatically from the map (every `*buyers_initials*` field); the signature
// and date lines are not consistently named across states, so they're pinned
// here. Coordinates come straight from contract-field-map.server.ts.
// Verified by rendering each state's execution page and overlaying these boxes:
// DE buyer line 1 = p9_field_26 (date p9_field_27); MD's buyer column is the
// LEFT one (p10_field_22) — the field misleadingly named p10_buyer_signature is
// the SELLER's; PA buyer line 1 = p14_821buyer_1 (date p14_821buyer_date_1).
const BUYER_SIGN_CONFIG: Record<
  string,
  { sign: FractionBox & { sourceName?: string }; date: FractionBox & { sourceName?: string } }
> = {
  DE: {
    sign: {
      page: 8,
      xPct: 0.05882,
      yPct: 0.81032,
      wPct: 0.4254,
      hPct: 0.01641,
      sourceName: 'p9_field_26',
    },
    date: {
      page: 8,
      xPct: 0.58824,
      yPct: 0.81032,
      wPct: 0.34361,
      hPct: 0.01641,
      sourceName: 'p9_field_27',
    },
  },
  PA: {
    sign: {
      page: 13,
      xPct: 0.11831,
      yPct: 0.79194,
      wPct: 0.45752,
      hPct: 0.01641,
      sourceName: 'p14_821buyer_1',
    },
    date: {
      page: 13,
      xPct: 0.64118,
      yPct: 0.79194,
      wPct: 0.30229,
      hPct: 0.01641,
      sourceName: 'p14_821buyer_date_1',
    },
  },
  MD: {
    // Buyer signs the LEFT column line (p10_field_22); the right column is the
    // SELLER's. The "Buyer Signature" / "Date" captions split that one line, so
    // the signature takes its left ~60% and the date sits under the "Date" caption.
    sign: {
      page: 9,
      xPct: 0.05725,
      yPct: 0.81273,
      wPct: 0.27,
      hPct: 0.01641,
      sourceName: 'p10_field_22',
    },
    date: { page: 9, xPct: 0.355, yPct: 0.81273, wPct: 0.092, hPct: 0.01641 },
  },
};

// Per-page buyer-initials boxes for forms whose initials lines are NOT AcroForm
// widgets (so they aren't in CONTRACT_FIELD_MAP). PA's "Buyer Initials:____"
// footers were extracted from the embedded PDF. DE's initials come from the map
// instead; MD's contract has no per-page initials (signatures only at the end).
const EXTRA_INITIALS_BOXES: Record<string, FractionBox[]> = {
  PA: [
    { page: 0, xPct: 0.15334, yPct: 0.92635, wPct: 0.09, hPct: 0.0164 },
    { page: 1, xPct: 0.15958, yPct: 0.94908, wPct: 0.09, hPct: 0.0164 },
    { page: 2, xPct: 0.15958, yPct: 0.94908, wPct: 0.09, hPct: 0.0164 },
    { page: 3, xPct: 0.15958, yPct: 0.94908, wPct: 0.09, hPct: 0.0164 },
    { page: 4, xPct: 0.15958, yPct: 0.94908, wPct: 0.09, hPct: 0.0164 },
    { page: 5, xPct: 0.15958, yPct: 0.94908, wPct: 0.09, hPct: 0.0164 },
    { page: 6, xPct: 0.15958, yPct: 0.94908, wPct: 0.09, hPct: 0.0164 },
    { page: 7, xPct: 0.15958, yPct: 0.94908, wPct: 0.09, hPct: 0.0164 },
    { page: 8, xPct: 0.15958, yPct: 0.94908, wPct: 0.09, hPct: 0.0164 },
    { page: 9, xPct: 0.15958, yPct: 0.94908, wPct: 0.09, hPct: 0.0164 },
    { page: 10, xPct: 0.15958, yPct: 0.94908, wPct: 0.09, hPct: 0.0164 },
    { page: 11, xPct: 0.15958, yPct: 0.94908, wPct: 0.09, hPct: 0.0164 },
    { page: 12, xPct: 0.15958, yPct: 0.94908, wPct: 0.09, hPct: 0.0164 },
  ],
};

// A buyer field ready to attach to a Documenso recipient: percentages (0–100),
// 1-based page, top-left origin — the convention createEnvelope expects. The
// field type and its fieldMeta.type must correlate, so this is a discriminated
// union (createEnvelope's input type enforces the same correlation).
type Geometry = {
  page: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

export type BuyerEnvelopeField =
  | (Geometry & {
      type: 'SIGNATURE';
      fieldMeta: { type: 'signature'; required: boolean; label: string };
    })
  | (Geometry & {
      type: 'INITIALS';
      fieldMeta: { type: 'initials'; required: boolean; label: string };
    })
  | (Geometry & { type: 'DATE'; fieldMeta: { type: 'date'; required: boolean; label: string } });

// A buyer field for the agent's Fill page: fractions + 0-based page (the same
// convention the Fill page already uses for inputs), plus a short label.
export type BuyerMarker = {
  label: string;
  page: number;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
};

const round = (n: number) => Math.round(n * 1000) / 1000;

// Geometry only, in Documenso's convention (percentages, 1-based page). When
// `tall` (signatures) the box grows upward so its base still rests on the line.
function geom(box: FractionBox, tall: boolean): Geometry {
  const height = tall ? 0.032 : Math.max(box.hPct, 0.02);
  const top = tall ? box.yPct + box.hPct - height : box.yPct;
  return {
    page: box.page + 1,
    positionX: round(box.xPct * 100),
    positionY: round(top * 100),
    width: round(box.wPct * 100),
    height: round(height * 100),
  };
}

function buyerInitialBoxes(state: string): FractionBox[] {
  // Prefer real AcroForm initials widgets (DE); fall back to the extracted
  // overlay-only boxes (PA). States with neither (MD) get no per-page initials.
  const mapped = (CONTRACT_FIELD_MAP[state] ?? [])
    .filter((f) => /buyers_initials/i.test(f.name))
    .map(({ page, xPct, yPct, wPct, hPct }) => ({ page, xPct, yPct, wPct, hPct }));
  return mapped.length > 0 ? mapped : (EXTRA_INITIALS_BOXES[state] ?? []);
}

/**
 * The buyer's Documenso fields for a state: a SIGNATURE + DATE on the execution
 * page, plus INITIALS everywhere the form has a buyer-initials box. Returns []
 * for an unknown state (caller should treat that as "can't send yet").
 */
export function buyerEnvelopeFields(state: string): BuyerEnvelopeField[] {
  const cfg = BUYER_SIGN_CONFIG[state];
  if (!cfg) return [];

  return [
    {
      ...geom(cfg.sign, true),
      type: 'SIGNATURE',
      fieldMeta: { type: 'signature', required: true, label: 'Buyer signature' },
    },
    {
      ...geom(cfg.date, false),
      type: 'DATE',
      fieldMeta: { type: 'date', required: true, label: 'Date' },
    },
    ...buyerInitialBoxes(state).map(
      (b): BuyerEnvelopeField => ({
        ...geom(b, false),
        type: 'INITIALS',
        fieldMeta: { type: 'initials', required: true, label: 'Buyer initials' },
      }),
    ),
  ];
}

/** The same buyer spots, in the Fill page's coordinate convention, for markers. */
export function buyerMarkers(state: string): BuyerMarker[] {
  const cfg = BUYER_SIGN_CONFIG[state];
  if (!cfg) return [];
  const mark = (b: FractionBox, label: string): BuyerMarker => ({ label, ...b });
  return [
    mark(cfg.sign, 'Buyer signs'),
    mark(cfg.date, 'Date'),
    ...buyerInitialBoxes(state).map((b) => mark(b, 'Initial')),
  ];
}

/**
 * AcroForm field names the buyer owns — the agent's Fill page should NOT render
 * editable inputs for these (the buyer fills them when signing). Includes every
 * buyer-initials box plus the signature/date source lines where they map to a
 * real form field.
 */
export function buyerFieldNames(state: string): Set<string> {
  const names = new Set<string>();
  for (const f of CONTRACT_FIELD_MAP[state] ?? []) {
    if (/buyers_initials/i.test(f.name)) names.add(f.name);
  }
  const cfg = BUYER_SIGN_CONFIG[state];
  if (cfg?.sign.sourceName) names.add(cfg.sign.sourceName);
  if (cfg?.date.sourceName) names.add(cfg.date.sourceName);
  return names;
}
