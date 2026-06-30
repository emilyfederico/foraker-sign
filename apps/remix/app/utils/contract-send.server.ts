import { PDFDocument, rgb } from '@cantoo/pdf-lib';
import { EnvelopeType, RecipientRole } from '@prisma/client';

import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';
import { insertFormValuesInPdf } from '@documenso/lib/server-only/pdf/insert-form-values-in-pdf';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { putNormalizedPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { formatSigningLink } from '@documenso/lib/utils/recipients';
import { prisma } from '@documenso/prisma';

import { buyerCount, buyerEnvelopeFields, buyerFieldNames } from './contract-buyer-fields.server';
import { CONTRACT_FIELD_MAP } from './contract-field-map.server';
import { CONTRACT_FORMS_BASE64 } from './contract-forms.server';
import { formValuesForState } from './contract-generation.server';
import { isSmsConfigured, sendSms } from './sms.server';

const WEBAPP_URL = process.env.NEXT_PUBLIC_WEBAPP_URL ?? 'https://sign.foraker.ai';

type LoopForSend = {
  id: string;
  state: string | null;
  address: string;
  city: string | null;
  price: number | null;
  buyerName: string | null;
  buyerEmail: string | null;
  fieldValues: unknown;
};

// Draw an "X" into every checked checkbox. Checkboxes in our forms are detected
// drawn boxes (not AcroForm widgets), so they can't be filled like text — we
// render them onto the page. Coordinates are fractions of the page, top-left
// origin; pdf-lib uses points with a bottom-left origin, hence the y flip.
async function drawCheckedBoxes(
  pdf: Buffer,
  state: string,
  values: Record<string, string>,
): Promise<Buffer> {
  const boxes = (CONTRACT_FIELD_MAP[state] ?? []).filter(
    (f) => f.type === 'checkbox' && values[f.name],
  );
  if (boxes.length === 0) return pdf;

  const doc = await PDFDocument.load(pdf);
  const pages = doc.getPages();
  const ink = rgb(0.15, 0.15, 0.15);

  for (const box of boxes) {
    const page = pages[box.page];
    if (!page) continue;
    const { width, height } = page.getSize();
    const left = box.xPct * width;
    const right = (box.xPct + box.wPct) * width;
    const yTop = height - box.yPct * height;
    const yBottom = height - (box.yPct + box.hPct) * height;
    const inset = (right - left) * 0.15;
    page.drawLine({
      start: { x: left + inset, y: yBottom + inset },
      end: { x: right - inset, y: yTop - inset },
      thickness: 1,
      color: ink,
    });
    page.drawLine({
      start: { x: left + inset, y: yTop - inset },
      end: { x: right - inset, y: yBottom + inset },
      thickness: 1,
      color: ink,
    });
  }

  return Buffer.from(await doc.save());
}

/**
 * "Text to buyer": bake the agent's filled values into the contract PDF, create
 * a Documenso envelope with the buyer as the sole signer (their signature/
 * initials/date fields placed on it), make the signing link live WITHOUT
 * emailing, and text that link to the buyer's phone.
 *
 * The agent's text entries are flattened into the PDF (no longer editable); the
 * only interactive fields are the buyer's — which Documenso highlights for them
 * in the signing view.
 */
export async function sendLoopToBuyer({
  userId,
  loop,
  phones,
  request,
}: {
  userId: number;
  loop: LoopForSend;
  phones: string[];
  request: Request;
}): Promise<{ documentId: number; url: string; textedTo: string[] } | { error: string }> {
  if (!isSmsConfigured()) {
    return { error: 'Texting isn’t set up yet — add the Twilio keys in Railway.' };
  }

  const state = (loop.state || '').toUpperCase();
  const pdfBase64 = CONTRACT_FORMS_BASE64[state];
  if (!pdfBase64) {
    return { error: `No contract form available for ${state || 'this state'}.` };
  }

  const buyerName = loop.buyerName?.trim() || 'Buyer';
  const slots = buyerCount(state);
  if (slots === 0) {
    return { error: `Signing isn't configured for ${state} contracts yet.` };
  }
  // One signer per valid phone, capped at the form's buyer slots.
  const targets = phones.map((p) => p.trim()).filter((p) => p.replace(/\D/g, '').length >= 10).slice(0, slots);
  if (targets.length === 0) {
    return { error: 'Enter a valid mobile number to text.' };
  }

  // Merge the rule-free defaults with whatever the agent saved on the Fill page;
  // saved values win. Then split into text (AcroForm) vs. checkbox draws, and
  // drop the buyer's own fields so we never bake a value where they must sign.
  const defaults = formValuesForState(
    state,
    {
      address: loop.address,
      city: loop.city,
      county: loop.city,
      price: loop.price,
      listOfficeName: '',
    },
    buyerName,
  );
  const saved = (loop.fieldValues as Record<string, string> | null) ?? {};
  const merged: Record<string, string> = { ...defaults, ...saved };

  const buyerOwned = buyerFieldNames(state);
  const textValues: Record<string, string> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (!value) continue;
    if (key.startsWith('cb_')) continue;
    if (buyerOwned.has(key)) continue;
    textValues[key] = value;
  }

  const filledText = await insertFormValuesInPdf({
    pdf: Buffer.from(pdfBase64, 'base64'),
    formValues: textValues,
  });
  const filled = await drawCheckedBoxes(filledText, state, merged);

  const team = await prisma.team.findFirst({
    where: { organisation: { ownerUserId: userId } },
    select: { id: true, url: true },
  });
  if (!team) {
    return { error: 'No workspace found for your account.' };
  }

  const title = `${loop.address} - Contract`;
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
      recipients: targets.map((_, i) => ({
        email:
          i === 0 && loop.buyerEmail?.trim()
            ? loop.buyerEmail.trim()
            : `buyer${i + 1}-${loop.id}@sms.foraker.ai`,
        name: i === 0 ? buyerName : `Co-Buyer ${i + 1}`,
        role: RecipientRole.SIGNER,
        fields: buyerEnvelopeFields(state, i).map((f) => ({
          ...f,
          documentDataId: documentData.id,
        })),
      })),
    },
    requestMetadata: {
      source: 'app',
      auth: 'session',
      requestMetadata: extractRequestMetadata(request),
    },
  });

  // Transition the document to PENDING so the link is signable — but don't email
  // (the text is the delivery).
  await sendDocument({
    id: { type: 'envelopeId', id: envelope.id },
    userId,
    teamId: team.id,
    sendEmail: false,
    requestMetadata: {
      source: 'app',
      auth: 'session',
      requestMetadata: extractRequestMetadata(request),
    },
  });

  // Text each buyer their own personal signing link. Recipients come back in
  // creation order, which matches `targets`.
  const signers = await prisma.recipient.findMany({
    where: { envelopeId: envelope.id },
    select: { token: true },
    orderBy: { id: 'asc' },
  });
  const textedTo: string[] = [];
  for (let i = 0; i < targets.length; i++) {
    const token = signers[i]?.token;
    if (!token) continue;
    const sms = await sendSms({
      to: targets[i],
      body: `Foraker Realty: please review and sign your contract here: ${formatSigningLink(token)}`,
    });
    if (!sms.ok) {
      return { error: sms.error };
    }
    textedTo.push(targets[i]);
  }
  if (textedTo.length === 0) {
    return { error: 'Could not find the buyers’ signing links to text.' };
  }

  const documentId = mapSecondaryIdToDocumentId(envelope.secondaryId);
  return {
    documentId,
    url: `${WEBAPP_URL}/t/${team.url}/documents/${documentId}`,
    textedTo,
  };
}
