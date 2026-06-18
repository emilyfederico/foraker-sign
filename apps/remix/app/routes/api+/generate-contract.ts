const DOCUMENSO_API_TOKEN =
  process.env.DOCUMENSO_API_TOKEN ?? 'foraker-sign-api-76852597039f0c559b3e18d38dfd4ec6';
const WEBAPP_URL = process.env.NEXT_PUBLIC_WEBAPP_URL ?? 'https://sign.foraker.ai';
const TEMPLATE_TEAM_URL = 'personal_awsdwlueddrcixnf';

// Template field IDs — these are the Documenso Field.id values added to each template.
// When generating a document, these IDs are used in prefillFields to auto-populate property data.
const TEMPLATE_FIELDS: Record<string, { label: string; id: number; type: 'text' | 'number' }[]> = {
  '1': [
    // MD
    { label: 'address', id: 3, type: 'text' },
    { label: 'city', id: 4, type: 'text' },
    { label: 'county', id: 5, type: 'text' },
    { label: 'price', id: 6, type: 'text' },
  ],
  '2': [
    // DE
    { label: 'seller', id: 7, type: 'text' },
    { label: 'buyer', id: 8, type: 'text' },
    { label: 'address', id: 9, type: 'text' },
    { label: 'price', id: 10, type: 'text' },
  ],
  '3': [
    // PA
    { label: 'buyer', id: 11, type: 'text' },
    { label: 'seller', id: 12, type: 'text' },
    { label: 'address', id: 13, type: 'text' },
    { label: 'city', id: 14, type: 'text' },
    { label: 'county', id: 15, type: 'text' },
    { label: 'price', id: 16, type: 'text' },
  ],
};

function formatPrice(price: unknown): string {
  if (!price) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(price));
}

function buildPrefillFields(
  templateId: string,
  property: Record<string, unknown>,
  buyerName: string,
) {
  const fields = TEMPLATE_FIELDS[templateId];
  if (!fields) return [];

  const valueMap: Record<string, string> = {
    address: String(property.address ?? ''),
    city: String(property.city ?? ''),
    county: String(property.county ?? ''),
    price: formatPrice(property.price),
    buyer: buyerName,
    seller: String(property.listOfficeName ?? ''),
  };

  return fields
    .map((f) => ({
      id: f.id,
      type: f.type,
      value: valueMap[f.label] ?? '',
    }))
    .filter((f) => f.value !== '');
}

// Shared contract-generation logic, reused by both the form-driven action below
// and the natural-language chat endpoint (/api/chat-contract).
export async function generateContractDocument({
  templateId,
  property,
  recipients = [],
}: {
  templateId: string;
  property: Record<string, unknown>;
  recipients?: { id: number; name: string; email: string }[];
}): Promise<{ url: string } | { error: string }> {
  const title = `${String(property.address)} - Contract`;
  const buyerName = recipients[0]?.name ?? '';
  const prefillFields = buildPrefillFields(templateId, property, buyerName);

  try {
    const res = await fetch(`${WEBAPP_URL}/api/v1/templates/${templateId}/generate-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DOCUMENSO_API_TOKEN}`,
      },
      body: JSON.stringify({
        title,
        recipients,
        prefillFields,
      }),
    });

    const data = (await res.json()) as { documentId?: string; id?: string; message?: string };

    if (!res.ok) {
      console.error('Documenso error:', data);
      return { error: data.message ?? 'Failed to generate document' };
    }

    const documentId = data.documentId ?? data.id;
    const url = `${WEBAPP_URL}/t/${TEMPLATE_TEAM_URL}/documents/${documentId}`;

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

  let body: {
    templateId: string;
    property: Record<string, unknown>;
    recipients?: { id: number; name: string; email: string }[];
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { templateId, property, recipients = [] } = body;

  if (!templateId) {
    return Response.json({ error: 'Missing templateId' }, { status: 400 });
  }

  const result = await generateContractDocument({ templateId, property, recipients });

  if ('error' in result) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json(result);
}

export function loader() {
  return Response.json({ status: 'Contract generation endpoint active' });
}
