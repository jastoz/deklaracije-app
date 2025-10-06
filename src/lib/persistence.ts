import { TroskovnikItem, UploadedImage } from './types';
import {
  saveImageToIndexedDB,
  getAllImagesFromIndexedDB,
  clearAllImagesFromIndexedDB,
} from './storage';

const STORAGE_KEY = 'deklaracije-app-state';

interface SerializedState {
  nazivUstanove: string;
  troskovnikItems: Array<{
    rb: number;
    nazivArtikla: string;
    brand: string;
    status: 'incomplete' | 'complete';
    images: Array<{
      id: string;
      originalFilename: string;
      finalFilename: string;
    }>;
  }>;
  timestamp: number;
}

export async function saveStateToStorage(
  nazivUstanove: string,
  troskovnikItems: TroskovnikItem[]
): Promise<void> {
  try {
    console.log(`[saveStateToStorage] Spremam ${troskovnikItems.length} items u storage`);

    // Save metadata to localStorage
    const serializedState: SerializedState = {
      nazivUstanove,
      troskovnikItems: troskovnikItems.map(item => ({
        rb: item.rb,
        nazivArtikla: item.nazivArtikla,
        brand: item.brand,
        status: item.status,
        images: item.images.map(img => ({
          id: img.id,
          originalFilename: img.originalFilename,
          finalFilename: img.finalFilename,
        })),
      })),
      timestamp: Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedState));
    console.log(`[saveStateToStorage] ✅ LocalStorage spremljen`);

    // Save images to IndexedDB
    console.log(`[saveStateToStorage] Spremam slike u IndexedDB...`);
    for (const item of troskovnikItems) {
      for (const image of item.images) {
        await saveImageToIndexedDB(
          image.id,
          image.file,
          image.originalFilename,
          image.finalFilename,
          item.rb
        );
      }
    }
  } catch (error) {
    console.error('Error saving state:', error);
    throw new Error('Greška pri spremanju podataka');
  }
}

export async function loadStateFromStorage(): Promise<{
  nazivUstanove: string;
  troskovnikItems: TroskovnikItem[];
} | null> {
  try {
    // Load metadata from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const serializedState: SerializedState = JSON.parse(stored);

    // Load images from IndexedDB
    const imageMap = await getAllImagesFromIndexedDB();

    // Reconstruct state with File objects
    const troskovnikItems: TroskovnikItem[] = serializedState.troskovnikItems.map(item => ({
      rb: item.rb,
      nazivArtikla: item.nazivArtikla,
      brand: item.brand,
      status: item.status,
      images: item.images
        .map(img => {
          const imageData = imageMap.get(img.id);
          if (!imageData) return null;

          const uploadedImage: UploadedImage = {
            id: img.id,
            file: imageData.file,
            originalFilename: img.originalFilename,
            finalFilename: img.finalFilename,
            isEditing: false,
          };
          return uploadedImage;
        })
        .filter((img): img is UploadedImage => img !== null),
    }));

    return {
      nazivUstanove: serializedState.nazivUstanove,
      troskovnikItems,
    };
  } catch (error) {
    console.error('Error loading state:', error);
    return null;
  }
}

export async function clearAllStorage(): Promise<void> {
  try {
    console.log('[clearAllStorage] Brisanje LocalStorage...');
    localStorage.removeItem(STORAGE_KEY);

    console.log('[clearAllStorage] Brisanje IndexedDB...');
    await clearAllImagesFromIndexedDB();

    console.log('[clearAllStorage] ✅ Svi podaci uspješno obrisani');

    // Dodatna provjera da je storage stvarno prazan
    const remainingInLocalStorage = localStorage.getItem(STORAGE_KEY);
    if (remainingInLocalStorage) {
      console.error('[clearAllStorage] ⚠️ LocalStorage nije prazan!', remainingInLocalStorage);
    }
  } catch (error) {
    console.error('[clearAllStorage] ❌ Error clearing storage:', error);
    throw new Error('Greška pri brisanju podataka');
  }
}

export function hasStoredData(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export function getStoredTimestamp(): number | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const serializedState: SerializedState = JSON.parse(stored);
    return serializedState.timestamp;
  } catch {
    return null;
  }
}

// Debounce helper for auto-save with cancel capability
export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}
