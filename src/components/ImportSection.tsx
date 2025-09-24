'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FolderOpen, Archive, CheckCircle, AlertCircle, Upload } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface ImportStats {
  imported: number;
  skipped: number;
  errors: string[];
}

export function ImportSection() {
  const { importImagesFromFiles, isProcessing } = useAppStore();
  const [importStats, setImportStats] = useState<ImportStats | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setImportStats(null);
    const result = await importImagesFromFiles(acceptedFiles);
    setImportStats(result);
  }, [importImagesFromFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf'],
      'application/zip': ['.zip']
    },
    multiple: true
  });

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Uvezi postojeće slike
        </h2>
        <p className="text-sm text-gray-600">
          Učitaj ZIP datoteku ili slike s rednim brojevima da se automatski povežu s postojećim stavkama
        </p>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragActive
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300 hover:border-gray-400'
          }
          ${isProcessing ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          {isDragActive ? (
            <Upload className="w-8 h-8 text-green-500" />
          ) : (
            <div className="flex items-center gap-2">
              <Archive className="w-6 h-6 text-gray-400" />
              <FolderOpen className="w-6 h-6 text-gray-400" />
            </div>
          )}

          <div>
            {isProcessing ? (
              <>
                <div className="inline-flex items-center gap-2 text-blue-600 mb-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Uvozim slike...
                </div>
                <p className="text-xs text-gray-500">
                  Molim pričekaj dok se slike procesiraju
                </p>
              </>
            ) : isDragActive ? (
              <>
                <p className="text-sm font-medium text-green-600">
                  Pustite datoteke ovdje...
                </p>
                <p className="text-xs text-gray-500">
                  ZIP datoteke ili pojedinačne slike
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-900">
                  Uvezi slike za postojeći troškovnik
                </p>
                <p className="text-xs text-gray-500">
                  Podržani formati: ZIP, JPG, PNG, PDF<br />
                  Nazivi datoteka trebaju počinjati s rednim brojem (npr. &quot;1. Naziv.jpg&quot;)
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Import Results */}
      {importStats && !isProcessing && (
        <div className="mt-4 space-y-3">
          {/* Success/Error Summary */}
          <div className="flex items-center gap-4 text-sm">
            {importStats.imported > 0 && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span>Uvezeno: {importStats.imported}</span>
              </div>
            )}
            {importStats.skipped > 0 && (
              <div className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="w-4 h-4" />
                <span>Preskočeno: {importStats.skipped}</span>
              </div>
            )}
          </div>

          {/* Error Details */}
          {importStats.errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <p className="text-sm font-medium text-amber-800 mb-2">
                Detalji problema:
              </p>
              <ul className="text-xs text-amber-700 space-y-1">
                {importStats.errors.slice(0, 5).map((error, index) => (
                  <li key={index} className="flex items-start gap-1">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span>{error}</span>
                  </li>
                ))}
                {importStats.errors.length > 5 && (
                  <li className="text-amber-600 font-medium">
                    ... i još {importStats.errors.length - 5} grešaka
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Success Message */}
          {importStats.imported > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-sm text-green-800">
                ✅ Uspješno uvezeno {importStats.imported} slika! Slike su automatski povezane s odgovarajućim stavkama.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}