'use client';

import { AlertCircle, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export function ErrorDisplay() {
  const { errors, clearErrors } = useAppStore();

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {errors.map((error, index) => (
        <div
          key={index}
          className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <button
            onClick={clearErrors}
            className="text-red-400 hover:text-red-600 transition-colors"
            title="Ukloni greške"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}