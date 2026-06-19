import Anthropic from '@anthropic-ai/sdk';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { prisma } from '@documenso/prisma';

import { generateContractDocument } from '~/utils/contract-generation.server';

// Valid contract states (the contract is generated into the logged-in agent's
// own workspace by generateContractDocument).
const VALID_STATES = new Set(['MD', 'DE', 'PA']);

// Parsed shape Claude returns from the realtor's free-text request.
// Empty string is the "not stated" sentinel — simpler and more robust under
// structured-output schema constraints than a nullable union type.
type ParsedRequest = {
  state: 'PA' | 'MD' | 'DE' | '';
  address: string;
  buyerName: string;
  buyerEmail: string;
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
    buyerName: {
      type: 'string',
      description: 'The full name of the buyer. Empty string if not stated.',
    },
    buyerEmail: {
      type: 'string',
      description: "The buyer's email address. Empty string if not stated.",
    },
  },
  required: ['state', 'address', 'buyerName', 'buyerEmail'],
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

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return Response.json({ reply: 'Tell me what contract to create.' }, { status: 200 });
  }

  const anthropic = new Anthropic({ apiKey });

  // 1. Parse the free-text request into structured fields.
  let parsed: ParsedRequest;
  try {
    const completion = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 512,
      system:
        "You extract real-estate contract requests. Given a realtor's message, return the " +
        'contract state (PA, MD, or DE), the property street address, the buyer name, and the ' +
        'buyer email if present. Use null for anything not stated. Do not invent values.',
      output_config: { format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
      messages: [{ role: 'user', content: message }],
    });

    const text = completion.content.find((b) => b.type === 'text');
    parsed = JSON.parse(text && 'text' in text ? text.text : '{}') as ParsedRequest;
  } catch (err) {
    console.error('Chat parse error:', err);
    return Response.json(
      {
        reply:
          'I had trouble understanding that. Try: "Make a PA contract for 123 Main St, buyer John Smith".',
      },
      { status: 200 },
    );
  }

  // 2. Validate we have enough to act on.
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

  // 3. Look up the property.
  const property = await findProperty(parsed.address);
  if (!property) {
    return Response.json(
      {
        reply: `I couldn't find a listing matching "${parsed.address}". Double-check the address or import it first.`,
      },
      { status: 200 },
    );
  }

  // 4. Need an email to send for signature.
  if (!parsed.buyerEmail) {
    return Response.json(
      {
        reply: `Found ${property.address} in ${property.city}. What's ${parsed.buyerName}'s email so I can send the contract?`,
      },
      { status: 200 },
    );
  }

  // 5. Generate the contract in the logged-in agent's own workspace.
  const result = await generateContractDocument({
    userId,
    state: parsed.state,
    property: property as unknown as Record<string, unknown>,
    buyerName: parsed.buyerName,
    buyerEmail: parsed.buyerEmail,
    request,
  });

  if ('error' in result) {
    return Response.json({ reply: `Something went wrong: ${result.error}` }, { status: 200 });
  }

  return Response.json({
    reply: `Done — created a ${parsed.state} contract for ${property.address} with buyer ${parsed.buyerName}.`,
    url: result.url,
  });
}

export function loader() {
  return Response.json({ status: 'Chat contract endpoint active' });
}
