import { type ActionFunctionArgs, json } from '@remix-run/node';

import { prisma } from '@documenso/prisma';

const SYNC_SECRET = process.env.PROPERTY_SYNC_SECRET ?? 'foraker-sync-secret';

function parsePrice(priceStr: string): number | null {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[$,]/g, '').trim();
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function parseBeds(bedsStr: string): number | null {
  if (!bedsStr) return null;
  const num = parseInt(bedsStr, 10);
  return isNaN(num) ? null : num;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    const [month, day, year] = dateStr.split('/');
    const fullYear = year.length === 2 ? `20${year}` : year;
    const date = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Verify secret
  const secret = request.headers.get('x-sync-secret');
  if (secret !== SYNC_SECRET) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { properties: Record<string, string>[]; source: string };

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { properties, source } = body;

  if (!Array.isArray(properties) || properties.length === 0) {
    return json({ error: 'No properties provided' }, { status: 400 });
  }

  let upserted = 0;
  let errors = 0;

  for (const row of properties) {
    const mlsNumber = row['MLS #']?.trim();
    if (!mlsNumber) continue;

    try {
      await prisma.property.upsert({
        where: { mlsNumber },
        update: {
          category: row['Cat']?.trim() || null,
          status: row['Status']?.trim() || 'UNK',
          address: row['Address']?.trim() || '',
          city: row['City']?.trim() || '',
          county: row['County']?.trim() || '',
          state: 'DE',
          beds: parseBeds(row['Beds']),
          baths: row['Baths']?.trim() || null,
          structureType: row['Structure Type']?.trim() || null,
          contractDate: parseDate(row['Status Contractual Search Date']),
          listOfficeName: row['List Office Name']?.trim() || null,
          price: parsePrice(row['Price']),
          sourceSheet: source || null,
          updatedAt: new Date(),
        },
        create: {
          mlsNumber,
          category: row['Cat']?.trim() || null,
          status: row['Status']?.trim() || 'UNK',
          address: row['Address']?.trim() || '',
          city: row['City']?.trim() || '',
          county: row['County']?.trim() || '',
          state: 'DE',
          beds: parseBeds(row['Beds']),
          baths: row['Baths']?.trim() || null,
          structureType: row['Structure Type']?.trim() || null,
          contractDate: parseDate(row['Status Contractual Search Date']),
          listOfficeName: row['List Office Name']?.trim() || null,
          price: parsePrice(row['Price']),
          sourceSheet: source || null,
        },
      });
      upserted++;
    } catch (err) {
      console.error(`Failed to upsert property ${mlsNumber}:`, err);
      errors++;
    }
  }

  return json({ success: true, upserted, errors });
}

export function loader() {
  return json({ status: 'Property sync endpoint active' });
}
