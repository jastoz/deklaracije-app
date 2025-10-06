import { jsPDF } from 'jspdf';
import { TroskovnikItem } from './types';

// Load pdfjs-dist from CDN to avoid webpack issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLib: any = null;

async function loadPdfJs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be loaded in browser');
  }

  if (!pdfjsLib) {
    // Load from window if already loaded via CDN
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).pdfjsLib) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pdfjsLib = (window as any).pdfjsLib;
      return pdfjsLib;
    }

    // Dynamically load script from CDN
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;

      script.onload = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdfjsLib = (window as any).pdfjsLib;
        if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        resolve(pdfjsLib);
      };

      script.onerror = () => {
        reject(new Error('Failed to load PDF.js from CDN'));
      };

      document.head.appendChild(script);
    });
  }

  return pdfjsLib;
}

export type PDFQuality = 'high' | 'medium' | 'low';

export interface PDFExportOptions {
  includeWatermark: boolean;
  quality: PDFQuality;
}

interface PDFQualitySettings {
  imageQuality: number;
  maxDimension: number;
}

const PDF_QUALITY_PRESETS: Record<PDFQuality, PDFQualitySettings> = {
  high: {
    imageQuality: 0.92,
    maxDimension: 2400,
  },
  medium: {
    imageQuality: 0.85,
    maxDimension: 1800,
  },
  low: {
    imageQuality: 0.75,
    maxDimension: 1200,
  },
};

// Cache za stamp sliku - učitava se samo jednom
let cachedStampImage: HTMLImageElement | null = null;

async function loadStampImage(): Promise<HTMLImageElement> {
  if (cachedStampImage) {
    return cachedStampImage;
  }

  return new Promise((resolve, reject) => {
    const stampImg = new Image();
    const tempCanvas = document.createElement('canvas');

    stampImg.onload = () => {
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) {
        reject(new Error('Ne mogu kreirati canvas kontekst'));
        return;
      }

      tempCanvas.width = stampImg.width;
      tempCanvas.height = stampImg.height;
      tempCtx.drawImage(stampImg, 0, 0);

      // Ukloni bijelu pozadinu
      removeWhiteBackground(tempCanvas);

      // Pretvori u Image za caching
      const processedStamp = new Image();
      processedStamp.onload = () => {
        cachedStampImage = processedStamp;
        resolve(processedStamp);
      };
      processedStamp.onerror = () => reject(new Error('Greška pri obradi pečata'));
      processedStamp.src = tempCanvas.toDataURL('image/png');
    };

    stampImg.onerror = () => reject(new Error('Greška pri učitavanju pečata'));
    stampImg.src = '/stamp.png';
  });
}

function removeWhiteBackground(sourceCanvas: HTMLCanvasElement): void {
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    const isLightPixel = r >= 180 && g >= 180 && b >= 180;
    const colorDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));
    const isNeutral = colorDiff < 30;

    if (isLightPixel && isNeutral) {
      pixels[i + 3] = 0;
    } else if (isLightPixel) {
      const lightness = (r + g + b) / 3;
      const alphaReduction = ((lightness - 180) / 75) * 255;
      pixels[i + 3] = Math.max(0, pixels[i + 3] - alphaReduction);
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// Convert PDF file to array of canvas images (one per page)
async function convertPdfToCanvases(file: File, maxDimension: number): Promise<HTMLCanvasElement[]> {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const canvases: HTMLCanvasElement[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });

    // Calculate scale to fit maxDimension
    const scale = Math.min(
      maxDimension / viewport.width,
      maxDimension / viewport.height,
      1.0 // Don't upscale
    );

    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Cannot create canvas context for PDF rendering');
    }

    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
    }).promise;

    canvases.push(canvas);
  }

  return canvases;
}

interface ProcessedImageResult {
  dataURL: string;
  width: number;
  height: number;
}

