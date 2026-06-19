import { setupRichTemplates } from '~/utils/contract-generation.server';

// One-time, secret-gated endpoint to create the rich contract templates in an
// account's Templates tab. Trigger with the x-sync-secret header. Idempotent.
const SETUP_SECRET = process.env.PROPERTY_SYNC_SECRET ?? 'foraker-sync-secret';

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  if (request.headers.get('x-sync-secret') !== SETUP_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let ownerEmail = 'emily@forakersales.com';
  try {
    const body = (await request.json()) as { ownerEmail?: string };
    if (body.ownerEmail) ownerEmail = body.ownerEmail;
  } catch {
    // use default
  }

  try {
    const result = await setupRichTemplates({ ownerEmail, request });
    return Response.json({ success: true, ...result });
  } catch (err) {
    console.error('setup-templates error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Setup failed' },
      { status: 500 },
    );
  }
}

export function loader() {
  return Response.json({ status: 'Template setup endpoint active' });
}
