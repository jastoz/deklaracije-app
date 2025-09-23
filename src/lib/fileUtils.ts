import CryptoJS from 'crypto-js';

export function sanitizeFilename(filename: string): string {
  // Hrvatski znakovi u ASCII
  const charMap: { [key: string]: string } = {
    'č': 'c', 'ć': 'c', 'đ': 'd', 'š': 's', 'ž': 'z',
    'Č': 'C', 'Ć': 'C', 'Đ': 'D', 'Š': 'S', 'Ž': 'Z'
  };

  return filename
    .replace(/[čćđšžČĆĐŠŽ]/g, (char) => charMap[char] || char)
    .replace(/[\\/:*?"<>|]/g, '') // Ukloni zabranjene znakove
    .replace(/[\x00-\x1f\x80-\x9f]/g, '') // Ukloni kontrolne znakove
    .replace(/\s+/g, ' ') // Višestruki razmaci u jedan
    .trim();
}

export function generateFilename(rb: number, nazivArtikla: string, extension: string, index?: number): string {
  const baseName = sanitizeFilename(`${rb}. ${nazivArtikla}`);
  const suffix = index && index > 0 ? ` (${index + 1})` : '';
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