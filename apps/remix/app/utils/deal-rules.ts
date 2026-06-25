// Foraker Sign — real-estate deal rules engine.
//
// Single source of truth for the defaults, math, and form-selection logic from
// the "Real Estate Contract Rules & Logic" reference. PURE logic only (no server
// or PDF imports) so it is safe to import from both client and server code.
//
// Universal rules apply in every state; state-specific values live in STATE_RULES.

export type StateCode = 'PA' | 'DE' | 'MD';
export type FinancingType = 'cash' | 'conventional' | 'fha' | 'va' | 'usda';

// ----------------------------------------------------------------------------
// Universal defaults (firm; an agent can override any of these per deal).
// ----------------------------------------------------------------------------
export const DEAL_DEFAULTS = {
  earnestMoneyPct: 0.01, // earnest money deposit = 1% of purchase price
  settlementDays: 30, // closing 30 days from today if unspecified
  depositDueDays: 5, // deposit due within ~5 days of signing
  mortgageCommitmentDays: 21, // mortgage commitment ~21 days from signing
  inspectionDays: 15, // inspection period ~15 days from signing
  sellerResponseDays: 7, // seller response window
  buyerVoidDays: 2, // buyer accept/void after seller response
  septicInspectionDays: 30, // septic inspections take longer
  loanTermYears: 30, // standard loan term
} as const;

// Typical down-payment fraction by financing type, used to derive the loan
// amount when the agent does not state a down payment. VA/USDA are 0%-down
// programs; cash needs no loan.
export const DEFAULT_DOWN_PAYMENT_PCT: Record<FinancingType, number> = {
  cash: 1,
  conventional: 0.2,
  fha: 0.035,
  va: 0,
  usda: 0,
};

// Recommended vs. optional inspections. Default: elect home + termite + radon,
// offer to waive the rest. Septic/well only when the property actually has them.
export const RECOMMENDED_INSPECTIONS = ['home', 'termite', 'radon'] as const;
export const OPTIONAL_INSPECTIONS = ['well', 'septic', 'lead', 'pool', 'survey'] as const;

// Financing-contingency presentation differs by state (see reference §4).
export const FINANCING_FORMAT: Record<StateCode, '3-option' | 'yes-no' | 'checkbox'> = {
  PA: '3-option', // Cash / Waived / Elected (default Elected)
  DE: 'yes-no', // is the sale contingent on financing?
  MD: 'checkbox', // pick which financing addendum attaches
};

// State-specific rules that genuinely differ (reference §6).
export const STATE_RULES: Record<
  StateCode,
  {
    label: string;
    transferTax: string;
    depositDisputeDays: number;
    soldAsIs: boolean;
    firstTimeBuyerTaxBreak: boolean;
    notes: string;
  }
> = {
  PA: {
    label: 'Pennsylvania',
    transferTax: '50/50',
    depositDisputeDays: 180,
    soldAsIs: false,
    firstTimeBuyerTaxBreak: false,
    notes: '14-page all-in-one contract; inspections & financing built into the main form.',
  },
  DE: {
    label: 'Delaware',
    transferTax: '50/50',
    depositDisputeDays: 60,
    soldAsIs: false,
    firstTimeBuyerTaxBreak: false,
    notes: '10-page contract; Yes/No financing; buyer pays deed prep; county matters.',
  },
  MD: {
    label: 'Maryland',
    transferTax: '50/50',
    depositDisputeDays: 0,
    soldAsIs: true,
    firstTimeBuyerTaxBreak: true,
    notes: 'Modular: short contract + addenda; sold AS-IS; first-time buyer transfer-tax break.',
  },
};

// ----------------------------------------------------------------------------
// Calendar helpers — settlement must never land on a weekend or US holiday.
// ----------------------------------------------------------------------------
function addDays(from: Date, days: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  // month 0-based, weekday 0=Sun..6=Sat, n=1..5
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - offset);
}

// Federal holidays for a year, including weekend-observed dates, as YYYY-MM-DD.
function usHolidaySet(year: number): Set<string> {
  const fixed = [
    [0, 1], // New Year's Day
    [5, 19], // Juneteenth
    [6, 4], // Independence Day
    [10, 11], // Veterans Day
    [11, 25], // Christmas
  ];
  const dates: Date[] = [
    nthWeekdayOfMonth(year, 0, 1, 3), // MLK — 3rd Mon Jan
    nthWeekdayOfMonth(year, 1, 1, 3), // Presidents — 3rd Mon Feb
    lastWeekdayOfMonth(year, 4, 1), // Memorial — last Mon May
    nthWeekdayOfMonth(year, 8, 1, 1), // Labor — 1st Mon Sep
    nthWeekdayOfMonth(year, 9, 1, 2), // Columbus — 2nd Mon Oct
    nthWeekdayOfMonth(year, 10, 4, 4), // Thanksgiving — 4th Thu Nov
  ];
  const set = new Set<string>();
  const add = (d: Date) => set.add(ymd(d));
  for (const [m, day] of fixed) {
    const d = new Date(year, m, day);
    add(d);
    // Observed: Sat -> Fri, Sun -> Mon
    if (d.getDay() === 6) add(addDays(d, -1));
    if (d.getDay() === 0) add(addDays(d, 1));
  }
  dates.forEach(add);
  return set;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isBusinessDay(d: Date): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  return !usHolidaySet(d.getFullYear()).has(ymd(d));
}

