import JSZip from 'jszip';
import { UploadedImage, TroskovnikItem } from './types';
import { isAllowedFileType, createThumbnail } from './fileUtils';

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export function extractRbFromFilename(filename: string): number | null {
  // Pokušaj ekstraktirati redni broj iz naziva datoteke
  // Formati: "1. Naziv.jpg", "01. Naziv.jpg", "1_Naziv.jpg", itd.
  const patterns = [
    /^(\d+)\.\s+/,  // "1. Naziv"
    /^(\d+)\s+/,    // "1 Naziv"
    /^(\d+)_/,      // "1_Naziv"
    /^(\d+)-/,      // "1-Naziv"
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      const rb = parseInt(match[1], 10);
      if (!isNaN(rb) && rb > 0) {
        return rb;
      }
    }
  }

  return null;
}

export async function parseZipFile(file: File): Promise<{ files: File[], errors: string[] }> {
  const errors: string[] = [];
  const files: File[] = [];

  try {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
      // Preskače direktorije i skrivene datoteke
      if (zipEntry.dir || relativePath.startsWith('.') || relativePath.includes('__MACOSX')) {
        continue;
      }

      const filename = relativePath.split('/').pop() || relativePath;

      // Provjeri tip datoteke
      if (!isAllowedFileType(filename)) {
        errors.push(`Preskačem datoteku ${filename} - nepoznat tip`);
        continue;
      }

      try {
        const blob = await zipEntry.async('blob');
        const extractedFile = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
        files.push(extractedFile);
      } catch (error) {
        errors.push(`Greška pri ekstraktiranju datoteke ${filename}: ${error}`);
      }
    }
  } catch (error) {
    errors.push(`Greška pri čitanju ZIP datoteke: ${error}`);
  }

  return { files, errors };
}

export async function createUploadedImageFromFile(file: File, rb: number): Promise<UploadedImage> {
  let thumbnail: string | undefined;

  try {
    thumbnail = await createThumbnail(file);
  } catch (error) {
    console.warn('Greška pri stvaranju thumbnail-a:', error);
  }

  return {
    id: `${Date.now()}-${Math.random()}`,
    file,
    originalFilename: file.name,
    finalFilename: file.name, // Bit će preimenovano u store-u
    isEditing: false,
    thumbnail
  };
}

export async function importImagesToItems(
  files: File[],
  troskovnikItems: TroskovnikItem[]
): Promise<{ importedImages: { rb: number, image: UploadedImage }[], result: ImportResult }> {
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: []
  };

  const importedImages: { rb: number, image: UploadedImage }[] = [];

  // Stvori mapu postojećih stavki po rb broju
  const itemsMap = new Map<number, TroskovnikItem>();
  troskovnikItems.forEach(item => itemsMap.set(item.rb, item));

  for (const file of files) {
    const rb = extractRbFromFilename(file.name);

    if (rb === null) {
      result.errors.push(`Nije moguće ekstraktirati redni broj iz datoteke: ${file.name}`);
      result.skipped++;
      continue;
    }

    const existingItem = itemsMap.get(rb);
    if (!existingItem) {
      result.errors.push(`Nije pronađena stavka s rednim brojem ${rb} za datoteku: ${file.name}`);
      result.skipped++;
      continue;
    }

    try {
      const uploadedImage = await createUploadedImageFromFile(file, rb);
      importedImages.push({ rb, image: uploadedImage });
      result.imported++;
    } catch (error) {
      result.errors.push(`Greška pri obradi datoteke ${file.name}: ${error}`);
      result.skipped++;
    }
  }

  return { importedImages, result };
}

export async function processImportFiles(files: FileList | File[]): Promise<{ files: File[], errors: string[] }> {
  const errors: string[] = [];
  const processedFiles: File[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Ako je ZIP datoteka, ekstraktiraj je
    if (file.type === 'application/zip' || file.name.toLowerCase().endsWith('.zip')) {
      const { files: extractedFiles, errors: zipErrors } = await parseZipFile(file);
      processedFiles.push(...extractedFiles);
      errors.push(...zipErrors);
    }
    // Inače provjeri je li dozvoljena datoteka
    else if (isAllowedFileType(file.name)) {
      processedFiles.push(file);
    } else {
      errors.push(`Preskačem datoteku ${file.name} - nepoznat tip`);
    }
  }

  return { files: processedFiles, errors };
}