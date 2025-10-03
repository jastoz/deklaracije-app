'use client';

import { useState, useEffect } from 'react';
import { FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { generatePDF, downloadPDF, PDFQuality } from '@/lib/pdfExport';

export function PDFExportSection() {
  const { nazivUstanove, troskovnikItems, addError } = useAppStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [fromRb, setFromRb] = useState('1');
  const [toRb, setToRb] = useState('');
  const [quality, setQuality] = useState<PDFQuality>('high');
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Validacije
  const totalItems = troskovnikItems.length;
  const fromRbNum = parseInt(fromRb, 10);
  const toRbNum = parseInt(toRb, 10);

  const validationIssues: string[] = [];

  if (!nazivUstanove.trim()) {
    validationIssues.push('Naziv ustanove je obavezan');
  }
  if (totalItems === 0) {
    validationIssues.push('Nema stavki u troškovniku');
  }
  if (isNaN(fromRbNum) || fromRbNum < 1) {
    validationIssues.push('Početna stavka mora biti broj veći od 0');
  }
  if (isNaN(toRbNum) || toRbNum < 1) {
    validationIssues.push('Krajnja stavka mora biti broj veći od 0');
  }
  if (fromRbNum > toRbNum) {
    validationIssues.push('Početna stavka mora biti manja ili jednaka krajnjoj');
  }
  if (fromRbNum > totalItems || toRbNum > totalItems) {
    validationIssues.push(`Raspon stavki je izvan granica (1-${totalItems})`);
  }

  // Filtriraj stavke u odabranom rasponu
  const itemsInRange = troskovnikItems.filter(
    item => item.rb >= fromRbNum && item.rb <= toRbNum
  );

  const itemsWithImages = itemsInRange.filter(item => item.images.length > 0);
  const itemsWithoutImages = itemsInRange.filter(item => item.images.length === 0);
  const totalImages = itemsInRange.reduce((sum, item) => sum + item.images.length, 0);

  const canGenerate =
    validationIssues.length === 0 &&
    nazivUstanove.trim() !== '' &&
    totalImages > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setProgress({ current: 0, total: totalImages });

    try {
      const pdfBlob = await generatePDF(
        nazivUstanove,
        troskovnikItems,
        fromRbNum,
        toRbNum,
        {
          includeWatermark: true, // Uvijek dodaj watermark i pečat
          quality,
        },
        (current, total) => setProgress({ current, total })
      );

      downloadPDF(pdfBlob, nazivUstanove, fromRbNum, toRbNum);
    } catch (error) {
      addError(`Greška pri generiranju PDF-a: ${error}`);
    } finally {
      setIsGenerating(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  // Automatski postavi toRb na ukupan broj stavki samo jednom pri učitavanju
  useEffect(() => {
    if (toRb === '' && totalItems > 0) {
      setToRb(totalItems.toString());
    }
  }, [totalItems]); // Izvršava se samo kad se totalItems promijeni, ne na svaki render

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 rounded-lg">
      <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
        <FileText className="w-6 h-6" />
        PDF Export
      </h2>

      {/* Range Selection */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Odaberi raspon stavki</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Od stavke
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="1"
              value={fromRb}
              onChange={(e) => {
                const value = e.target.value;
                // Dozvoli prazan string ili samo brojeve
                if (value === '' || /^\d+$/.test(value)) {
                  setFromRb(value);
                }
              }}
              onKeyDown={(e) => {
                // Dozvoli: backspace, delete, tab, escape, enter, strelice
                if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                  return;
                }
                // Dozvoli: Ctrl+A, Cmd+A, Ctrl+C, Ctrl+V, itd.
                if (e.ctrlKey || e.metaKey) {
                  return;
                }
                // Blokiraj sve osim brojeva
                if (!/^\d$/.test(e.key)) {
                  e.preventDefault();
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>
          <div className="text-gray-500 mt-8">→</div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Do stavke
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={totalItems.toString()}
              value={toRb}
              onChange={(e) => {
                const value = e.target.value;
                // Dozvoli prazan string ili samo brojeve
                if (value === '' || /^\d+$/.test(value)) {
                  setToRb(value);
                }
              }}
              onKeyDown={(e) => {
                // Dozvoli: backspace, delete, tab, escape, enter, strelice
                if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                  return;
                }
                // Dozvoli: Ctrl+A, Cmd+A, Ctrl+C, Ctrl+V, itd.
                if (e.ctrlKey || e.metaKey) {
                  return;
                }
                // Blokiraj sve osim brojeva
                if (!/^\d$/.test(e.key)) {
                  e.preventDefault();
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Ukupno stavki u troškovniku: {totalItems}
        </p>
      </div>

      {/* Opcije */}
      {validationIssues.length === 0 && itemsInRange.length > 0 && (
        <>
          {/* Quality Selection */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Kvaliteta</h3>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 border-2 border-blue-500 rounded-lg cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors">
                <input
                  type="radio"
                  name="quality"
                  value="high"
                  checked={quality === 'high'}
                  onChange={(e) => setQuality(e.target.value as PDFQuality)}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 flex items-center gap-2">
                    Visoka kvaliteta <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Preporučeno</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Quality 92%, max 2400px - najbolja kvaliteta za ispis
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="quality"
                  value="medium"
                  checked={quality === 'medium'}
                  onChange={(e) => setQuality(e.target.value as PDFQuality)}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Srednja kvaliteta</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Quality 85%, max 1800px - dobra kvaliteta, manji file
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="quality"
                  value="low"
                  checked={quality === 'low'}
                  onChange={(e) => setQuality(e.target.value as PDFQuality)}
                  className="mt-1 w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Niska kvaliteta</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Quality 75%, max 1200px - najmanji file, smanjena kvaliteta
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Statistike */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <p className="text-sm text-gray-600">Stavki u rasponu</p>
              <p className="text-2xl font-bold text-gray-900">{itemsInRange.length}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <p className="text-sm text-gray-600">S fotografijama</p>
              <p className="text-2xl font-bold text-green-600">{itemsWithImages.length}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <p className="text-sm text-gray-600">Ukupno slika</p>
              <p className="text-2xl font-bold text-blue-600">{totalImages}</p>
            </div>
          </div>
        </>
      )}

      {/* Upozorenja */}
      {validationIssues.length === 0 && itemsWithoutImages.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">
                Upozorenje: {itemsWithoutImages.length} stavki u rasponu nema fotografije
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Sljedeće stavke neće biti uključene u PDF:
              </p>
              <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                {itemsWithoutImages.slice(0, 5).map(item => (
                  <li key={item.rb}>• {item.rb}. {item.nazivArtikla}</li>
                ))}
                {itemsWithoutImages.length > 5 && (
                  <li>... i još {itemsWithoutImages.length - 5} stavki</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Validacijske greške */}
      {validationIssues.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">
                Ispravite sljedeće greške prije generiranja PDF-a:
              </p>
              <ul className="text-sm text-red-700 mt-2 space-y-1">
                {validationIssues.map((issue, index) => (
                  <li key={index}>• {issue}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Success info */}
      {canGenerate && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-800">
                Spremno za generiranje PDF-a
              </p>
              <p className="text-sm text-green-700 mt-1">
                PDF će sadržavati {totalImages} {totalImages === 1 ? 'sliku' : 'slika'} iz {itemsWithImages.length} {itemsWithImages.length === 1 ? 'stavke' : 'stavki'}.
                Svaka slika će biti na posebnoj stranici.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {isGenerating && progress.total > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Generiram PDF...
            </span>
            <span className="text-sm text-gray-600">
              {progress.current}/{progress.total} slika
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Generate button */}
      <div className="flex justify-center">
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          className={`
            inline-flex items-center gap-3 px-6 py-3 rounded-lg font-semibold transition-colors
            ${canGenerate && !isGenerating
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          <FileText className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Generiram PDF...' : 'Generiraj PDF'}
        </button>
      </div>
    </div>
  );
}
