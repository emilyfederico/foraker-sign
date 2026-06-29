import Anthropic from '@anthropic-ai/sdk';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { prisma } from '@documenso/prisma';

import { formValuesForState } from '~/utils/contract-generation.server';
import {
  type FinancingType,
  type StateCode,
  computeDeal,
  formatMdy,
  formatUsd,
} from '~/utils/deal-rules';

// A recognizable phrase embedded in the consolidated deal-terms question so we
// can tell, on the next stateless turn, that we've already asked it once (and
// shouldn't loop on it — we generate with sensible defaults after one round).
const DEAL_TERMS_MARKER = 'a few details before I build it:';

const WEBAPP_URL = process.env.NEXT_PUBLIC_WEBAPP_URL ?? 'https://sign.foraker.ai';

// Valid contract states (the contract is generated into the logged-in agent's
// own workspace by generateContractDocument).
const VALID_STATES = new Set(['MD', 'DE', 'PA']);

// Parsed shape Claude returns from the realtor's free-text request.
// Empty string is the "not stated" sentinel — simpler and more robust under
// structured-output schema constraints than a nullable union type.
type ParsedRequest = {
  state: 'PA' | 'MD' | 'DE' | '';
  address: string;
  county: string;
  buyerName: string;
  buyerEmail: string;
  purchasePrice: number;
  financing: FinancingType | '';
  downPayment: number;
  settlementDays: number;
  hasSeptic: 'yes' | 'no' | '';
  hasWell: 'yes' | 'no' | '';
  electHomeInspection: 'yes' | 'no' | '';
  firstDeal: 'yes' | 'no' | '';
};

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    state: {
      type: 'string',
      enum: ['PA', 'MD', 'DE', ''],
      description: 'The contract template state the realtor asked for. Empty string if not stated.',
    },
    address: {
      type: 'string',
      description:
        'The street address of the property as stated (e.g. "123 Memorial Drive"). Empty string if not stated.',
    },
    county: {
      type: 'string',
      description:
        'The county the property is in, if stated (important for DE: New Castle, Kent, or Sussex). Empty string if not stated.',
    },
    buyerName: {
      type: 'string',
      description: 'The full name of the buyer. Empty string if not stated.',
    },
    buyerEmail: {
      type: 'string',
      description: "The buyer's email address. Empty string if not stated.",
    },
    purchasePrice: {
      type: 'number',
      description: 'The purchase/offer price in dollars (e.g. "485k" -> 485000). 0 if not stated.',
    },
    financing: {
      type: 'string',
      enum: ['cash', 'conventional', 'fha', 'va', 'usda', ''],
      description: 'Financing type. "cash deal" -> cash. Empty string if not stated.',
    },
    downPayment: {
      type: 'number',
      description:
        'Down payment as a dollar amount (e.g. 20000) or a fraction (e.g. 0.2 for 20%). 0 if not stated.',
    },
    settlementDays: {
      type: 'number',
      description:
        'Days until settlement/closing if stated as a number of days (e.g. "settle in 45 days" -> 45). 0 if not stated or an explicit date was given.',
    },
    hasSeptic: {
      type: 'string',
      enum: ['yes', 'no', ''],
      description: 'Whether the property has a septic system, if stated. Empty string if unknown.',
    },
    hasWell: {
      type: 'string',
      enum: ['yes', 'no', ''],
      description: 'Whether the property has a well, if stated. Empty string if unknown.',
    },
    electHomeInspection: {
      type: 'string',
      enum: ['yes', 'no', ''],
      description:
        'Whether a home inspection is elected. "waive inspection" -> no. Empty string if not stated.',
    },
    firstDeal: {
      type: 'string',
      enum: ['yes', 'no', ''],
      description:
        "Whether this is the agent's first deal with this buyer (triggers buyer-agency/CIS/affiliated-business forms). Empty string if not stated.",
    },
  },
  required: [
    'state',
    'address',
    'county',
    'buyerName',
    'buyerEmail',
    'purchasePrice',
    'financing',
    'downPayment',
    'settlementDays',
    'hasSeptic',
    'hasWell',
    'electHomeInspection',
    'firstDeal',
  ],
  additionalProperties: false,
} as const;

