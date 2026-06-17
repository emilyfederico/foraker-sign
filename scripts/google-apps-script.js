/**
 * FORAKER SIGN — Google Sheets Auto-Sync Script
 *
 * HOW TO INSTALL (do this in EACH sheet):
 * 1. Open the Google Sheet
 * 2. Click Extensions → Apps Script
 * 3. Delete any existing code
 * 4. Paste this entire script
 * 5. Change SHEET_NAME below to match the sheet tab name
 * 6. Click Save (disk icon)
 * 7. Click Triggers (alarm clock icon on left sidebar)
 * 8. Click "Add Trigger" (bottom right)
 * 9. Choose: onEdit → On edit → Save
 * 10. Authorize when prompted
 *
 * That's it! Every time you edit the sheet, it syncs to Foraker Sign.
 */

// ============================================================
// CONFIGURATION — update these for each sheet
// ============================================================
const FORAKER_SIGN_URL = 'https://sign.foraker.ai/api/sync-properties';
const SYNC_SECRET = 'foraker-sync-secret';
const SHEET_NAME = 'active-listings'; // Change to 'closed-sales' for the older sheet
// ============================================================

function onEdit(e) {
  // Debounce — only sync after a short pause (avoids hammering API on bulk paste)
  const lock = LockService.getScriptLock();
  lock.tryLock(100);

  try {
    syncSheet();
  } finally {
    lock.releaseLock();
  }
}

function syncSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();

  if (data.length < 2) return; // No data rows

  const headers = data[0];
  const rows = data.slice(1);

  const properties = rows
    .map((row) => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i]?.toString() ?? '';
      });
      return obj;
    })
    .filter((row) => row['MLS #']); // Skip empty rows

  if (properties.length === 0) return;

  const payload = JSON.stringify({ properties, source: SHEET_NAME });

  const options = {
    method: 'POST',
    contentType: 'application/json',
    headers: { 'x-sync-secret': SYNC_SECRET },
    payload: payload,
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(FORAKER_SIGN_URL, options);
    const result = JSON.parse(response.getContentText());
    console.log('Sync result:', JSON.stringify(result));
  } catch (err) {
    console.error('Sync error:', err.toString());
  }
}

// Manual sync — run this from the Apps Script editor to test
function manualSync() {
  syncSheet();
  SpreadsheetApp.getUi().alert('Sync complete!');
}
