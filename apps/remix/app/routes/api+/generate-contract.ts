import { getSession } from '@documenso/auth/server/lib/utils/get-session';

import { generateContractDocument } from '~/utils/contract-generation.server';

// Legacy templateId sent by the client (properties page) -> state.
const TEMPLATE_ID_TO_STATE: Record<string, string> = { '1': 'MD', '2': 'DE', '3': 'PA' };

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let userId: number;
  try {
    const { user } = await getSession(request);
    userId = user.id;
  } catch {
    return Response.json(
      { error: 'You must be signed in to generate a contract.' },
      { status: 401 },
    );
  }

  let body: {
    templateId?: string;
    state?: string;
    property: Record<string, unknown>;
    recipients?: { id?: number; name: string; email: string }[];
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { templateId, property, recipients = [] } = body;

  const state =
    body.state ??
    (templateId ? TEMPLATE_ID_TO_STATE[templateId] : undefined) ??
    String(property?.state ?? '');

  if (!state) {
    return Response.json({ error: 'Missing contract state' }, { status: 400 });
  }

  const buyer = recipients[0];
  if (!buyer?.name?.trim() || !buyer?.email?.trim()) {
    return Response.json({ error: 'Buyer name and email are required' }, { status: 400 });
  }

  const result = await generateContractDocument({
    userId,
    state,
    property,
    buyerName: buyer.name.trim(),
    buyerEmail: buyer.email.trim(),
    request,
  });

  if ('error' in result) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json(result);
}

export function loader() {
  return Response.json({ status: 'Contract generation endpoint active' });
}
