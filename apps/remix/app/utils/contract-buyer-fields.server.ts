// Server-only: derives each BUYER's signing fields for a contract from the
// page-relative coordinate map. These become Documenso overlay fields on the
// envelope (so each buyer signs/dates exactly where the form requires) and grey
// "buyer signs here" markers on the agent's Fill page. The per-page initials are
// NOT buyer fields — the agent types them and they bake into the PDF, so the
// buyer only signs + dates. Imported only from loaders/actions — never client.
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

type SignDate = {
  sign: FractionBox & { sourceName?: string };
  date: FractionBox & { sourceName?: string };
};

// Where each buyer signs/dates. Most contracts have two buyer lines; we model
// both so co-buyers can each sign their own. Coordinates come straight from
// contract-field-map.server.ts and were verified by rendering each execution
// page. DE buyer lines = p9_field_26/28 (dates 27/29); PA = p14_821/822buyer
// (+ _date); MD's buyer column is the LEFT one (p10_field_22/23) — the field
// misleadingly named p10_buyer_signature is the SELLER's.
const BUYER_SIGN_CONFIG: Record<string, SignDate[]> = {
  DE: [
    {
      sign: { page: 8, xPct: 0.05882, yPct: 0.81032, wPct: 0.4254, hPct: 0.01641, sourceName: 'p9_field_26' },
      date: { page: 8, xPct: 0.58824, yPct: 0.81032, wPct: 0.34361, hPct: 0.01641, sourceName: 'p9_field_27' },
    },
    {
      sign: { page: 8, xPct: 0.05882, yPct: 0.8379, wPct: 0.4254, hPct: 0.01641, sourceName: 'p9_field_28' },
      date: { page: 8, xPct: 0.58824, yPct: 0.8379, wPct: 0.34361, hPct: 0.01641, sourceName: 'p9_field_29' },
    },
  ],
  PA: [
    {
      sign: { page: 13, xPct: 0.11831, yPct: 0.79194, wPct: 0.45752, hPct: 0.01641, sourceName: 'p14_821buyer_1' },
      date: { page: 13, xPct: 0.64118, yPct: 0.79194, wPct: 0.30229, hPct: 0.01641, sourceName: 'p14_821buyer_date_1' },
    },
    {
      sign: { page: 13, xPct: 0.11831, yPct: 0.80961, wPct: 0.45752, hPct: 0.01641, sourceName: 'p14_822buyer_1' },
      date: { page: 13, xPct: 0.64118, yPct: 0.80961, wPct: 0.30229, hPct: 0.01641, sourceName: 'p14_822buyer_date_1' },
    },
  ],
  MD: [
    // Buyer column is the LEFT line; "Buyer Signature" / "Date" captions split it.
    {
      sign: { page: 9, xPct: 0.05725, yPct: 0.81273, wPct: 0.27, hPct: 0.01641, sourceName: 'p10_field_22' },
      date: { page: 9, xPct: 0.355, yPct: 0.81273, wPct: 0.092, hPct: 0.01641 },
    },
    {
      sign: { page: 9, xPct: 0.05725, yPct: 0.84322, wPct: 0.27, hPct: 0.01641, sourceName: 'p10_field_23' },
      date: { page: 9, xPct: 0.355, yPct: 0.84322, wPct: 0.092, hPct: 0.01641 },
    },
  ],
};

// A buyer field ready to attach to a Documenso recipient: percentages (0–100),
// 1-based page, top-left origin — the convention createEnvelope expects.
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

/** How many buyer signing slots a state's contract has (0 = can't send yet). */
export function buyerCount(state: string): number {
  return (BUYER_SIGN_CONFIG[state] ?? []).length;
}

/**
 * One buyer's Documenso fields (signature + date) on the execution page.
 * `buyerIndex` selects which buyer line. Returns [] for an unknown state/slot.
 */
export function buyerEnvelopeFields(state: string, buyerIndex = 0): BuyerEnvelopeField[] {
  const cfg = BUYER_SIGN_CONFIG[state]?.[buyerIndex];
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
  ];
}

/** Every buyer's sign/date spots, in the Fill page's coordinate convention. */
export function buyerMarkers(state: string): BuyerMarker[] {
  const cfgs = BUYER_SIGN_CONFIG[state] ?? [];
  const out: BuyerMarker[] = [];
  cfgs.forEach((cfg, i) => {
    const who = cfgs.length > 1 ? `Buyer ${i + 1}` : 'Buyer';
    out.push({ label: `${who} signs`, ...cfg.sign });
    out.push({ label: 'Date', ...cfg.date });
  });
  return out;
}

/**
 * AcroForm field names the buyers own — the agent's Fill page should NOT render
 * editable inputs for these (the buyer signs/dates them). Just the signature and
 * date lines; initials are agent-typed, so they are intentionally NOT here.
 */
export function buyerFieldNames(state: string): Set<string> {
  const names = new Set<string>();
  for (const cfg of BUYER_SIGN_CONFIG[state] ?? []) {
    if (cfg.sign.sourceName) names.add(cfg.sign.sourceName);
    if (cfg.date.sourceName) names.add(cfg.date.sourceName);
  }
  return names;
}