// Common street-suffix variants collapsed to a canonical token so that
// "123 Memorial Drive" matches the stored "123 Memorial Dr".
const SUFFIX_MAP: Record<string, string> = {
  drive: 'dr',
  dr: 'dr',
  street: 'st',
  st: 'st',
  avenue: 'ave',
  ave: 'ave',
  road: 'rd',
  rd: 'rd',
  court: 'ct',
  ct: 'ct',
  lane: 'ln',
  ln: 'ln',
  boulevard: 'blvd',
  blvd: 'blvd',
  place: 'pl',
  pl: 'pl',
  circle: 'cir',
  cir: 'cir',
  crossing: 'xing',
  xing: 'xing',
  terrace: 'ter',
  ter: 'ter',
  parkway: 'pkwy',
  pkwy: 'pkwy',
};

function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => SUFFIX_MAP[tok] ?? tok)
    .join(' ');
}

// Find the best property match for a free-text address. Lookup is by street
// number (cheap DB filter), then a normalized comparison in JS to tolerate
// suffix abbreviations. State is NOT used to filter — a realtor may request a
// PA contract for a property whose record lists a different state.
async function findProperty(address: string) {
  const streetNum = address.match(/\d+/)?.[0];

  const candidates = await prisma.property.findMany({
    where: streetNum
      ? { address: { contains: streetNum, mode: 'insensitive' } }
      : { address: { contains: address, mode: 'insensitive' } },
    take: 50,
  });

  if (candidates.length === 0) return null;

  const target = normalizeAddress(address);

  // Exact normalized match wins.
  const exact = candidates.find((c: { address: string }) => normalizeAddress(c.address) === target);
  if (exact) return exact;

  // Otherwise pick the candidate sharing the most tokens with the query.
  const targetTokens = new Set(target.split(' '));
  let best: (typeof candidates)[number] | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const tokens = normalizeAddress(c.address).split(' ');
    const score = tokens.filter((t) => targetTokens.has(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  // Require at least the street number plus one more token to avoid a wild guess.
  return bestScore >= 2 ? best : null;
}

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Must be a signed-in agent — the contract is generated into their workspace.
  let userId: number;
  try {
    const { user } = await getSession(request);
    userId = user.id;
  } catch {
    return Response.json({ reply: 'Please sign in to use the assistant.' }, { status: 200 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { reply: 'The assistant is not configured yet — missing ANTHROPIC_API_KEY.' },
      { status: 200 },
    );
  }

  let body: {
    message?: string;
    history?: { role?: string; content?: string }[];
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return Response.json({ reply: 'Tell me what contract to create.' }, { status: 200 });
  }

  // Build the full conversation so the model remembers earlier answers — the chat
  // is otherwise stateless and would re-ask for details already given. The
  // Anthropic API requires the first message to be from the user.
  const conversation: { role: 'user' | 'assistant'; content: string }[] = [
    ...(Array.isArray(body.history) ? body.history : []).map((h) => ({
      role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: String(h.content ?? '').trim(),
    })),
    { role: 'user' as const, content: message },
  ].filter((t) => t.content);
  while (conversation.length > 1 && conversation[0].role !== 'user') {
    conversation.shift();
  }

  const anthropic = new Anthropic({ apiKey });

  // 1. Parse the free-text request into structured fields.
  let parsed: ParsedRequest;
  try {
    const completion = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system:
        'You are a real-estate contract intake assistant for a PA/MD/DE brokerage. Read the ' +
        'ENTIRE conversation and extract the deal into the schema, combining everything the ' +
        'realtor has said across all messages. ' +
        'Detect the STATE from the property address when possible (city, state, or ZIP) — e.g. ' +
        'an address in Dover, DE -> DE; Pittsburgh, PA -> PA. ' +
        'Capture the county if stated (important for DE: New Castle, Kent, Sussex). ' +
        'Accept casual language: "cash deal" -> financing cash; "10k down" -> downPayment 10000; ' +
        '"20% down" -> downPayment 0.2; "waive inspection" -> electHomeInspection no; ' +
        '"settle in 45 days" -> settlementDays 45; "485k" -> purchasePrice 485000. ' +
        'A short reply like "DE", "cash", "no septic", "first one", or "Jacob Arnberger" answers ' +
        'the most recent question — apply it to the correct field. ' +
        'Use the empty string for unstated text/enum fields and 0 for unstated numbers. NEVER ' +
        'invent values: only set septic, well, financing, inspection, or first-deal when the ' +
        'realtor actually says so — otherwise leave them empty.',
      output_config: { format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
      messages: conversation,
    });

    const text = completion.content.find((b) => b.type === 'text');
    let raw = text && 'text' in text ? text.text : '';
    // Be tolerant of a model that wraps JSON in ``` fences instead of emitting raw JSON.
    raw = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    parsed = JSON.parse(raw || '{}') as ParsedRequest;
  } catch (err) {
    console.error('Chat parse error:', err);
    const detail = (err instanceof Error ? err.message : String(err)).toLowerCase();
    // Billing/auth problems on the Anthropic account aren't the agent's fault —
    // tell the operator what to actually fix instead of "trouble understanding".
    if (
      detail.includes('credit balance') ||
      detail.includes('billing') ||
      detail.includes('quota')
    ) {
      return Response.json(
        {
          reply:
            'The contract assistant is paused — the Anthropic API account is out of credits. Add credits at console.anthropic.com → Billing and it will work again immediately.',
        },
        { status: 200 },
      );
    }
    if (detail.includes('authentication') || detail.includes('api key') || detail.includes('401')) {
      return Response.json(
        {
          reply:
            'The contract assistant isn’t configured correctly — the Anthropic API key looks invalid. Re-check ANTHROPIC_API_KEY in Railway.',
        },
        { status: 200 },
      );
    }
    return Response.json(
      {
        reply:
          'I had trouble understanding that. Try: "Make a PA contract for 123 Main St, buyer John Smith".',
      },
      { status: 200 },
    );
  }

  // 2. Hard requirements — ask for these one at a time (no contract without them).
  if (!parsed.state || !VALID_STATES.has(parsed.state)) {
    return Response.json(
      { reply: 'Which state is this contract for — PA, MD, or DE?' },
      { status: 200 },
    );
  }
  if (!parsed.address) {
    return Response.json({ reply: 'What property address should I use?' }, { status: 200 });
  }
  if (!parsed.buyerName) {
    return Response.json(
      { reply: 'Who is the buyer? Please include their full name.' },
      { status: 200 },
    );
  }

  // 3. Look up the property to enrich the loop (city/county/price). Optional — a
  //    realtor can start a contract for an address not yet synced from MLS.
  const property = await findProperty(parsed.address);
  const address = property?.address ?? parsed.address;
  const city = String((property as { city?: unknown } | null)?.city ?? '');
  const county = String((property as { county?: unknown } | null)?.county ?? '') || parsed.county;
  const price =
    parsed.purchasePrice || Number((property as { price?: unknown } | null)?.price) || 0;

  // 4. Interview the agent for the deal terms that drive the contract — but only
  //    once. We don't ask for things that have firm defaults (deposit-due days,
  //    inspection window, mortgage-commitment days, loan term) or that come from
  //    MLS / another screen (parcel, listing agent, buyer phone & email). Empty
  //    means "not stated yet"; the model never guesses these.
  const alreadyAsked = conversation.some(
    (m) => m.role === 'assistant' && m.content.includes(DEAL_TERMS_MARKER),
  );
  if (!alreadyAsked) {
    const missing: string[] = [];
    if (price <= 0) missing.push('the purchase price');
    if (!parsed.financing)
      missing.push('how the buyer is financing it (cash, conventional, FHA, VA, or USDA)');
    if (parsed.state === 'DE' && !county) missing.push('the county (New Castle, Kent, or Sussex)');
    if (!parsed.hasSeptic) missing.push('whether the property has a septic system');
    if (!parsed.hasWell) missing.push('whether it has a well');
    if (!parsed.electHomeInspection)
      missing.push('whether to include a home inspection (I recommend keeping it)');
    if (!parsed.firstDeal)
      missing.push('whether this is your first deal with this buyer (adds the buyer-agency forms)');

    if (missing.length > 0) {
      const list =
        missing.length === 1 ? missing[0] : missing.map((m, i) => `\n${i + 1}. ${m}`).join('');
      return Response.json(
        { reply: `Got it — just ${DEAL_TERMS_MARKER}${missing.length === 1 ? ' ' : ''}${list}` },
        { status: 200 },
      );
    }
  }

  // 5. Seed the contract field values from everything gathered so the Fill page
  //    opens pre-filled. Deal-rule defaults (1% earnest money, +30d settlement
  //    bumped off weekends, loan = price − down payment, mortgage-commitment
  //    date) are derived when a price is known. Anything the agent never answered
  //    falls back to a sensible default (conventional financing, inspection kept).
  const financing: FinancingType = parsed.financing || 'conventional';
  const electHomeInspection = parsed.electHomeInspection !== 'no';
  const computed =
    price > 0
      ? computeDeal({
          price,
          financing,
          downPayment: parsed.downPayment || undefined,
          settlementDays: parsed.settlementDays || undefined,
          state: parsed.state as StateCode,
          electHomeInspection,
          hasSeptic: parsed.hasSeptic === 'yes',
          hasWell: parsed.hasWell === 'yes',
          sellerContribution: false,
          saleContingency: false,
          firstDealWithBuyer: parsed.firstDeal === 'yes',
        })
      : undefined;

  const fieldValues = formValuesForState(
    parsed.state,
    { address, city, county, price },
    parsed.buyerName,
    computed,
  );

  // 6. Create the loop in the agent's workspace and point them at the fillable
  //    contract. The buyer email is optional here — delivery is by text later.
  let loopId: string;
  try {
    const loop = await prisma.transaction.create({
      data: {
        userId,
        address,
        city: city || null,
        state: parsed.state,
        price: price || null,
        transactionType: 'PURCHASE',
        buyerName: parsed.buyerName,
        buyerEmail: parsed.buyerEmail || null,
        fieldValues,
      },
    });
    loopId = loop.id;
  } catch (err) {
    console.error('Loop creation error:', err);
    return Response.json(
      { reply: 'I couldn’t create the contract just now — please try again.' },
      { status: 200 },
    );
  }

  // Restate the price and rule-derived terms so the agent can confirm at a glance.
  let summary = '';
  if (computed && price > 0) {
    const loanPart =
      financing === 'cash'
        ? 'cash (financing & appraisal contingencies waived)'
        : `${financing}, loan ${formatUsd(computed.loanAmount)}`;
    summary =
      ` Price ${formatUsd(price)}, earnest money ${formatUsd(computed.earnestMoney)} (1%),` +
      ` settlement ${formatMdy(computed.settlementDate)}, ${loanPart}.`;
  }

  const where = `${address}${city ? `, ${city}` : ''}`;
  return Response.json({
    reply: `Done — I set up a ${parsed.state} contract for ${where}, buyer ${parsed.buyerName}.${summary} Open it to review, fill in anything blank, then text it to the buyer to sign.`,
    loopId,
    url: `${WEBAPP_URL}/loops/${loopId}/fill`,
  });
}

export function loader() {
  return Response.json({ status: 'Chat contract endpoint active' });
}
