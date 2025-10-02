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

    // Save images to IndexedDB
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
          const file = imageMap.get(img.id);
          if (!file) return null;

          const uploadedImage: UploadedImage = {
            id: img.id,
            file,
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
    localStorage.removeItem(STORAGE_KEY);
    await clearAllImagesFromIndexedDB();
  } catch (error) {
    console.error('Error clearing storage:', error);
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

// Debounce helper for auto-save
export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
