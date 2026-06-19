import { prisma } from '@documenso/prisma';

// Secret-gated diagnostic: reproduces a loop read + create/delete server-side
// and reports the exact error, so we can pinpoint the 500 without server logs.
const SECRET = process.env.PROPERTY_SYNC_SECRET ?? 'foraker-sync-secret';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function action({ request }: { request: Request }) {
  if (request.headers.get('x-sync-secret') !== SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, string> = {};

  try {
    await prisma.transaction.findFirst();
    results.read = 'ok';
  } catch (e) {
    results.read = msg(e);
  }

  try {
    const t = await prisma.transaction.create({ data: { address: '__diagnostic__' } });
    await prisma.transaction.delete({ where: { id: t.id } });
    results.write = 'ok';
  } catch (e) {
    results.write = msg(e);
  }

  return Response.json({ results });
}

export function loader() {
  return Response.json({ status: 'Diagnose endpoint active' });
}