// Process canvas with watermark and stamp
function processCanvasWithWatermark(
  sourceCanvas: HTMLCanvasElement,
  rb: number,
  includeWatermark: boolean,
  stampImage: HTMLImageElement | null,
  quality: number
): ProcessedImageResult {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Ne mogu kreirati canvas kontekst');
  }

  const { width, height } = sourceCanvas;
  canvas.width = width;
  canvas.height = height;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw source canvas
  ctx.drawImage(sourceCanvas, 0, 0);

  // Add watermark text + stamp if enabled
  if (includeWatermark) {
    // Add watermark text - gornji lijevi kut, decentno
    const watermarkText = `stavka ${rb}. troškovnika`;
    // Poboljšana formula za bolju čitljivost na svim veličinama
    const fontSize = Math.max(16, Math.min(width / 25, 32));
    ctx.font = `${fontSize}px Arial, sans-serif`;

    const textMetrics = ctx.measureText(watermarkText);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;
    const paddingX = fontSize * 0.6;
    const paddingY = fontSize * 0.4;

    const margin = width * 0.01;
    const rectX = margin;
    const rectY = margin;
    const rectWidth = textWidth + paddingX * 2;
    const rectHeight = textHeight + paddingY * 2;

    // Draw semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    const radius = fontSize * 0.25;
    ctx.moveTo(rectX + radius, rectY);
    ctx.lineTo(rectX + rectWidth - radius, rectY);
    ctx.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + radius);
    ctx.lineTo(rectX + rectWidth, rectY + rectHeight - radius);
    ctx.quadraticCurveTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - radius, rectY + rectHeight);
    ctx.lineTo(rectX + radius, rectY + rectHeight);
    ctx.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - radius);
    ctx.lineTo(rectX, rectY + radius);
    ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
    ctx.closePath();
    ctx.fill();

    // Draw text - lijevo poravnat
    const textX = rectX + paddingX;
    const textY = rectY + paddingY + fontSize * 0.7;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(watermarkText, textX, textY);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Add stamp if available - donji desni kut
    if (stampImage) {
      // Adaptivno skaliranje pečata ovisno o veličini slike
      // Ista logika kao u fileUtils.ts za konzistentnost
      let stampScale: number;
      if (width <= 1500) {
        // Obične slike: 56%
        stampScale = 0.56;
      } else if (width <= 3000) {
        // Srednje visoke rezolucije: 70%
        stampScale = 0.70;
      } else {
        // Visokokvalitetne slike (>3000px): 80%
        stampScale = 0.80;
      }

      let stampWidth = width * stampScale;
      let stampHeight = (stampImage.height / stampImage.width) * stampWidth;

      // Safety check - ograniči na max 95% visine slike
      const maxHeight = height * 0.95;
      if (stampHeight > maxHeight) {
        stampHeight = maxHeight;
        stampWidth = (stampImage.width / stampImage.height) * stampHeight;
      }

      const padding = width * 0.02;
      const stampX = width - stampWidth - padding;
      const stampY = height - stampHeight - padding;

      ctx.globalAlpha = 0.9;
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(stampImage, stampX, stampY, stampWidth, stampHeight);

      // Reset blend mode
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  const dataURL = canvas.toDataURL('image/jpeg', quality);

  return {
    dataURL,
    width,
    height,
  };
}

