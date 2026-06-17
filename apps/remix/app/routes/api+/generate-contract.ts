import { type ActionFunctionArgs, json } from '@remix-run/node';

const DOCUMENSO_API_TOKEN =
  process.env.DOCUMENSO_API_TOKEN ?? 'foraker-sign-api-76852597039f0c559b3e18d38dfd4ec6';
const WEBAPP_URL = process.env.NEXT_PUBLIC_WEBAPP_URL ?? 'https://sign.foraker.ai';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body: { templateId: string; property: Record<string, unknown> };

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { templateId, property } = body;

  if (!templateId) {
    return json({ error: 'Missing templateId' }, { status: 400 });
  }

  const price = property.price
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(property.price as number)
    : '';

  const title = `${property.address} - Contract`;

  try {
    const res = await fetch(`${WEBAPP_URL}/api/v1/templates/${templateId}/generate-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DOCUMENSO_API_TOKEN}`,
      },
      body: JSON.stringify({
        title,
        prefillFields: [
          { label: 'Property Address', value: String(property.address ?? '') },
          { label: 'City', value: String(property.city ?? '') },
          { label: 'County', value: String(property.county ?? '') },
          { label: 'Purchase Price', value: price },
          { label: 'MLS Number', value: String(property.mlsNumber ?? '') },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Documenso error:', data);
      return json({ error: data.message ?? 'Failed to generate document' }, { status: 500 });
    }

    const documentId = data.documentId ?? data.id;
    const url = `${WEBAPP_URL}/documents/${documentId}`;

    return json({ url });
  } catch (err) {
    console.error('Generate contract error:', err);
    return json({ error: 'Failed to generate contract' }, { status: 500 });
  }
}

export function loader() {
  return json({ status: 'Contract generation endpoint active' });
}
