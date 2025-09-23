'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText } from 'lucide-react';
import { parseXLSX } from '@/lib/xlsxParser';
import { useAppStore } from '@/lib/store';

export function FileUpload() {
  const { setTroskovnikItems, addError, clearErrors, setProcessing } = useAppStore();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Provjeri je li XLSX datoteka
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls'].includes(extension || '')) {
      addError('Molimo učitajte XLSX datoteku');
      return;
    }

    clearErrors();
    setProcessing(true);

    try {
      const { items, errors } = await parseXLSX(file);

      if (errors.length > 0) {
        errors.forEach(error => addError(error));
      }

      if (items.length > 0) {
        setTroskovnikItems(items);
      }
    } catch (error) {
      addError(`Greška pri obradi datoteke: ${error}`);
    } finally {
      setProcessing(false);
    }
  }, [setTroskovnikItems, addError, clearErrors, setProcessing]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
        ${isDragActive
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400'
        }
      `}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4">
        {isDragActive ? (
          <Upload className="w-12 h-12 text-blue-500" />
        ) : (
          <FileText className="w-12 h-12 text-gray-400" />
        )}
        <div>
          <p className="text-lg font-medium text-gray-900">
            {isDragActive
              ? 'Pustite datoteku ovdje...'
              : 'Učitaj troškovnik (XLSX)'
            }
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Drag & drop ili kliknite za odabir XLSX datoteke
          </p>
        </div>
      </div>
    </div>
  );
}