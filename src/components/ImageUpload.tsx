'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image as ImageIcon, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { UploadedImage } from '@/lib/types';
import { generateFilename, getFileExtension, isAllowedFileType, createThumbnail, addWatermarkToImage } from '@/lib/fileUtils';

interface ImageUploadProps {
  rb: number;
  brand: string;
  nazivArtikla: string;
  images: UploadedImage[];
}

export function ImageUpload({ rb, brand, nazivArtikla, images }: ImageUploadProps) {
  const { addImageToItem, removeImageFromItem, addError } = useAppStore();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      // Provjeri tip datoteke
      if (!isAllowedFileType(file.name)) {
        addError(`Datoteka ${file.name} nije dozvoljena. Dozvoljeni tipovi: JPG, PNG, PDF`);
        continue;
      }

      try {
        // Dodaj vodeni žig na sliku
        const watermarkedFile = await addWatermarkToImage(file, rb);

        const extension = getFileExtension(watermarkedFile.name);
        let finalFilename: string;

        // Ako ima već slika ili će ih biti više, dodaj redni broj
        if (images.length > 0) {
          finalFilename = generateFilename(rb, brand, nazivArtikla, extension, images.length);
        } else {
          // Prva slika - bez sufiksa
          finalFilename = generateFilename(rb, brand, nazivArtikla, extension);
        }

        let thumbnail: string | undefined;
        try {
          thumbnail = await createThumbnail(watermarkedFile);
        } catch (error) {
          console.warn('Greška pri stvaranju thumbnail-a:', error);
        }

        const uploadedImage: UploadedImage = {
          id: `${Date.now()}-${Math.random()}`,
          file: watermarkedFile,
          originalFilename: file.name,
          finalFilename,
          isEditing: false,
          thumbnail
        };

        addImageToItem(rb, uploadedImage);
      } catch (error) {
        addError(`Greška pri obradi datoteke ${file.name}: ${error}`);
      }
    }
  }, [rb, brand, nazivArtikla, images, addImageToItem, addError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const handleRemoveImage = (imageId: string) => {
    removeImageFromItem(rb, imageId);
  };

  return (
    <div className="space-y-3">
      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
          ${isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          {isDragActive ? (
            <Upload className="w-6 h-6 text-blue-500" />
          ) : (
            <ImageIcon className="w-6 h-6 text-gray-400" />
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">
              {isDragActive ? 'Pustite slike ovdje...' : 'Dodaj fotografije'}
            </p>
            <p className="text-xs text-gray-500">
              JPG, PNG, PDF
            </p>
          </div>
        </div>
      </div>

      {/* Uploaded Images */}
      {images.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">
            Dodane slike ({images.length})
          </p>
          <div className="grid grid-cols-1 gap-2">
            {images.map((image) => (
              <div
                key={image.id}
                className="flex items-center gap-2 p-1 bg-gray-50 rounded text-xs"
              >
                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {image.finalFilename}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {image.originalFilename}
                  </p>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveImage(image.id)}
                  className="flex-shrink-0 p-1 text-red-400 hover:text-red-600 transition-colors"
                  title="Ukloni sliku"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}