// OPTIMIZED: Kombinira watermark + stamp + resize u JEDAN canvas prolaz
async function processImageForPDF(
  file: File,
  rb: number,
  includeWatermark: boolean,
  stampImage: HTMLImageElement | null,
  maxDimension: number,
  quality: number
): Promise<ProcessedImageResult[]> {
  return new Promise(async (resolve, reject) => {
    // Provjeri da li je file valjan
    if (!file) {
      console.error('File je null ili undefined za stavku', rb);
      reject(new Error(`File objekt nedostaje za stavku ${rb}. Molimo osvježite stranicu i pokušajte ponovno.`));
      return;
    }

    if (!(file instanceof File)) {
      console.error('File NIJE File objekt za stavku', rb, 'Tip:', typeof file, 'Vrijednost:', file);
      reject(new Error(`Nevažeći File objekt za stavku ${rb}. Tip: ${typeof file}. Molimo osvježite stranicu i ponovo učitajte slike.`));
      return;
    }

    // Handle PDF files - convert to canvases first
    if (file.type === 'application/pdf') {
      try {
        const canvases = await convertPdfToCanvases(file, maxDimension);
        const results: ProcessedImageResult[] = [];

        for (const canvas of canvases) {
          const result = processCanvasWithWatermark(canvas, rb, includeWatermark, stampImage, quality);
          results.push(result);
        }

        resolve(results);
        return;
      } catch (error) {
        console.error('Greška pri konverziji PDF-a:', error);
        reject(new Error(`Greška pri konverziji PDF-a za stavku ${rb}: ${error}`));
        return;
      }
    }

    // Provjeri da li je file slika
    if (!file.type || !file.type.startsWith('image/')) {
      console.error('File nema valjan image type za stavku', rb, 'Type:', file.type, 'Name:', file.name);
      reject(new Error(`Nevažeći tip datoteke za stavku ${rb}: ${file.type || 'nepoznat'}. Očekuje se image/* ili application/pdf.`));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (!reader.result) {
        reject(new Error(`Nema podataka za sliku u stavki ${rb}`));
        return;
      }

      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Ne mogu kreirati canvas kontekst'));
          return;
        }

        let { width, height } = img;

        // STEP 1: Resize calculations
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            if (width > maxDimension) {
              height = (height * maxDimension) / width;
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = (width * maxDimension) / height;
              height = maxDimension;
            }
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // STEP 2: Draw original image (resized)
        ctx.drawImage(img, 0, 0, width, height);

        // STEP 3: Process with watermark and stamp
        const result = processCanvasWithWatermark(canvas, rb, includeWatermark, stampImage, quality);

        // Return as array with single result (images return 1 page, PDFs return multiple)
        resolve([result]);
      };

      img.onerror = (e) => {
        console.error('Image load error:', e, 'File:', file.name, 'Type:', file.type, 'Size:', file.size);
        reject(new Error(`Greška pri učitavanju slike za stavku ${rb}: ${file.name}`));
      };
      img.src = reader.result as string;
    };

    reader.onerror = (e) => {
      console.error('FileReader error:', e, 'File:', file.name);
      reject(new Error(`Greška pri čitanju datoteke za stavku ${rb}: ${file.name}`));
    };
    reader.readAsDataURL(file);
  });
}

