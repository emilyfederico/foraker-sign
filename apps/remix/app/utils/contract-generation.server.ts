import { EnvelopeType } from '@prisma/client';

import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

// Server-only: createDocumentFromTemplate pulls in `.server` modules (PDF
// storage) that must never reach the client bundle. Keeping this in a
// `*.server.ts` file guarantees React Router excludes it from the client build.

const WEBAPP_URL = process.env.NEXT_PUBLIC_WEBAPP_URL ?? 'https://sign.foraker.ai';

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
