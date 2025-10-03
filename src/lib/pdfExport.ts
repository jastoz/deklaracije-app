import { jsPDF } from 'jspdf';
import { TroskovnikItem } from './types';

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

interface ProcessedImageResult {
  dataURL: string;
  width: number;
  height: number;
}

// OPTIMIZED: Kombinira watermark + stamp + resize u JEDAN canvas prolaz
async function processImageForPDF(
  file: File,
  rb: number,
  includeWatermark: boolean,
  stampImage: HTMLImageElement | null,
  maxDimension: number,
  quality: number
): Promise<ProcessedImageResult> {
  return new Promise((resolve, reject) => {
    // Provjeri da li je file valjan
    if (!file || !(file instanceof File)) {
      reject(new Error(`Nevažeća datoteka za stavku ${rb}`));
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

        // STEP 3: Add watermark text + stamp if enabled
        if (includeWatermark) {
          // Add watermark text - gornji lijevi kut, decentno
          const watermarkText = `stavka ${rb}. troškovnika`;
          const fontSize = Math.max(14, Math.min(width / 30, 24));
          ctx.font = `${fontSize}px Arial, sans-serif`;

          const textMetrics = ctx.measureText(watermarkText);
          const textWidth = textMetrics.width;
          const textHeight = fontSize;
          const paddingX = fontSize * 0.6;
          const paddingY = fontSize * 0.4;

          const margin = width * 0.01; // Fiksni margin ovisno samo o širini - konzistentna pozicija
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
            // FIKSNA veličina pečata - UVIJEK ista
            const stampAspectRatio = stampImage.width / stampImage.height;
            const fixedStampWidth = 500; // Fiksna veličina u pikselima (smanjena sa 800)
            let stampWidth = fixedStampWidth;
            let stampHeight = fixedStampWidth / stampAspectRatio;

            // Ekstremna sigurnosna provjera - SAMO za jako male slike
            // Dopusti da pečat zauzme do 95% visine i 80% širine
            const maxWidth = width * 0.8;
            const maxHeight = height * 0.95;

            // SAMO ako ne stane uopće, tek onda smanji
            if (stampWidth > maxWidth || stampHeight > maxHeight) {
              const scaleByWidth = maxWidth / stampWidth;
              const scaleByHeight = maxHeight / stampHeight;
              const scale = Math.min(scaleByWidth, scaleByHeight);

              stampWidth = fixedStampWidth * scale;
              stampHeight = stampWidth / stampAspectRatio;
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

        // STEP 4: Convert to DataURL (single conversion)
        const dataURL = canvas.toDataURL('image/jpeg', quality);

        resolve({
          dataURL,
          width,
          height,
        });
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

  // Filtriraj stavke prema range-u
  const filteredItems = items.filter(item => item.rb >= fromRb && item.rb <= toRb);

  // Izbroji ukupan broj slika
  const totalImages = filteredItems.reduce((sum, item) => sum + item.images.length, 0);

  if (totalImages === 0) {
    throw new Error('Nema slika u odabranom rasponu');
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

  // OPTIMIZATION: Batch processing - process 3 images in parallel
  const BATCH_SIZE = 3;
  const CHUNK_SIZE = 10;

  for (const item of filteredItems) {
    // Process images in batches of BATCH_SIZE
    for (let i = 0; i < item.images.length; i += BATCH_SIZE) {
      const batch = item.images.slice(i, i + BATCH_SIZE);

      // Process batch in parallel
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
            console.error(`Greška pri obradi slike ${image.originalFilename}:`, error);
            throw new Error(`Greška pri obradi slike ${image.originalFilename}`);
          })
        )
      );

      // Add processed images to PDF
      for (const result of processedBatch) {
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
            onProgress(processedImages, totalImages);
          }

          // Garbage collect every CHUNK_SIZE images
          if (processedImages % CHUNK_SIZE === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        } catch (error) {
          console.error('Greška pri dodavanju slike u PDF:', error);
          throw error;
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
