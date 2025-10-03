'use client';

import { useState } from 'react';
import { Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { generateZIP, downloadZIP } from '@/lib/zipExport';
import { CompressionLevel } from '@/lib/fileUtils';

export function ExportSection() {
  const { nazivUstanove, troskovnikItems, addError } = useAppStore();
  const [isExporting, setIsExporting] = useState(false);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('optimized');
  const [compressionProgress, setCompressionProgress] = useState(0);

  // Statistike
  const totalItems = troskovnikItems.length;
  const itemsWithImages = troskovnikItems.filter(item => item.images.length > 0).length;
  const itemsWithoutImages = totalItems - itemsWithImages;
  const totalImages = troskovnikItems.reduce((sum, item) => sum + item.images.length, 0);

  // Validacije
  const canExport = nazivUstanove.trim() !== '' && totalItems > 0 && totalImages > 0;

  const validationIssues = [];
  if (!nazivUstanove.trim()) {
    validationIssues.push('Naziv ustanove je obavezan');
  }
  if (totalItems === 0) {
    validationIssues.push('Nema stavki u troškovniku');
  }
  if (totalImages === 0) {
    validationIssues.push('Nema dodanih fotografija');
  }

  const handleExport = async (includeStamp: boolean = true) => {
    if (!canExport) return;

    setIsExporting(true);
    setCompressionProgress(0);

    try {
      const zipBlob = await generateZIP(
        nazivUstanove,
        troskovnikItems,
        compressionLevel,
        (progress) => setCompressionProgress(progress),
        includeStamp
      );
      downloadZIP(zipBlob, nazivUstanove);
    } catch (error) {
      addError(`Greška pri generiranju ZIP datoteke: ${error}`);
    } finally {
      setIsExporting(false);
      setCompressionProgress(0);
    }
  };

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 rounded-lg">
      <h2 className="text-xl font-semibold text-gray-900">
        Export deklaracija
      </h2>

      {/* Statistike */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Ukupno stavki</p>
          <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">S fotografijama</p>
          <p className="text-2xl font-bold text-green-600">{itemsWithImages}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Bez fotografija</p>
          <p className="text-2xl font-bold text-orange-600">{itemsWithoutImages}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Ukupno slika</p>
          <p className="text-2xl font-bold text-blue-600">{totalImages}</p>
        </div>
      </div>

      {/* Upozorenja */}
      {itemsWithoutImages > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">
                Upozorenje: {itemsWithoutImages} stavki nema fotografije
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Sljedeće stavke neće biti uključene u export:
              </p>
              <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                {troskovnikItems
                  .filter(item => item.images.length === 0)
                  .slice(0, 5) // Prikaži samo prvih 5
                  .map(item => (
                    <li key={item.rb}>• {item.rb}. {item.nazivArtikla}</li>
                  ))}
                {itemsWithoutImages > 5 && (
                  <li>... i još {itemsWithoutImages - 5} stavki</li>
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
                Ispravite sljedeće greške prije exporta:
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

      {/* Compression Level Selection */}
      {canExport && (
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Razina kompresije</h3>
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="compression"
                value="original"
                checked={compressionLevel === 'original'}
                onChange={(e) => setCompressionLevel(e.target.value as CompressionLevel)}
                className="mt-1 w-4 h-4 text-blue-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Originalna kvaliteta</div>
                <div className="text-sm text-gray-600 mt-1">
                  Bez kompresije - originalne slike i dimenzije (najveća veličina ZIP-a)
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border-2 border-blue-500 rounded-lg cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors">
              <input
                type="radio"
                name="compression"
                value="optimized"
                checked={compressionLevel === 'optimized'}
                onChange={(e) => setCompressionLevel(e.target.value as CompressionLevel)}
                className="mt-1 w-4 h-4 text-blue-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 flex items-center gap-2">
                  Optimizirana <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Preporučeno</span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Quality 87%, max 2048px - ušteda 40-60% bez vidljivog gubitka kvalitete
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="compression"
                value="maximum"
                checked={compressionLevel === 'maximum'}
                onChange={(e) => setCompressionLevel(e.target.value as CompressionLevel)}
                className="mt-1 w-4 h-4 text-blue-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Maksimalna kompresija</div>
                <div className="text-sm text-gray-600 mt-1">
                  Quality 75%, max 1600px - ušteda 60-75%, lagano smanjena kvaliteta
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Export informacije */}
      {canExport && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-800">
                Spremno za export
              </p>
              <p className="text-sm text-green-700 mt-1">
                ZIP datoteka će sadržavati {totalImages} fotografija/dokumenata iz {itemsWithImages} stavki,
                manifest.csv s metapodacima i summary.txt s pregledom.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {isExporting && compressionProgress > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Komprimiram slike...</span>
            <span className="text-sm text-gray-600">{compressionProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${compressionProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Export gumbovi */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => handleExport(true)}
          disabled={!canExport || isExporting}
          className={`
            inline-flex items-center gap-3 px-6 py-3 rounded-lg font-semibold transition-colors
            ${canExport && !isExporting
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          <Download className={`w-5 h-5 ${isExporting ? 'animate-spin' : ''}`} />
          {isExporting ? 'Generiranje ZIP...' : 'Generiraj ZIP s pečatom'}
        </button>

        <button
          onClick={() => handleExport(false)}
          disabled={!canExport || isExporting}
          className={`
            inline-flex items-center gap-3 px-6 py-3 rounded-lg font-semibold transition-colors
            ${canExport && !isExporting
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          <Download className={`w-5 h-5 ${isExporting ? 'animate-spin' : ''}`} />
          {isExporting ? 'Generiranje ZIP...' : 'Generiraj ZIP bez pečata'}
        </button>
      </div>
    </div>
  );
}