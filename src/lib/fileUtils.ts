import CryptoJS from 'crypto-js';

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[\\/:*?"<>|]/g, '') // Ukloni zabranjene znakove
    .replace(/[\x00-\x1f\x80-\x9f]/g, '') // Ukloni kontrolne znakove
    .replace(/\s+/g, ' ') // Višestruki razmaci u jedan
    .trim();
}

export function generateFilename(rb: number, brand: string, nazivArtikla: string, extension: string, index?: number): string {
  const baseName = sanitizeFilename(`${rb}. ${brand} ${nazivArtikla}`);
  const suffix = (index !== undefined && index > 0) ? ` (${index + 1})` : '';
  return `${baseName}${suffix}.${extension}`;
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function isAllowedFileType(filename: string): boolean {
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];
  const extension = getFileExtension(filename);
  return allowedExtensions.includes(extension);
}

export async function calculateSHA256(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
        const hash = CryptoJS.SHA256(wordArray).toString();
        resolve(hash);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Greška pri čitanju datoteke'));
    reader.readAsArrayBuffer(file);
  });
}

export function createThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      // Za PDF-ove i ostale datoteke, vrati placeholder
      resolve('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f3f4f6"/><text x="50" y="50" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="12" fill="%236b7280">PDF</text></svg>');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Thumbnail veličina
        const maxSize = 100;
        let { width, height } = img;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };

      img.onerror = () => reject(new Error('Greška pri stvaranju thumbnail-a'));
      img.src = reader.result as string;
    };

    reader.onerror = () => reject(new Error('Greška pri čitanju slike'));
    reader.readAsDataURL(file);
  });
}

export type CompressionLevel = 'original' | 'optimized' | 'maximum';

interface CompressionSettings {
  quality: number;
  maxDimension: number;
  convertPngToJpg: boolean;
}

const COMPRESSION_PRESETS: Record<CompressionLevel, CompressionSettings> = {
  original: {
    quality: 1.0,
    maxDimension: Infinity,
    convertPngToJpg: false,
  },
  optimized: {
    quality: 0.87,
    maxDimension: 2048,
    convertPngToJpg: true,
  },
  maximum: {
    quality: 0.75,
    maxDimension: 1600,
    convertPngToJpg: true,
  },
};

async function isPngTransparent(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(false);
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Provjeri nekoliko piksela za transparenciju
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 255) {
            resolve(true); // Pronađena transparencija
            return;
          }
        }
        resolve(false); // Nema transparencije
      };
      img.onerror = () => resolve(false);
      img.src = reader.result as string;
    };
    reader.onerror = () => resolve(false);
    reader.readAsDataURL(file);
  });
}

export async function compressImageForExport(
  file: File,
  originalFilename: string,
  compressionLevel: CompressionLevel = 'optimized'
): Promise<{ file: File; filename: string }> {
  // Ako je PDF ili dokument, vrati original
  if (!file.type.startsWith('image/')) {
    return { file, filename: originalFilename };
  }

  const settings = COMPRESSION_PRESETS[compressionLevel];

  // Ako je originalna kvaliteta, vrati original
  if (compressionLevel === 'original') {
    return { file, filename: originalFilename };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async () => {
      const img = new Image();

      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Ne mogu kreirati canvas kontekst'));
          return;
        }

        let { width, height } = img;

        // Resize ako je veće od maxDimension
        if (width > settings.maxDimension || height > settings.maxDimension) {
          if (width > height) {
            if (width > settings.maxDimension) {
              height = (height * settings.maxDimension) / width;
              width = settings.maxDimension;
            }
          } else {
            if (height > settings.maxDimension) {
              width = (width * settings.maxDimension) / height;
              height = settings.maxDimension;
            }
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Koristi visokokvalitetni rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Odluči o output formatu
        let outputMimeType = file.type;
        let outputExtension = getFileExtension(originalFilename);

        // Konvertiraj PNG u JPG ako nema transparenciju
        if (file.type === 'image/png' && settings.convertPngToJpg) {
          const hasTransparency = await isPngTransparent(file);
          if (!hasTransparency) {
            outputMimeType = 'image/jpeg';
            outputExtension = 'jpg';
          }
        }

        // Generiraj blob s kompresijom
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Greška pri kompresiji slike'));
              return;
            }

            // Ažuriraj naziv datoteke s novim extension-om
            const newFilename = originalFilename.replace(/\.[^.]+$/, `.${outputExtension}`);
            const compressedFile = new File([blob], newFilename, { type: outputMimeType });

            resolve({ file: compressedFile, filename: newFilename });
          },
          outputMimeType,
          settings.quality
        );
      };

      img.onerror = () => reject(new Error('Greška pri učitavanju slike'));
      img.src = reader.result as string;
    };

    reader.onerror = () => reject(new Error('Greška pri čitanju datoteke'));
    reader.readAsDataURL(file);
  });
}