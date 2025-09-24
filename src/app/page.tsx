'use client';

import { useAppStore } from '@/lib/store';
import { FileUpload } from '@/components/FileUpload';
import { TroskovnikTable } from '@/components/TroskovnikTable';
import { ImportSection } from '@/components/ImportSection';
import { ExportSection } from '@/components/ExportSection';
import { ErrorDisplay } from '@/components/ErrorDisplay';

export default function Home() {
  const { nazivUstanove, setNazivUstanove, troskovnikItems, isProcessing } = useAppStore();

  return (
    <div className="min-h-screen bg-gray-50">
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
              <TroskovnikTable />
            </div>
          )}

          {/* Import Section */}
          {troskovnikItems.length > 0 && <ImportSection />}

          {/* Export Section */}
          {troskovnikItems.length > 0 && <ExportSection />}

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
