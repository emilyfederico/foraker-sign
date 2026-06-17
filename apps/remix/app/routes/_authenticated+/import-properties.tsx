import { useRef, useState } from 'react';

const SYNC_SECRET = 'foraker-sync-secret';

type ParseResult = {
  rows: Record<string, string>[];
  headers: string[];
  warnings: string[];
};

function parseTSV(text: string): ParseResult {
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { rows: [], headers: [], warnings: ['File appears empty'] };
  }

  // Detect separator: tab or comma
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, ''));

  const requiredCols = ['MLS #', 'Address', 'City', 'County', 'Price', 'Beds'];
  const missing = requiredCols.filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    warnings.push(`Missing expected columns: ${missing.join(', ')}`);
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(sep).map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = vals[idx] ?? '';
    });
    rows.push(row);
  }

  return { rows, headers, warnings };
}

type SyncResult = {
  success: boolean;
  upserted?: number;
  errors?: number;
  error?: string;
};

export default function ImportPropertiesPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setPreview(parseTSV(text));
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleSync() {
    if (!preview || preview.rows.length === 0) return;
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch('/api/sync-properties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-secret': SYNC_SECRET,
        },
        body: JSON.stringify({ properties: preview.rows, source: fileName }),
      });
      const data = await res.json();
      setResult(data as SyncResult);
    } catch {
      setResult({ success: false, error: 'Network error — check your connection' });
    } finally {
      setSyncing(false);
    }
  }

  const sampleHeaders = preview?.headers.slice(0, 6).join(' · ');

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Import MLS Listings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Drop a tab-separated or CSV export from your MLS system. Rows are upserted by MLS #.
      </p>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center transition-colors hover:border-[#4a7c59] hover:bg-green-50"
      >
        <svg
          className="mb-3 h-10 w-10 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0L8 8m4-4l4 4"
          />
        </svg>
        <p className="text-sm font-medium text-gray-700">
          {fileName ? fileName : 'Drop your MLS export here'}
        </p>
        <p className="mt-1 text-xs text-gray-400">Tab-separated (.txt) or comma-separated (.csv)</p>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.csv,.tsv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {/* Preview */}
      {preview && (
        <div className="mt-6 space-y-4">
          {preview.warnings.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              <strong>Warnings:</strong>
              <ul className="mt-1 list-disc pl-4">
                {preview.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-700">
              <strong>{preview.rows.length.toLocaleString()}</strong> rows detected
            </p>
            {sampleHeaders && (
              <p className="mt-1 text-xs text-gray-400">Columns: {sampleHeaders}…</p>
            )}

            {/* Sample rows */}
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['MLS #', 'Address', 'City', 'Beds', 'Price', 'Status'].map((col) => (
                      <th key={col} className="pb-1 pr-4 text-left font-medium text-gray-500">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1 pr-4 text-gray-700">{row['MLS #'] || '—'}</td>
                      <td className="py-1 pr-4 text-gray-700">{row['Address'] || '—'}</td>
                      <td className="py-1 pr-4 text-gray-700">{row['City'] || '—'}</td>
                      <td className="py-1 pr-4 text-gray-700">{row['Beds'] || '—'}</td>
                      <td className="py-1 pr-4 text-gray-700">{row['Price'] || '—'}</td>
                      <td className="py-1 pr-4 text-gray-700">{row['Status'] || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 5 && (
                <p className="mt-1 text-xs text-gray-400">…and {preview.rows.length - 5} more</p>
              )}
            </div>
          </div>

          <button
            onClick={handleSync}
            disabled={syncing || preview.rows.length === 0}
            className="w-full rounded-lg bg-[#4a7c59] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#3d6649] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing
              ? `Syncing ${preview.rows.length.toLocaleString()} properties…`
              : `Sync ${preview.rows.length.toLocaleString()} Properties`}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            result.success
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {result.success ? (
            <>
              <strong>Done!</strong> {result.upserted?.toLocaleString()} properties synced
              {result.errors ? `, ${result.errors} errors` : ''}.
            </>
          ) : (
            <>
              <strong>Error:</strong> {result.error}
            </>
          )}
        </div>
      )}

      <div className="mt-8 rounded-lg border border-gray-100 bg-gray-50 p-4 text-xs text-gray-500">
        <p className="font-medium text-gray-700">Expected column names</p>
        <p className="mt-1">
          MLS #, Cat, Status, Address, City, County, Beds, Baths, Structure Type, Status Contractual
          Search Date, List Office Name, Price
        </p>
        <p className="mt-2">
          Price can include $ and commas (e.g. $514,015). Separator auto-detected.
        </p>
      </div>
    </div>
  );
}
