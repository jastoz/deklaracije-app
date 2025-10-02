'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, X, Clock } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { hasStoredData, getStoredTimestamp } from '@/lib/persistence';

export function RestoreDialog() {
  const { loadFromStorage, clearStorage } = useAppStore();
  const [showDialog, setShowDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    // Check if there's stored data on mount
    if (hasStoredData()) {
      const timestamp = getStoredTimestamp();
      if (timestamp) {
        setLastSaved(formatTimestamp(timestamp));
      }
      setShowDialog(true);
    }
  }, []);

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'prije manje od minute';
    if (diffMins < 60) return `prije ${diffMins} min`;
    if (diffHours < 24) return `prije ${diffHours} h`;
    if (diffDays === 1) return 'jučer';
    if (diffDays < 7) return `prije ${diffDays} dana`;

    return date.toLocaleDateString('hr-HR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleRestore = async () => {
    setIsLoading(true);
    try {
      const success = await loadFromStorage();
      if (success) {
        setShowDialog(false);
      } else {
        alert('Greška pri učitavanju podataka.');
      }
    } catch (error) {
      alert('Greška pri učitavanju podataka: ' + error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartFresh = async () => {
    if (confirm('Jeste li sigurni da želite započeti ispočetka? Svi spremljeni podaci će biti obrisani.')) {
      try {
        await clearStorage();
        setShowDialog(false);
      } catch (error) {
        alert('Greška pri brisanju podataka: ' + error);
      }
    }
  };

  if (!showDialog) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <RefreshCw className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Pronađen prethodni rad
              </h2>
              {lastSaved && (
                <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                  <Clock className="w-4 h-4" />
                  <span>Zadnje spremljeno: {lastSaved}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowDialog(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <p className="text-gray-600">
            Imate spremljene podatke iz prethodne sesije. Želite li nastaviti s prethodnim radom ili započeti ispočetka?
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              💡 <strong>Savjet:</strong> Ako nastavite s prethodnim radom, sve dodane fotografije i troškovnik će biti učitani.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleRestore}
            disabled={isLoading}
            className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Učitavam...' : 'Nastavi s prethodnim radom'}
          </button>
          <button
            onClick={handleStartFresh}
            disabled={isLoading}
            className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Započni ispočetka
          </button>
        </div>
      </div>
    </div>
  );
}
