'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react';
import toast from 'react-hot-toast';

interface GenericImportResult {
  totalRows: number;
  created?: number;
  updated?: number;
  documentsCreated?: number;
  transactionsCreated?: number;
  itemsImported?: number;
  errors: { row: number; message: string }[];
}

interface GenericImportModalProps {
  open: boolean;
  title: string;
  importUrl: string;
  templateUrl: string;
  templateFileLabel?: string;
  onClose: () => void;
  onSuccess: () => void;
  /** Labels for the summary stat boxes, in display order. Each maps to a key on the result. */
  resultStats: { key: keyof GenericImportResult; label: string; tone?: 'brand' | 'default' }[];
}

export default function GenericImportModal({
  open,
  title,
  importUrl,
  templateUrl,
  templateFileLabel = 'Download template CSV',
  onClose,
  onSuccess,
  resultStats,
}: GenericImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenericImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    const ext = f.name.toLowerCase();
    if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      toast.error('Format file tidak didukung. Gunakan .csv atau .xlsx');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(importUrl, { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult(json.data);
      const successCount =
        (json.data.created ?? 0) +
        (json.data.updated ?? 0) +
        (json.data.documentsCreated ?? 0) +
        (json.data.transactionsCreated ?? 0);
      if (successCount > 0) {
        toast.success(`Import berhasil: ${successCount} data diproses`);
        onSuccess();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import gagal');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setFile(null);
    setResult(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-xl2 shadow-panel w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-semibold text-ink-900">{title}</h2>
          <button onClick={handleClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-400 hover:bg-ink-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!result ? (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl transition-colors cursor-pointer p-8 flex flex-col items-center gap-3 text-center ${
                dragging ? 'border-brand-400 bg-brand-50' : file ? 'border-brand-300 bg-brand-50' : 'border-ink-200 hover:border-brand-300 hover:bg-ink-50'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {file ? (
                <>
                  <FileText className="w-8 h-8 text-brand-500" />
                  <div>
                    <p className="font-medium text-ink-800">{file.name}</p>
                    <p className="text-sm text-ink-400">{(file.size / 1024).toFixed(1)} KB — klik untuk ganti</p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-ink-300" />
                  <div>
                    <p className="font-medium text-ink-600">Seret file ke sini atau klik untuk pilih</p>
                    <p className="text-sm text-ink-400 mt-0.5">Mendukung .csv, .xlsx, .xls</p>
                  </div>
                </>
              )}
            </div>

            <p className="text-xs text-ink-400 mt-3 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              <a href={templateUrl} download className="text-brand-600 hover:underline">{templateFileLabel}</a>
            </p>

            <div className="flex gap-2 justify-end mt-5">
              <button onClick={handleClose} className="btn-secondary">Batal</button>
              <button onClick={handleUpload} disabled={!file || loading} className="btn-primary">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</> : <><Upload className="w-4 h-4" /> Upload & Import</>}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${resultStats.length}, 1fr)` }}>
              {resultStats.map((stat) => (
                <div key={stat.key} className={`rounded-xl p-3 text-center ${stat.tone === 'brand' ? 'bg-brand-50' : 'bg-ink-50'}`}>
                  <p className={`text-xl font-semibold ${stat.tone === 'brand' ? 'text-brand-700' : 'text-ink-900'}`}>
                    {(result[stat.key] as number) ?? 0}
                  </p>
                  <p className={`text-xs mt-0.5 ${stat.tone === 'brand' ? 'text-brand-500' : 'text-ink-400'}`}>{stat.label}</p>
                </div>
              ))}
            </div>

            {result.errors.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  <p className="text-sm font-medium text-rose-600">{result.errors.length} peringatan / error</p>
                </div>
                <ul className="max-h-36 overflow-y-auto space-y-1 scrollbar-thin">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-xs text-ink-600 bg-rose-50 rounded-lg px-3 py-1.5">
                      {e.row > 0 && <span className="text-rose-500 font-medium">Baris {e.row}: </span>}
                      {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.errors.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-brand-600 bg-brand-50 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Semua data berhasil diimpor tanpa error.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => { setFile(null); setResult(null); }} className="btn-secondary">Import Lagi</button>
              <button onClick={handleClose} className="btn-primary">Selesai</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