// Push a date forward to the next business day if it falls on a weekend/holiday.
export function bumpToBusinessDay(d: Date): Date {
  let out = d;
  while (!isBusinessDay(out)) out = addDays(out, 1);
  return out;
}

// ----------------------------------------------------------------------------
// Core computations.
// ----------------------------------------------------------------------------
export function computeSettlementDate(
  from = new Date(),
  days: number = DEAL_DEFAULTS.settlementDays,
): Date {
  return bumpToBusinessDay(addDays(from, days));
}

export function computeEarnestMoney(price: number): number {
  if (!price || price <= 0) return 0;
  return Math.round(price * DEAL_DEFAULTS.earnestMoneyPct);
}

// Down payment from an explicit amount, an explicit fraction, or the per-type
// default. `downPayment` may be a dollar amount (>=1) or a fraction (0<x<1).
export function computeDownPayment(
  price: number,
  financing: FinancingType,
  downPayment?: number,
): number {
  if (financing === 'cash') return price;
  if (downPayment && downPayment >= 1) return Math.min(downPayment, price);
  const pct =
    downPayment && downPayment > 0 && downPayment < 1
      ? downPayment
      : DEFAULT_DOWN_PAYMENT_PCT[financing];
  return Math.round(price * pct);
}

// Loan amount = purchase price − down payment (NOT price − earnest deposit).
export function computeLoanAmount(
  price: number,
  financing: FinancingType,
  downPayment?: number,
): number {
  if (financing === 'cash') return 0;
  return Math.max(0, price - computeDownPayment(price, financing, downPayment));
}

// Cash deals waive the financing AND appraisal contingencies.
export function isFinancingContingencyWaived(financing: FinancingType): boolean {
  return financing === 'cash';
}
export function isAppraisalContingencyWaived(financing: FinancingType): boolean {
  return financing === 'cash';
}

// ----------------------------------------------------------------------------
// Form / addenda selection (reference §3). Returns logical addendum keys; the
// generator maps these to the actual template files per state.
// ----------------------------------------------------------------------------
export type DealTerms = {
  state: StateCode;
  financing: FinancingType;
  electHomeInspection: boolean;
  hasSeptic: boolean;
  hasWell: boolean;
  sellerContribution: boolean;
  saleContingency: boolean; // contingent on the buyer selling their current home
  firstDealWithBuyer: boolean; // first deal with this buyer
  yearBuilt?: number;
};

export function selectAddenda(d: DealTerms): string[] {
  const out: string[] = [];

  // First-deal-only trio — attach together ONLY on the first deal with a buyer.
  if (d.firstDealWithBuyer) {
    out.push(
      'affiliated-business-disclosure',
      'consumer-information-statement',
      'buyer-agency-agreement',
    );
  }

  // Financing addendum by type (cash needs none).
  if (d.financing === 'fha') out.push('fha-financing-addendum');
  else if (d.financing === 'va') out.push('va-financing-addendum');
  else if (d.financing === 'conventional') out.push('conventional-financing-addendum');
  else if (d.financing === 'usda') out.push('usda-financing-addendum');

  if (d.electHomeInspection) out.push('inspection-addendum');
  if (d.sellerContribution) out.push('seller-contribution-addendum');
  if (d.hasSeptic) out.push('septic-inspection-addendum');
  if (d.hasWell) out.push('well-water-inspection-addendum');
  if (d.saleContingency) out.push('sale-contingency-addendum');

  // Lead paint disclosure is federal — required for pre-1978 homes.
  if (d.yearBuilt !== undefined && d.yearBuilt < 1978) out.push('lead-paint-disclosure');

  return out;
}

// ----------------------------------------------------------------------------
// Convenience: compute every derived value for a deal in one call.
// ----------------------------------------------------------------------------
export type ComputedDeal = {
  earnestMoney: number;
  downPayment: number;
  loanAmount: number;
  settlementDate: Date;
  offerDate: Date;
  depositDueDays: number;
  mortgageCommitmentDate: Date;
  inspectionDeadline: Date;
  loanTermYears: number;
  financingWaived: boolean;
  appraisalWaived: boolean;
  addenda: string[];
};

export function computeDeal(
  input: {
    price: number;
    financing: FinancingType;
    downPayment?: number;
    settlementDays?: number;
    offerDate?: Date;
  } & Omit<DealTerms, 'financing'>,
): ComputedDeal {
  const offerDate = input.offerDate ?? new Date();
  const financing = input.financing;
  return {
    earnestMoney: computeEarnestMoney(input.price),
    downPayment: computeDownPayment(input.price, financing, input.downPayment),
    loanAmount: computeLoanAmount(input.price, financing, input.downPayment),
    settlementDate: computeSettlementDate(
      offerDate,
      input.settlementDays ?? DEAL_DEFAULTS.settlementDays,
    ),
    offerDate,
    depositDueDays: DEAL_DEFAULTS.depositDueDays,
    mortgageCommitmentDate: bumpToBusinessDay(
      addDays(offerDate, DEAL_DEFAULTS.mortgageCommitmentDays),
    ),
    inspectionDeadline: bumpToBusinessDay(addDays(offerDate, DEAL_DEFAULTS.inspectionDays)),
    loanTermYears: DEAL_DEFAULTS.loanTermYears,
    financingWaived: isFinancingContingencyWaived(financing),
    appraisalWaived: isAppraisalContingencyWaived(financing),
    addenda: selectAddenda({ ...input, financing }),
  };
}

// Formatting helpers shared with the generator.
export function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatMdy(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}