export async function generatePDF(
  nazivUstanove: string,
  items: TroskovnikItem[],
  fromRb: number,
  toRb: number,
  options: PDFExportOptions,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const qualitySettings = PDF_QUALITY_PRESETS[options.quality];

  // Filtriraj stavke prema range-u i one koje imaju barem jednu sliku/PDF
  const filteredItems = items.filter(item =>
    item.rb >= fromRb && item.rb <= toRb && item.images.length > 0
  );

  // Debug: Ispiši tipove svih datoteka
  console.log('=== PDF Export Debug ===');
  filteredItems.forEach(item => {
    console.log(`Stavka ${item.rb}:`, item.images.map(img => ({
      name: img.originalFilename,
      type: img.file.type,
      isImage: img.file.type.startsWith('image/'),
      isPdf: img.file.type === 'application/pdf',
      hasType: !!img.file.type
    })));
  });

  // Izbroji ukupan broj slika i PDF-ova
  const totalImages = filteredItems.reduce((sum, item) =>
    sum + item.images.filter(img => img.file.type && img.file.type.startsWith('image/')).length, 0
  );
  const totalPdfs = filteredItems.reduce((sum, item) =>
    sum + item.images.filter(img => img.file.type === 'application/pdf').length, 0
  );
  const totalFiles = totalImages + totalPdfs;
  const totalInvalid = filteredItems.reduce((sum, item) =>
    sum + item.images.filter(img => !img.file.type).length, 0
  );

  console.log(`Ukupno slika: ${totalImages}, PDF-ova: ${totalPdfs}, Ukupno: ${totalFiles}, Nevažećih: ${totalInvalid}`);

  if (totalFiles === 0) {
    throw new Error('Nema slika ili PDF dokumenata u odabranom rasponu');
  }

  if (totalPdfs > 0) {
    console.info(`${totalPdfs} PDF dokumenata će biti konvertirano u slike`);
  }
  if (totalInvalid > 0) {
    console.error(`⚠️ UPOZORENJE: ${totalInvalid} datoteka NEMA valjan type - neće biti uključene u PDF!`);
  }

  // OPTIMIZATION: Load stamp image once at the beginning
  let stampImage: HTMLImageElement | null = null;
  if (options.includeWatermark) {
    try {
      stampImage = await loadStampImage();
    } catch (error) {
      // Ako je watermark uključen, stamp MORA biti dostupan
      throw new Error(`Greška pri učitavanju pečata: ${error}`);
    }
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let isFirstPage = true;
  let processedImages = 0;

  // OPTIMIZATION: Batch processing - process 3 files in parallel
  const BATCH_SIZE = 3;
  const CHUNK_SIZE = 10;

  for (const item of filteredItems) {
    // Process files in batches of BATCH_SIZE
    for (let i = 0; i < item.images.length; i += BATCH_SIZE) {
      const batch = item.images.slice(i, i + BATCH_SIZE);

      // Process batch in parallel - each file can return multiple pages (for PDFs)
      const processedBatch = await Promise.all(
        batch.map(image =>
          processImageForPDF(
            image.file,
            item.rb,
            options.includeWatermark,
            stampImage,
            qualitySettings.maxDimension,
            qualitySettings.imageQuality
          ).catch(error => {
            console.error(`Greška pri obradi datoteke ${image.originalFilename}:`, error);
            throw new Error(`Greška pri obradi datoteke ${image.originalFilename}`);
          })
        )
      );

      // Add processed images to PDF - flatten array since PDFs return multiple pages
      for (const resultArray of processedBatch) {
        for (const result of resultArray) {
        try {
          const { dataURL, width: imgWidth, height: imgHeight } = result;

          // A4 dimenzije u mm
          const margin = 10;

          // Odluči o orijentaciji stranice prema aspect ratio slike
          const imageAspectRatio = imgWidth / imgHeight;
          const isLandscapeImage = imageAspectRatio > 1;

          // Dodaj novu stranicu (osim za prvu)
          if (!isFirstPage) {
            pdf.addPage('a4', isLandscapeImage ? 'landscape' : 'portrait');
          } else {
            // Za prvu stranicu postavi orijentaciju
            const currentWidth = pdf.internal.pageSize.getWidth();
            const currentHeight = pdf.internal.pageSize.getHeight();
            const isCurrentPortrait = currentHeight > currentWidth;

            if (isLandscapeImage && isCurrentPortrait) {
              pdf.deletePage(1);
              pdf.addPage('a4', 'landscape');
            }
            isFirstPage = false;
          }

          // Dohvati trenutne dimenzije stranice (mijenjaju se s orijentacijom)
          const currentPageWidth = pdf.internal.pageSize.getWidth();
          const currentPageHeight = pdf.internal.pageSize.getHeight();
          const currentMaxWidth = currentPageWidth - 2 * margin;
          const currentMaxHeight = currentPageHeight - 2 * margin;

          // Izračunaj dimenzije slike da stane na stranicu
          let finalWidth = imgWidth;
          let finalHeight = imgHeight;

          // Scale down ako je potrebno
          const widthScale = currentMaxWidth / finalWidth;
          const heightScale = currentMaxHeight / finalHeight;
          const scale = Math.min(widthScale, heightScale, 1); // Ne povećavaj slike

          finalWidth = finalWidth * scale;
          finalHeight = finalHeight * scale;

          // Centriraj sliku na stranici
          const x = (currentPageWidth - finalWidth) / 2;
          const y = (currentPageHeight - finalHeight) / 2;

          // Dodaj sliku u PDF
          pdf.addImage(dataURL, 'JPEG', x, y, finalWidth, finalHeight);

          // Update progress
          processedImages++;
          if (onProgress) {
            onProgress(processedImages, totalFiles);
          }

          // Garbage collect every CHUNK_SIZE images
          if (processedImages % CHUNK_SIZE === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        } catch (error) {
          console.error('Greška pri dodavanju stranice u PDF:', error);
          throw error;
        }
        }
      }
    }
  }

  // Generiraj PDF blob
  return pdf.output('blob');
}

export function downloadPDF(blob: Blob, nazivUstanove: string, fromRb: number, toRb: number): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const sanitizedName = nazivUstanove
    .replace(/[^a-zA-Z0-9čćđšžČĆĐŠŽ\s]/g, '')
    .replace(/\s+/g, '_');

  link.href = url;
  link.download = `${date}_${sanitizedName}_items_${fromRb}-${toRb}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
