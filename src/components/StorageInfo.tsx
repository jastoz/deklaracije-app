'use client';

import { useEffect, useState } from 'react';
import { Database, HardDrive, Trash2 } from 'lucide-react';
import { getStorageEstimate } from '@/lib/storage';
import { useAppStore } from '@/lib/store';

export function StorageInfo() {
  const { troskovnikItems, clearStorage } = useAppStore();
  const [storageInfo, setStorageInfo] = useState({ usage: 0, quota: 0, percentUsed: 0 });
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const updateStorageInfo = async () => {
      const info = await getStorageEstimate();
      setStorageInfo(info);
    };

    updateStorageInfo();
    const interval = setInterval(updateStorageInfo, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [troskovnikItems]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const handleClearAll = async () => {
    if (!confirm('Jeste li sigurni da želite obrisati sve spremljene podatke? Ova akcija se ne može poništiti.')) {
      return;
    }

    setIsClearing(true);
    try {
      await clearStorage();
      alert('Svi podaci su uspješno obrisani.');
    } catch (error) {
      alert('Greška pri brisanju podataka: ' + error);
    } finally {
      setIsClearing(false);
    }
  };

  const totalImages = troskovnikItems.reduce((sum, item) => sum + item.images.length, 0);
  const hasData = troskovnikItems.length > 0 || storageInfo.usage > 0;

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Spremljeni podaci</h3>
        </div>
        <button
          onClick={handleClearAll}
          disabled={isClearing || !hasData}
          className={`
            inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
            ${hasData && !isClearing
              ? 'bg-red-50 text-red-700 hover:bg-red-100'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          <Trash2 className="w-4 h-4" />
          {isClearing ? 'Brisanje...' : 'Očisti sve'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <HardDrive className="w-4 h-4" />
            <span>Iskorišteno</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">
            {formatBytes(storageInfo.usage)}
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Dostupno</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">
            {formatBytes(storageInfo.quota)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-600">
          <span>Zauzeće prostora</span>
          <span>{storageInfo.percentUsed.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              storageInfo.percentUsed > 80
                ? 'bg-red-500'
                : storageInfo.percentUsed > 50
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(storageInfo.percentUsed, 100)}%` }}
          />
        </div>
      </div>

      {/* Warning for high usage */}
      {storageInfo.percentUsed > 80 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 text-sm text-yellow-800">
          ⚠️ Prostor za pohranu se puni. Preostalo: {formatBytes(storageInfo.quota - storageInfo.usage)}
        </div>
      )}
    </div>
  );
}
