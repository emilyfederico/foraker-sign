import { EnvelopeType } from '@prisma/client';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

const WEBAPP_URL = process.env.NEXT_PUBLIC_WEBAPP_URL ?? 'https://sign.foraker.ai';

// Legacy templateId sent by the client (properties page) -> state.
const TEMPLATE_ID_TO_STATE: Record<string, string> = { '1': 'MD', '2': 'DE', '3': 'PA' };

function formatPrice(price: unknown): string {
  if (!price) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(price));
}

/**
 * Generate a contract in the *logged-in agent's own* workspace.
 *
 * Every agent gets their own copy of the MD/DE/PA templates on signup, each with
 * unique field/recipient ids. So we can't use hardcoded ids — we look up the
 * agent's own template by (userId + state title) and match its fields by
 * `fieldMeta.label`. The document is created in the agent's team and the link
 * points there, so the agent can always open it (no cross-team 404).
 */
export async function generateContractDocument({
  userId,
  state,
  property,
  buyerName,
  buyerEmail,
  request,
}: {
  userId: number;
  state: string;
  property: Record<string, unknown>;
  buyerName: string;
  buyerEmail: string;
  request: Request;
}): Promise<{ url: string } | { error: string }> {
  // Find the agent's own copy of the template for this state.
  const template = await prisma.envelope.findFirst({
    where: {
      userId,
      type: EnvelopeType.TEMPLATE,
      title: { contains: `${state} Residential Contract` },
    },
    select: {
      id: true,
      secondaryId: true,
      teamId: true,
      team: { select: { url: true } },
      recipients: {
        select: {
          id: true,
          fields: { select: { id: true, fieldMeta: true } },
        },
      },
    },
  });

  if (!template) {
    return { error: `No ${state} contract template found in your workspace.` };
  }

  const recipient = template.recipients[0];
  if (!recipient) {
    return { error: 'The contract template has no signer configured.' };
  }

  // Match each template field to a property value by its label.
  const valueMap: Record<string, string> = {
    address: String(property.address ?? ''),
    city: String(property.city ?? ''),
    county: String(property.county ?? ''),
    price: formatPrice(property.price),
    buyer: buyerName,
    seller: String(property.listOfficeName ?? ''),
  };

  const prefillFields = recipient.fields
    .map((f) => {
      const label = (f.fieldMeta as { label?: string } | null)?.label;
      const value = label ? valueMap[label] : undefined;
      if (!value) return null;
      return { id: f.id, type: 'text' as const, value };
    })
    .filter((f): f is { id: number; type: 'text'; value: string } => f !== null);

  try {
    const envelope = await createDocumentFromTemplate({
      id: { type: 'envelopeId', id: template.id },
      userId,
      teamId: template.teamId,
      recipients: [{ id: recipient.id, name: buyerName, email: buyerEmail }],
      prefillFields,
      override: { title: `${String(property.address)} - Contract` },
      requestMetadata: {
        source: 'app',
        auth: 'session',
        requestMetadata: extractRequestMetadata(request),
      },
    });

    const documentId = mapSecondaryIdToDocumentId(envelope.secondaryId);
    const url = `${WEBAPP_URL}/t/${template.team.url}/documents/${documentId}`;

    return { url };
  } catch (err) {
    console.error('Generate contract error:', err);
    return { error: 'Failed to generate contract' };
  }
}

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
