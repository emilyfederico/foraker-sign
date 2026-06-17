import { DocumentSource, EnvelopeType } from '@prisma/client';
import pMap from 'p-map';
import { omit } from 'remeda';

import { prisma } from '@documenso/prisma';

import { nanoid, prefixedId } from '../../universal/id';
import { incrementTemplateId } from '../envelope/increment-id';

// The three Foraker purchase agreement templates every new user should receive.
const FORAKER_TEMPLATE_SECONDARY_IDS = [
  'envelope_ehhkmtoavtzehidr', // Maryland
  'envelope_frxrloufaakhzovu', // Delaware
  'envelope_mbmsavzmmtflutns', // Pennsylvania
];

export const copyDefaultTemplatesToUser = async ({
  userId,
  teamId,
}: {
  userId: number;
  teamId: number;
}) => {
  const templates = await prisma.envelope.findMany({
    where: {
      secondaryId: { in: FORAKER_TEMPLATE_SECONDARY_IDS },
      type: EnvelopeType.TEMPLATE,
    },
    select: {
      title: true,
      internalVersion: true,
      templateType: true,
      publicTitle: true,
      publicDescription: true,
      authOptions: true,
      visibility: true,
      documentMeta: true,
      envelopeItems: {
        include: {
          documentData: {
            select: { data: true, initialData: true, type: true },
          },
        },
      },
      recipients: {
        select: {
          email: true,
          name: true,
          role: true,
          signingOrder: true,
          fields: true,
        },
      },
    },
  });

  await pMap(
    templates,
    async (template) => {
      const [{ secondaryId }, createdDocumentMeta] = await Promise.all([
        incrementTemplateId().then(({ formattedTemplateId }) => ({
          secondaryId: formattedTemplateId,
        })),
        prisma.documentMeta.create({
          data: {
            ...omit(template.documentMeta, ['id']),
            emailSettings: template.documentMeta.emailSettings || undefined,
          },
        }),
      ]);

      const newEnvelope = await prisma.envelope.create({
        data: {
          id: prefixedId('envelope'),
          secondaryId,
          type: EnvelopeType.TEMPLATE,
          internalVersion: template.internalVersion,
          userId,
          teamId,
          title: template.title,
          documentMetaId: createdDocumentMeta.id,
          authOptions: template.authOptions || undefined,
          visibility: template.visibility,
          templateType: 'PRIVATE',
          publicTitle: template.publicTitle ?? undefined,
          publicDescription: template.publicDescription ?? undefined,
          source: DocumentSource.TEMPLATE,
        },
      });

      const itemIdMap: Record<string, string> = {};

      await Promise.all(
        template.envelopeItems.map(async (item) => {
          const newData = await prisma.documentData.create({
            data: {
              type: item.documentData.type,
              data: item.documentData.initialData,
              initialData: item.documentData.initialData,
            },
          });

          const newItem = await prisma.envelopeItem.create({
            data: {
              id: prefixedId('envelope_item'),
              title: item.title,
              order: item.order,
              envelopeId: newEnvelope.id,
              documentDataId: newData.id,
            },
          });

          itemIdMap[item.id] = newItem.id;
        }),
      );

      await pMap(
        template.recipients,
        async (recipient) =>
          prisma.recipient.create({
            data: {
              envelopeId: newEnvelope.id,
              email: recipient.email,
              name: recipient.name,
              role: recipient.role,
              signingOrder: recipient.signingOrder,
              token: nanoid(),
              fields: {
                createMany: {
                  data: recipient.fields.map((field) => ({
                    envelopeId: newEnvelope.id,
                    envelopeItemId: itemIdMap[field.envelopeItemId],
                    type: field.type,
                    page: field.page,
                    positionX: field.positionX,
                    positionY: field.positionY,
                    width: field.width,
                    height: field.height,
                    customText: '',
                    inserted: false,
                    fieldMeta: field.fieldMeta as PrismaJson.FieldMeta,
                  })),
                },
              },
            },
          }),
        { concurrency: 5 },
      );
    },
    { concurrency: 3 },
  );
};
