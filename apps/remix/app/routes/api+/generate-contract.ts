const DOCUMENSO_API_TOKEN =
  process.env.DOCUMENSO_API_TOKEN ?? 'foraker-sign-api-76852597039f0c559b3e18d38dfd4ec6';
const WEBAPP_URL = process.env.NEXT_PUBLIC_WEBAPP_URL ?? 'https://sign.foraker.ai';
const TEMPLATE_TEAM_URL = 'personal_awsdwlueddrcixnf';

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

  const title = `${String(property.address)} - Contract`;

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
      }),
    });

    const data = (await res.json()) as { documentId?: string; id?: string; message?: string };

    if (!res.ok) {
      console.error('Documenso error:', data);
      return Response.json(
        { error: data.message ?? 'Failed to generate document' },
        { status: 500 },
      );
    }

    const documentId = data.documentId ?? data.id;
    const url = `${WEBAPP_URL}/t/${TEMPLATE_TEAM_URL}/documents/${documentId}`;

    return Response.json({ url });
  } catch (err) {
    console.error('Generate contract error:', err);
    return Response.json({ error: 'Failed to generate contract' }, { status: 500 });
  }
}

export function loader() {
  return Response.json({ status: 'Contract generation endpoint active' });
}
