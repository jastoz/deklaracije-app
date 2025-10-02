import JSZip from 'jszip';
import { TroskovnikItem, ManifestEntry } from './types';
import { calculateSHA256, compressImageForExport, CompressionLevel } from './fileUtils';

export async function generateZIP(
  nazivUstanove: string,
  items: TroskovnikItem[],
  compressionLevel: CompressionLevel = 'optimized',
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const zip = new JSZip();
  const manifestEntries: ManifestEntry[] = [];

  // Izračunaj ukupan broj slika za progress tracking
  const totalImages = items.reduce((sum, item) => sum + item.images.length, 0);
  let processedImages = 0;

  for (const item of items) {
    for (const image of item.images) {
      try {
        // Komprimiraj sliku ako nije originalna kvaliteta
        const { file: processedFile, filename: processedFilename } = await compressImageForExport(
          image.file,
          image.finalFilename,
          compressionLevel
        );

        // Izračunaj SHA256 komprimitane slike
        const sha256 = await calculateSHA256(processedFile);

        // Dodaj sliku u ZIP
        zip.file(processedFilename, processedFile);

        // Dodaj u manifest
        manifestEntries.push({
          rb: item.rb,
          naziv_artikla: item.nazivArtikla,
          brand: item.brand || '',
          original_filename: image.originalFilename,
          final_filename: processedFilename,
          sha256,
          uploaded_at: new Date().toISOString(),
          note: ''
        });

        // Ažuriraj progress
        processedImages++;
        if (onProgress) {
          const progress = Math.round((processedImages / totalImages) * 100);
          onProgress(progress);
        }
      } catch (error) {
        console.error(`Greška pri obradi slike ${image.originalFilename}:`, error);
        throw new Error(`Greška pri obradi slike ${image.originalFilename}`);
      }
    }
  }

  // Generiraj manifest.csv
  const csvContent = generateManifestCSV(manifestEntries);
  zip.file('manifest.csv', csvContent);

  // Generiraj summary.txt
  const summaryContent = generateSummary(nazivUstanove, items, manifestEntries);
  zip.file('summary.txt', summaryContent);

  // Generiraj ZIP
  return await zip.generateAsync({ type: 'blob' });
}

function generateManifestCSV(entries: ManifestEntry[]): string {
  const headers = [
    'rb',
    'naziv_artikla',
    'brand',
    'original_filename',
    'final_filename',
    'sha256',
    'uploaded_at',
    'note'
  ];

  const csvRows = [
    headers.join(','),
    ...entries.map(entry =>
      [
        entry.rb,
        `"${entry.naziv_artikla.replace(/"/g, '""')}"`,
        `"${entry.brand.replace(/"/g, '""')}"`,
        `"${entry.original_filename.replace(/"/g, '""')}"`,
        `"${entry.final_filename.replace(/"/g, '""')}"`,
        entry.sha256,
        entry.uploaded_at,
        `"${entry.note.replace(/"/g, '""')}"`
      ].join(',')
    )
  ];

  return csvRows.join('\\n');
}

function generateSummary(
  nazivUstanove: string,
  items: TroskovnikItem[],
  manifestEntries: ManifestEntry[]
): string {
  const totalItems = items.length;
  const itemsWithImages = items.filter(item => item.images.length > 0).length;
  const itemsWithoutImages = totalItems - itemsWithImages;
  const totalImages = manifestEntries.length;

  const summary = `DEKLARACIJE - SAŽETAK
========================

Naziv ustanove: ${nazivUstanove}
Datum generiranja: ${new Date().toLocaleString('hr-HR')}

STATISTIKE:
- Ukupno stavki u troškovniku: ${totalItems}
- Stavki s fotografijama: ${itemsWithImages}
- Stavki bez fotografija: ${itemsWithoutImages}
- Ukupno fotografija: ${totalImages}

${itemsWithoutImages > 0 ? `
STAVKE BEZ FOTOGRAFIJA:
${items
  .filter(item => item.images.length === 0)
  .map(item => `- ${item.rb}. ${item.nazivArtikla}`)
  .join('\\n')}
` : ''}

DATOTEKE U ARHIVI:
- manifest.csv (popis svih datoteka s metapodacima)
- ${totalImages} fotografija/dokumenata
- summary.txt (ovaj dokument)

Generirano pomoću Deklaracije App
`;

  return summary;
}

export function downloadZIP(blob: Blob, nazivUstanove: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const sanitizedName = nazivUstanove
    .replace(/[^a-zA-Z0-9čćđšžČĆĐŠŽ\s]/g, '')
    .replace(/\s+/g, '_');

  link.href = url;
  link.download = `${date}_${sanitizedName}_deklaracije.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}