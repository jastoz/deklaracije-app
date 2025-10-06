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

function removeWhiteBackground(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) {
    return sourceCanvas;
  }

  const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const pixels = imageData.data;

  // VRLO agresivno uklanjanje bijelog - koristi se za slike koje imaju
  // tamne elemente (crni tekst, plavi potpis) na bijeloj pozadini
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // Izračunaj koliko je piksel blizu bijelom
    // Ako su SVE komponente svjetle (>= 180), vjerojatno je pozadina
    const isLightPixel = r >= 180 && g >= 180 && b >= 180;

    // Dodatno: provjeri da li je piksel vrlo neutralan (siva/bijela)
    // Tako da RGB vrijednosti nisu previše različite jedna od druge
    const colorDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));
    const isNeutral = colorDiff < 30; // Razlika između kanala manja od 30

    if (isLightPixel && isNeutral) {
      // Napravi piksel potpuno transparentnim
      pixels[i + 3] = 0;
    } else if (isLightPixel) {
      // Ako je svjetao ali nije neutralan (npr. svijetloplavi),
      // smanji alpha proporcionalno
      const lightness = (r + g + b) / 3;
      const alphaReduction = ((lightness - 180) / 75) * 255; // 180-255 range
      pixels[i + 3] = Math.max(0, pixels[i + 3] - alphaReduction);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return sourceCanvas;
}

export async function addStampToImage(file: File): Promise<File> {
  // Ako nije slika, vrati original (npr. PDF)
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const stampImg = new Image();

    // Učitaj obje slike paralelno
    let imageLoaded = false;
    let stampLoaded = false;

    const checkBothLoaded = () => {
      if (imageLoaded && stampLoaded) {
        processImages();
      }
    };

    img.onload = () => {
      imageLoaded = true;
      checkBothLoaded();
    };

    stampImg.onload = () => {
      // Učitaj pečat na privremeni canvas i ukloni bijelu pozadinu
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');

      if (tempCtx) {
        tempCanvas.width = stampImg.width;
        tempCanvas.height = stampImg.height;
        tempCtx.drawImage(stampImg, 0, 0);

        // Ukloni bijelu pozadinu
        removeWhiteBackground(tempCanvas);

        // Zamijeni originalni stampImg s obrađenom verzijom
        const processedStamp = new Image();
        processedStamp.onload = () => {
          stampImg.src = processedStamp.src;
          stampLoaded = true;
          checkBothLoaded();
        };
        processedStamp.onerror = () => {
          console.warn('Greška pri obradi pečata');
          stampLoaded = true;
          checkBothLoaded();
        };
        processedStamp.src = tempCanvas.toDataURL('image/png');
      } else {
        stampLoaded = true;
        checkBothLoaded();
      }
    };

    img.onerror = () => reject(new Error('Greška pri učitavanju originalne slike'));
    stampImg.onerror = () => {
      console.warn('Greška pri učitavanju pečata, nastavljam bez pečata');
      resolve(file); // Ako nema pečata, vrati original
    };

    const processImages = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Ne mogu kreirati canvas kontekst'));
          return;
        }

        // Postavi canvas dimenzije na originalne dimenzije slike
        canvas.width = img.width;
        canvas.height = img.height;

        // Nacrtaj originalnu sliku
        ctx.drawImage(img, 0, 0);

        // Adaptivno skaliranje pečata ovisno o veličini slike
        // Za visokokvalitetne slike (>1500px) koristimo veći postotak
        let stampScale: number;
        if (img.width <= 1500) {
          // Obične slike: 56%
          stampScale = 0.56;
        } else if (img.width <= 3000) {
          // Srednje visoke rezolucije: 70%
          stampScale = 0.70;
        } else {
          // Visokokvalitetne slike (>3000px): 80%
          stampScale = 0.80;
        }

        const stampWidth = img.width * stampScale;
        const stampHeight = (stampImg.height / stampImg.width) * stampWidth;

        // Padding od ruba (3% dimenzija slike)
        const padding = Math.max(img.width, img.height) * 0.03;

        // Pozicija: donji desni kut
        const stampX = img.width - stampWidth - padding;
        const stampY = img.height - stampHeight - padding;

        // Postavi blend mode i opacity za prirodan "otisnut" izgled
        ctx.globalAlpha = 0.9; // 90% opacity
        ctx.globalCompositeOperation = 'multiply'; // Multiply blend mode

        // Nacrtaj transparentni pečat s multiply blend mode-om
        // Ovo će pečat učiniti da izgleda kao da je stvarno otisnut na slici
        ctx.drawImage(stampImg, stampX, stampY, stampWidth, stampHeight);

        // Resetuj blend mode i opacity
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';

        // Konvertiraj canvas u blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Greška pri kreiranju slike s pečatom'));
              return;
            }

            // Kreiraj novi File objekt
            const stampedFile = new File([blob], file.name, { type: file.type });
            resolve(stampedFile);
          },
          file.type,
          0.95 // Visoka kvaliteta
        );
      } catch (error) {
        reject(error);
      }
    };

    // Učitaj originalnu sliku iz File objekta
    const reader = new FileReader();
    reader.onload = () => {
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Greška pri čitanju datoteke'));
    reader.readAsDataURL(file);

    // Učitaj pečat iz public foldera
    stampImg.src = '/stamp.png';
  });
}

export async function addWatermarkToImage(file: File, rb: number): Promise<File> {
  // Ako nije slika, vrati original (npr. PDF)
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Ne mogu kreirati canvas kontekst'));
          return;
        }

        // Postavi canvas dimenzije na originalne dimenzije slike
        canvas.width = img.width;
        canvas.height = img.height;

        // Nacrtaj originalnu sliku
        ctx.drawImage(img, 0, 0);

        // Pripremi tekst
        const watermarkText = `stavka ${rb}. troškovnika`;

        // Izračunaj font size ovisno o veličini slike (responsive)
        const fontSize = Math.max(20, Math.min(img.width / 20, 48));
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;

        // Izmjeri širinu teksta
        const textMetrics = ctx.measureText(watermarkText);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;

        // Definiraj padding
        const paddingX = fontSize * 0.8;
        const paddingY = fontSize * 0.5;

        // Pozicija: centrirano pri vrhu
        const rectX = (canvas.width - textWidth - paddingX * 2) / 2;
        const rectY = fontSize * 0.8;
        const rectWidth = textWidth + paddingX * 2;
        const rectHeight = textHeight + paddingY * 2;

        // Nacrtaj poluprozirnu pozadinu sa zaobljenim rubovima
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.beginPath();
        const radius = fontSize * 0.3;
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

        // Nacrtaj tekst
        const textX = canvas.width / 2;
        const textY = rectY + paddingY + fontSize * 0.75;

        // Dodaj sjenku za bolju čitljivost
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(watermarkText, textX, textY);

        // Konvertiraj canvas u blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Greška pri kreiranju slike s vodenim žigom'));
              return;
            }

            // Kreiraj novi File objekt
            const watermarkedFile = new File([blob], file.name, { type: file.type });
            resolve(watermarkedFile);
          },
          file.type,
          1.0 // Максимална kvaliteta za watermark
        );
      };

      img.onerror = () => reject(new Error('Greška pri učitavanju slike'));
      img.src = reader.result as string;
    };

    reader.onerror = () => reject(new Error('Greška pri čitanju datoteke'));
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