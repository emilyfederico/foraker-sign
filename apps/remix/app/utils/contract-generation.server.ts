import { EnvelopeType, RecipientRole } from '@prisma/client';

import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';
import { insertFormValuesInPdf } from '@documenso/lib/server-only/pdf/insert-form-values-in-pdf';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { putNormalizedPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

import { CONTRACT_FORMS_BASE64 } from './contract-forms.server';
import {
  type ComputedDeal,
  type FinancingType,
  type StateCode,
  computeDeal,
  formatMdy,
  formatUsd,
} from './deal-rules';

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

type DealTermsInput = {
  financing?: FinancingType;
  downPayment?: number;
  settlementDays?: number;
  electHomeInspection?: boolean;
  hasSeptic?: boolean;
  hasWell?: boolean;
  sellerContribution?: boolean;
  saleContingency?: boolean;
  firstDealWithBuyer?: boolean;
};

type GenerateArgs = DealTermsInput & {
  userId: number;
  state: string;
  property: Record<string, unknown>;
  buyerName: string;
  buyerEmail: string;
  request: Request;
  // Populated internally by generateContractDocument before the form is filled.
  computed?: ComputedDeal;
  brokerage?: string;
};

// Maps the property/buyer data to each form's AcroForm field names. Field names
// were assigned when the fillable PDFs were generated; verified by rendering.
// `computed` carries the rule-derived defaults (earnest money, settlement date,
// loan amount, offer date) and `brokerage` the agent's own brokerage; both are
// only written when non-empty so an absent value never blanks a field.
export function formValuesForState(
  state: string,
  property: Record<string, unknown>,
  buyerName: string,
  computed?: ComputedDeal,
  brokerage?: string,
): Record<string, string> {
  const address = String(property.address ?? '');
  const city = String(property.city ?? '');
  // MLS county often looks like "New Castle, DE" — drop the trailing state code.
  const county = String(property.county ?? '').replace(/,\s*[A-Z]{2}\s*$/, '');
  const price = formatPrice(property.price);
  // The Seller is the property OWNER, whose name MLS data does not include — and
  // is NEVER the listing brokerage. Leave it blank for the agent to type in.
  const seller = '';

  // Rule-derived values (1% earnest money, +30d settlement bumped off weekends/
  // holidays, loan = price − down payment, today's offer date, ~21d commitment).
  const earnest = computed ? formatUsd(computed.earnestMoney) : '';
  const loan = computed && computed.loanAmount > 0 ? formatUsd(computed.loanAmount) : '';
  const settlement = computed ? formatMdy(computed.settlementDate) : '';
  const offer = computed ? formatMdy(computed.offerDate) : '';
  const commitment = computed ? formatMdy(computed.mortgageCommitmentDate) : '';
  const depositDue = computed ? String(computed.depositDueDays) : '';
  const broker = brokerage ?? '';

  const out: Record<string, string> = {};
  const put = (key: string, value: string) => {
    if (value) out[key] = value;
  };

  if (state === 'DE') {
    put('p1_seller_1', seller);
    put('p1_buyer_1', buyerName);
    put('p1_a_purchase_price_1', price);
    put('p1_field_1', [city, county && `${county} County`].filter(Boolean).join(', '));
    put('p1_field_2', address);
    put('p1_deposit_due_within_1', depositDue);
    put('p10_deposit_received_1', earnest);
    put('p2_financing_loan_amount_1', loan);
    put('p9_date_of_agreement_1', offer);
    return out;
  }
  if (state === 'MD') {
    put('p1_3seller_1', seller);
    put('p1_4buyer_1', buyerName);
    put('p1_property_known_as_1', address);
    put('p1_field_1', city);
    put('p1_field_2', county);
    put('p1_purchase_price_is_1', price);
    put('p1_1date_of_offer_1', offer);
    put('p2_date_of_settlement_1', settlement);
    put('p11_brokerage_company_name_1', broker);
    put('p11_brokerage_company_name_2', broker);
    return out;
  }
  if (state === 'PA') {
    put('p1_buyers_1', buyerName);
    put('p1_buyers_sellers_1', seller);
    put('p1_including_postal_city_1', [address, city].filter(Boolean).join(', '));
    put('p1_of_county_of_1', county);
    put('p1_the_municipality_of_1', city);
    put('p2_settlement_date_is_1', settlement);
    put('p4_loan_amount_1', loan);
    put('p4_mortgage_commitment_date_1', commitment);
    put('p1_broker_company_1', broker);
    put('p1_broker_company_2', broker);
    return out;
  }
  return out;
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
  computed,
  brokerage,
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

  const formValues = formValuesForState(state, property, buyerName, computed, brokerage);
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
    // Owner's name, entered manually — never the listing brokerage.
    seller: '',
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
 * Preferred path: use the agent's *visible* rich template (the one shown in the
 * Templates tab) and fill its AcroForm via formValues. Returns null if the agent
 * has no such template (so the caller falls back to the embedded form).
 */
async function generateViaVisibleTemplate({
  userId,
  state,
  property,
  buyerName,
  buyerEmail,
  request,
  computed,
  brokerage,
}: GenerateArgs): Promise<{ url: string } | null> {
  const template = await prisma.envelope.findFirst({
    where: {
      userId,
      type: EnvelopeType.TEMPLATE,
      title: { startsWith: `${state} Contract` },
    },
    select: {
      id: true,
      teamId: true,
      team: { select: { url: true } },
      recipients: { select: { id: true } },
    },
  });

  const recipient = template?.recipients[0];
  if (!template || !recipient) {
    return null;
  }

  const envelope = await createDocumentFromTemplate({
    id: { type: 'envelopeId', id: template.id },
    userId,
    teamId: template.teamId,
    recipients: [{ id: recipient.id, name: buyerName, email: buyerEmail }],
    formValues: formValuesForState(state, property, buyerName, computed, brokerage),
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

// The agent's own brokerage from their "My Info" profile, used to pre-fill the
// brokerage fields per the universal rule. Returns undefined if not set.
async function getAgentBrokerage(userId: number): Promise<string | undefined> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { agentProfile: true },
  });
  const profile = user?.agentProfile as { brokerage?: string } | null;
  return profile?.brokerage?.trim() || undefined;
}

/**
 * Generate a contract in the logged-in agent's own workspace.
 * 1. Prefer the agent's visible Templates-tab template (Templates = source of truth).
 * 2. Fall back to the embedded form so generation always works.
 * 3. Last resort: the original simple template.
 */
export async function generateContractDocument(
  args: GenerateArgs,
): Promise<{ url: string } | { error: string }> {
  const errs: string[] = [];
  const msg = (err: unknown) => (err instanceof Error ? err.message : String(err));

  // Derive the rule-based deal defaults (1% earnest money, +30d settlement bumped
  // off weekends/holidays, loan = price − down payment, today's offer date, ~21d
  // mortgage commitment) plus the agent's brokerage, then thread them through.
  const price = Number(args.property.price) || 0;
  const yearBuiltRaw = args.property.yearBuilt;
  const yearBuilt = yearBuiltRaw ? Number(yearBuiltRaw) || undefined : undefined;
  const computed =
    price > 0
      ? computeDeal({
          price,
          financing: args.financing ?? 'conventional',
          downPayment: args.downPayment,
          settlementDays: args.settlementDays,
          state: args.state as StateCode,
          electHomeInspection: args.electHomeInspection ?? true,
          hasSeptic: args.hasSeptic ?? false,
          hasWell: args.hasWell ?? false,
          sellerContribution: args.sellerContribution ?? false,
          saleContingency: args.saleContingency ?? false,
          firstDealWithBuyer: args.firstDealWithBuyer ?? false,
          yearBuilt,
        })
      : undefined;
  const brokerage = await getAgentBrokerage(args.userId);
  const enriched: GenerateArgs = { ...args, computed, brokerage };

  try {
    const viaTemplate = await generateViaVisibleTemplate(enriched);
    if (viaTemplate) {
      return viaTemplate;
    }
  } catch (err) {
    console.error('Visible-template generation failed:', err);
    errs.push(`template: ${msg(err)}`);
  }

  try {
    return await generateRichContract(enriched);
  } catch (err) {
    console.error('Embedded-form generation failed:', err);
    errs.push(`embedded: ${msg(err)}`);
  }

  try {
    return await generateFromSimpleTemplate(enriched);
  } catch (err) {
    console.error('Simple-template generation failed:', err);
    errs.push(`simple: ${msg(err)}`);
  }

  return { error: errs.join(' | ') || 'Failed to generate contract' };
}

/**
 * One-time setup: create the three rich contract templates (DE/PA/MD) in the
 * owner's team so they appear in the Templates tab, with the AcroForm fields
 * preserved (flattenForm: false) so formValues can fill them. Idempotent.
 */
export async function setupRichTemplates({
  ownerEmail,
  request,
}: {
  ownerEmail: string;
  request?: Request;
}): Promise<{ created: string[]; skipped: string[]; teamUrl: string }> {
  const user = await prisma.user.findFirst({
    where: { email: ownerEmail.toLowerCase() },
    select: { id: true },
  });
  if (!user) {
    throw new Error(`No user found for ${ownerEmail}`);
  }

  const team = await prisma.team.findFirst({
    where: { organisation: { ownerUserId: user.id } },
    select: { id: true, url: true },
  });
  if (!team) {
    throw new Error('No team found for owner');
  }

  const created: string[] = [];
  const skipped: string[] = [];

  for (const state of ['DE', 'PA', 'MD']) {
    const pdfBase64 = CONTRACT_FORMS_BASE64[state];
    if (!pdfBase64) continue;

    const title = `${state} Contract`;
    const existing = await prisma.envelope.findFirst({
      where: { teamId: team.id, type: EnvelopeType.TEMPLATE, title },
      select: { id: true },
    });
    if (existing) {
      skipped.push(state);
      continue;
    }

    const documentData = await putNormalizedPdfFileServerSide(
      {
        name: `${title}.pdf`,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(Buffer.from(pdfBase64, 'base64')),
      },
      { flattenForm: false },
    );

    await createEnvelope({
      userId: user.id,
      teamId: team.id,
      internalVersion: 2,
      normalizePdf: false,
      data: {
        type: EnvelopeType.TEMPLATE,
        title,
        envelopeItems: [{ documentDataId: documentData.id }],
        recipients: [{ email: 'buyer@example.com', name: 'Buyer', role: RecipientRole.SIGNER }],
      },
      requestMetadata: {
        source: 'app',
        auth: null,
        requestMetadata: request ? extractRequestMetadata(request) : {},
      },
    });

    created.push(state);
  }

  return { created, skipped, teamUrl: team.url };
}
