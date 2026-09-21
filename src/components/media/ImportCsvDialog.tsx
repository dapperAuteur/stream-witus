'use client';

import { useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { CsvRowIssue, MediaImportResult } from '@/lib/csv';

interface ImportCsvDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after an import that added at least one item, so the list can refresh. */
  onImported: () => void;
}

// Mirrors MAX_ROWS in src/app/api/media/import/route.ts (kept local so lib/csv and
// papaparse stay out of the client bundle).
const MAX_ROWS = 500;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function IssueList({ issues, label }: { issues: CsvRowIssue[]; label: string }) {
  return (
    <ul aria-label={label} className="mt-2 space-y-1 max-h-48 overflow-y-auto text-sm text-gray-700">
      {issues.map((issue) => (
        <li key={`${issue.row}-${issue.reason}`} className="border-l-2 border-gray-200 pl-2">
          <span className="font-medium">Row {issue.row}</span>
          {issue.title ? <> ({issue.title})</> : null}: {issue.reason}
        </li>
      ))}
    </ul>
  );
}

/**
 * Upload a CSV (a CentenarianOS or Stream.WitUS media export) to POST /api/media/import
 * and show how many items were imported, skipped as duplicates, and rejected.
 */
export default function ImportCsvDialog({ isOpen, onClose, onImported }: ImportCsvDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<MediaImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setError('');
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const handleImport = async () => {
    if (!file) return;
    if (file.size === 0) {
      setError('That file is empty. Choose a CSV that has a header row and at least one item.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/media/import', { method: 'POST', body });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message = (data as { error?: unknown } | null)?.error;
        if (res.status === 401) setError('Your session has ended. Sign in again, then retry the import.');
        else setError(typeof message === 'string' ? message : `Import failed (error ${res.status}). Try again.`);
        return;
      }
      const imported = data as MediaImportResult;
      setResult(imported);
      // Clear the picker so a second click cannot resend the same file by accident.
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      if (imported.inserted > 0) onImported();
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const summary = result
    ? [
        `Imported ${plural(result.inserted, 'item')}.`,
        `Skipped ${plural(result.duplicates.length, 'duplicate')}.`,
        `Rejected ${plural(result.rejected.length, 'row')}.`,
      ].join(' ')
    : '';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import from CSV">
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-600">
          Bring in the file from CentenarianOS&apos;s &ldquo;Export my media (CSV)&rdquo; button, or a
          Stream.WitUS export. Items you already have with the same title, type and year are
          skipped, so importing the same file twice is safe.
        </p>

        <div>
          <label htmlFor="import-csv-file" className="block text-xs font-medium text-gray-600 mb-1">
            CSV file
          </label>
          <input
            ref={inputRef}
            id="import-csv-file"
            type="file"
            accept=".csv,text/csv"
            aria-describedby="import-csv-hint"
            disabled={loading}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError('');
              setResult(null);
            }}
            className="block w-full min-h-11 text-sm text-gray-700 rounded-xl border border-gray-200 p-1 file:mr-3 file:min-h-11 file:px-4 file:rounded-lg file:border-0 file:bg-fuchsia-50 file:text-fuchsia-700 file:font-medium hover:file:bg-fuchsia-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-600 disabled:opacity-50"
          />
          <p id="import-csv-hint" className="mt-1 text-xs text-gray-500">
            Up to {MAX_ROWS} rows. The first row must be a header with at least title and
            media_type columns.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3" role="alert">
            {error}
          </p>
        )}

        <div role="status" aria-live="polite" className="space-y-3">
          {loading && <p className="sr-only">Importing your file.</p>}
          {result && (
            <>
              <p className="text-sm font-medium text-gray-900 bg-gray-50 border border-gray-200 rounded-xl p-3">
                {summary}
              </p>
              {result.rejected.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Rejected rows</h3>
                  <p className="text-xs text-gray-500">Fix these rows in the file and import it again.</p>
                  <IssueList issues={result.rejected} label="Rejected rows" />
                </div>
              )}
              {result.duplicates.length > 0 && (
                <details className="text-sm">
                  <summary className="min-h-11 flex items-center cursor-pointer font-medium text-gray-700 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-600">
                    Show skipped duplicates
                  </summary>
                  <IssueList issues={result.duplicates} label="Skipped duplicates" />
                </details>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition min-h-11"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={loading || !file}
            className="px-4 py-2 text-sm font-medium text-white bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 rounded-xl transition flex items-center justify-center gap-1.5 min-h-11"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileUp className="w-4 h-4" aria-hidden="true" />
            )}
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
