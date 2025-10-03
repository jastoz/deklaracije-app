'use client';

import { useAppStore } from '@/lib/store';
import { FileUpload } from '@/components/FileUpload';
import { TroskovnikTable } from '@/components/TroskovnikTable';
import { ImportSection } from '@/components/ImportSection';
import { ExportSection } from '@/components/ExportSection';
import { PDFExportSection } from '@/components/PDFExportSection';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { StorageInfo } from '@/components/StorageInfo';
import { RestoreDialog } from '@/components/RestoreDialog';
import { ArrowDown } from 'lucide-react';

export default function Home() {
  const { nazivUstanove, setNazivUstanove, troskovnikItems, isProcessing } = useAppStore();

  const scrollToExport = () => {
    const exportSection = document.getElementById('export-section');
    if (exportSection) {
      exportSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-y-auto">
      <RestoreDialog />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Deklaracije App
          </h1>
          <p className="text-gray-600">
            Upload XLSX troškovnika, dodaj fotografije i generiraj ZIP s preimenovanim datotekama
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Storage Info Widget */}
          {troskovnikItems.length > 0 && <StorageInfo />}

          {/* Institution Name */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <label htmlFor="institution-name" className="block text-sm font-medium text-black mb-2">
              Naziv ustanove
            </label>
            <input
              id="institution-name"
              type="text"
              value={nazivUstanove}
              onChange={(e) => setNazivUstanove(e.target.value)}
              placeholder="Unesite naziv ustanove..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>

          {/* File Upload */}
          {troskovnikItems.length === 0 && (
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <FileUpload />
              {isProcessing && (
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center gap-2 text-blue-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    Obrađujem troškovnik...
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Troskovnik Table */}
          {troskovnikItems.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Troškovnik</h2>
                <button
                  onClick={scrollToExport}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  <ArrowDown className="w-4 h-4" />
                  Idi na Export
                </button>
              </div>
              <TroskovnikTable />
            </div>
          )}

          {/* Import Section */}
          {troskovnikItems.length > 0 && <ImportSection />}

          {/* Export Section */}
          {troskovnikItems.length > 0 && (
            <div id="export-section">
              <ExportSection />
            </div>
          )}

          {/* PDF Export Section */}
          {troskovnikItems.length > 0 && <PDFExportSection />}

          {/* Error Display - na dnu */}
          <ErrorDisplay />
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-200">
          <div className="text-center text-sm text-gray-500">
            <p>Deklaracije App - Jednostavno upravljanje fotografijama troškovnika</p>
            <p className="mt-1">Podržani formati: XLSX (troškovnik), JPG/PNG/PDF (fotografije)</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
