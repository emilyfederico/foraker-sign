import { DocumentStatus, EnvelopeType, FieldType } from '@prisma/client';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { createEnvelopeFields } from '@documenso/lib/server-only/field/create-envelope-fields';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { formatSigningLink } from '@documenso/lib/utils/recipients';
import { prisma } from '@documenso/prisma';

import { isSmsConfigured, sendSms } from '~/utils/sms.server';

// Texts the buyer the signing link for a contract the agent already created and
// reviewed. If the contract is still a draft, it's sent first (text-only — no
// email) so the link is actually signable. Env-gated on the Twilio keys.
export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  let userId: number;
  try {
    const { user } = await getSession(request);
    userId = user.id;
  } catch {
    return Response.json({ ok: false, error: 'Please sign in.' }, { status: 200 });
  }

  if (!isSmsConfigured()) {
    return Response.json({
      ok: false,
      error: 'Texting isn’t set up yet — add the Twilio keys in Railway.',
    });
  }

  let body: { documentId?: number; phone?: string };
  try {
    body = (await request.json()) as { documentId?: number; phone?: string };
  } catch {
    return Response.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  const documentId = Number(body.documentId);
  const phone = String(body.phone ?? '').trim();
  if (!documentId || !phone) {
    return Response.json({ ok: false, error: 'A contract and a phone number are required.' });
  }

  // The contract lives in the agent's own (personal) team.
  const team = await prisma.team.findFirst({
    where: { organisation: { ownerUserId: userId } },
    select: { id: true },
  });
  if (!team) {
    return Response.json({ ok: false, error: 'No workspace found for your account.' });
  }

  // Scope to this user; pull the signer's token and the document status.
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: { type: 'documentId', id: documentId },
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId: team.id,
  });
  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    select: {
      status: true,
      recipients: {
        select: { id: true, token: true, fields: { select: { id: true } } },
        orderBy: { id: 'asc' },
      },
    },
  });
  if (!envelope) {
    return Response.json({ ok: false, error: 'Contract not found.' });
  }
  const signer = envelope.recipients[0];
  if (!signer) {
    return Response.json({ ok: false, error: 'This contract has no signer to text.' });
  }

  // Documenso won't send a document whose signer has no field, and the generated
  // contracts don't place one — so add a signature field for the signer when they
  // have none (idempotent). Placed on page 1; exact per-form placement is a follow-up.
  if (signer.fields.length === 0) {
    try {
      await createEnvelopeFields({
        userId,
        teamId: team.id,
        id: { type: 'documentId', id: documentId },
        fields: [
          {
            type: FieldType.SIGNATURE,
            recipientId: signer.id,
            page: 1,
            positionX: 8,
            positionY: 82,
            width: 32,
            height: 5,
          },
        ],
        requestMetadata: {
          source: 'app',
          auth: 'session',
          requestMetadata: extractRequestMetadata(request),
        },
      });
    } catch (err) {
      return Response.json({
        ok: false,
        error: `Couldn't add a signature field: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // Make the signing link live without emailing — the text is the delivery.
  if (envelope.status === DocumentStatus.DRAFT) {
    try {
      await sendDocument({
        id: { type: 'documentId', id: documentId },
        userId,
        teamId: team.id,
        sendEmail: false,
        requestMetadata: {
          source: 'app',
          auth: 'session',
          requestMetadata: extractRequestMetadata(request),
        },
      });
    } catch (err) {
      return Response.json({
        ok: false,
        error: `Couldn't prepare the contract for signing: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
    }
  }

  const link = formatSigningLink(signer.token);
  const result = await sendSms({
    to: phone,
    body: `Foraker Realty: please review and sign your contract here: ${link}`,
  });
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error });
  }

  return Response.json({ ok: true, sentTo: phone });
}
