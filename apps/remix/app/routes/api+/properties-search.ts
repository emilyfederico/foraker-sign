import { prisma } from '@documenso/prisma';

// Autocomplete for the "Add a new loop" flow — matches the dotloop
// "Property Address or MLS#" search. Returns the top matches by address or MLS#.
export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();

  if (q.length < 2) {
    return Response.json({ results: [] });
  }

  const properties = await prisma.property.findMany({
    where: {
      OR: [
        { address: { contains: q, mode: 'insensitive' } },
        { mlsNumber: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: { contractDate: 'desc' },
    take: 8,
  });

  return Response.json({
    results: properties.map(
      (p: {
        mlsNumber: string;
        address: string;
        city: string;
        state: string | null;
        price: number | null;
        beds: number | null;
        listOfficeName: string | null;
      }) => ({
        mlsNumber: p.mlsNumber,
        address: p.address,
        city: p.city,
        state: p.state,
        price: p.price,
        beds: p.beds,
        listOfficeName: p.listOfficeName,
      }),
    ),
  });
}
