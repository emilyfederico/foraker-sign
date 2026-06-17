/**
 * Initial property seeder — pulls both Google Sheets and loads into DB
 * Run: node scripts/seed-properties.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SHEETS = [
  {
    id: '1G5nWFtEqn9quLa247CYwZlNCGReW_GyTYVnrZecS4ns',
    gid: '818935132',
    name: 'active-listings',
  },
  {
    id: '1fp_u9Ab1Q45v-sJO4XgEHQIA_aoXB4Mk-UpJnVXysCA',
    gid: '197077620',
    name: 'closed-sales',
  },
];

function parsePrice(priceStr) {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[$,]/g, '').trim();
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function parseBeds(bedsStr) {
  if (!bedsStr) return null;
  const num = parseInt(bedsStr, 10);
  return isNaN(num) ? null : num;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [month, day, year] = parts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    const date = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

async function fetchSheet(sheetId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${res.status}`);
  return res.text();
}

function parseCSV(csv) {
  const lines = csv.split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return rows;
}

async function seedSheet(sheet) {
  console.log(`\nFetching sheet: ${sheet.name}...`);
  const csv = await fetchSheet(sheet.id, sheet.gid);
  const rows = parseCSV(csv);
  console.log(`  Found ${rows.length} rows`);

  let upserted = 0;
  let skipped = 0;

  const BATCH = 100;
  const validRows = rows.filter((row) => row['MLS #']?.trim());
  skipped = rows.length - validRows.length;

  for (let i = 0; i < validRows.length; i += BATCH) {
    const batch = validRows.slice(i, i + BATCH);
    await Promise.all(
      batch.map((row) => {
        const mlsNumber = row['MLS #'].trim();
        const data = {
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
          sourceSheet: sheet.name,
          updatedAt: new Date(),
        };
        return prisma.property.upsert({
          where: { mlsNumber },
          update: data,
          create: { mlsNumber, ...data },
        });
      }),
    );
    upserted += batch.length;
    if (i % 500 === 0) process.stdout.write(`  ${upserted}/${validRows.length}...\r`);
  }

  console.log(`  ✓ Upserted: ${upserted}, Skipped: ${skipped}`);
}

async function main() {
  console.log('🏠 Seeding properties from Google Sheets...');

  for (const sheet of SHEETS) {
    await seedSheet(sheet);
  }

  const total = await prisma.property.count();
  console.log(`\n✅ Done! Total properties in database: ${total}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
