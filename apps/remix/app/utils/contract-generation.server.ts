import { EnvelopeType, RecipientRole } from '@prisma/client';

import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';
import { insertFormValuesInPdf } from '@documenso/lib/server-only/pdf/insert-form-values-in-pdf';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { putNormalizedPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

import { CONTRACT_FORMS_BASE64 } from './contract-forms.server';

// Server-only: this pulls in `.server` PDF/storage modules that must never reach
// the client bundle. The `*.server.ts` suffix guarantees React Router excludes it.

const WEBAPP_URL = process.env.NEXT_PUBLIC_WEBAPP_URL ?? 'https://sign.foraker.ai';

function formatPrice(price: unknown): string {
  if (!price) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(price));
}

type GenerateArgs = {
  userId: number;
  state: string;
  property: Record<string, unknown>;
  buyerName: string;
  buyerEmail: string;
  request: Request;
};

// Maps the property/buyer data to each form's AcroForm field names. Field names
// were assigned when the fillable PDFs were generated; verified by rendering.
function formValuesForState(
  state: string,
  property: Record<string, unknown>,
  buyerName: string,
): Record<string, string> {
  const address = String(property.address ?? '');
  const city = String(property.city ?? '');
  // MLS county often looks like "New Castle, DE" — drop the trailing state code.
  const county = String(property.county ?? '').replace(/,\s*[A-Z]{2}\s*$/, '');
  const price = formatPrice(property.price);
  const seller = String(property.listOfficeName ?? '');

  if (state === 'DE') {
    return {
      p1_seller_1: seller,
      p1_buyer_1: buyerName,
      p1_a_purchase_price_1: price,
      p1_field_1: [city, county && `${county} County`].filter(Boolean).join(', '),
      p1_field_2: address,
    };
  }
  if (state === 'MD') {
    return {
      p1_3seller_1: seller,
      p1_4buyer_1: buyerName,
      p1_property_known_as_1: address,
      p1_field_1: city,
      p1_field_2: county,
      p1_purchase_price_is_1: price,
    };
  }
  if (state === 'PA') {
    return {
      p1_buyers_1: buyerName,
      p1_buyers_sellers_1: seller,
      p1_including_postal_city_1: [address, city].filter(Boolean).join(', '),
      p1_of_county_of_1: county,
      p1_the_municipality_of_1: city,
    };
  }
  return {};
}

/**
 * Primary path: fill the full state contract (the real fillable PDF) with the
 * property/buyer data and create the document directly in the agent's own team.
 * Throws on any failure so the caller can fall back to the simple-template path.
 */
async function generateRichContract({
  userId,
  state,
  property,
  buyerName,
  buyerEmail,
  request,
}: GenerateArgs): Promise<{ url: string }> {
  const pdfBase64 = CONTRACT_FORMS_BASE64[state];
  if (!pdfBase64) {
    throw new Error(`No embedded fillable form for state ${state}`);
  }

  // The agent's own (personal) team — the document lands here so they can open it.
  const team = await prisma.team.findFirst({
    where: { organisation: { ownerUserId: userId } },
    select: { id: true, url: true },
  });
  if (!team) {
    throw new Error('No team found for user');
  }

  const formValues = formValuesForState(state, property, buyerName);
  const filled = await insertFormValuesInPdf({
    pdf: Buffer.from(pdfBase64, 'base64'),
    formValues,
  });

  const title = `${String(property.address)} - Contract`;

  const documentData = await putNormalizedPdfFileServerSide({
    name: `${title}.pdf`,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(filled),
  });

  const envelope = await createEnvelope({
    userId,
    teamId: team.id,
    internalVersion: 2,
    normalizePdf: false,
    data: {
      type: EnvelopeType.DOCUMENT,
      title,
      envelopeItems: [{ documentDataId: documentData.id }],
      recipients: [{ email: buyerEmail, name: buyerName, role: RecipientRole.SIGNER }],
    },
    requestMetadata: {
      source: 'app',
      auth: 'session',
      requestMetadata: extractRequestMetadata(request),
    },
  });

  const documentId = mapSecondaryIdToDocumentId(envelope.secondaryId);
  return { url: `${WEBAPP_URL}/t/${team.url}/documents/${documentId}` };
}

/**
 * Fallback path: the original simple Documenso template the agent received on
 * signup. Used if the rich-form path fails, so generation never fully breaks.
 */
async function generateFromSimpleTemplate({
  userId,
  state,
  property,
  buyerName,
  buyerEmail,
  request,
}: GenerateArgs): Promise<{ url: string } | { error: string }> {
  const template = await prisma.envelope.findFirst({
    where: {
      userId,
      type: EnvelopeType.TEMPLATE,
      title: { contains: `${state} Residential Contract` },
    },
    select: {
      id: true,
      teamId: true,
      team: { select: { url: true } },
      recipients: { select: { id: true, fields: { select: { id: true, fieldMeta: true } } } },
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
  return { url: `${WEBAPP_URL}/t/${template.team.url}/documents/${documentId}` };
}

/**
 * Generate a contract in the logged-in agent's own workspace. Tries the full
 * fillable form first; falls back to the simple template if anything goes wrong.
 */
export async function generateContractDocument(
  args: GenerateArgs,
): Promise<{ url: string } | { error: string }> {
  try {
    return await generateRichContract(args);
  } catch (err) {
    console.error('Rich contract generation failed; falling back to template:', err);
    try {
      return await generateFromSimpleTemplate(args);
    } catch (fallbackErr) {
      console.error('Fallback contract generation failed:', fallbackErr);
      return { error: 'Failed to generate contract' };
    }
  }
}
