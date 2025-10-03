import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface DeklaracijeDB extends DBSchema {
  images: {
    key: string; // imageId
    value: {
      id: string;
      blob: Blob;
      originalFilename: string;
      finalFilename: string;
      rb: number;
      timestamp: number;
    };
    indexes: {
      'rb': number;
      'timestamp': number;
    };
  };
}

const DB_NAME = 'deklaracije-db';
const DB_VERSION = 3; // Increment version to clear old watermarked images

let dbInstance: IDBPDatabase<DeklaracijeDB> | null = null;

async function getDB(): Promise<IDBPDatabase<DeklaracijeDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<DeklaracijeDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create images store
      if (!db.objectStoreNames.contains('images')) {
        const imageStore = db.createObjectStore('images', { keyPath: 'id' });
        imageStore.createIndex('rb', 'rb', { unique: false });
        imageStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    },
  });

  return dbInstance;
}

export async function saveImageToIndexedDB(
  imageId: string,
  file: File,
  originalFilename: string,
  finalFilename: string,
  rb: number
): Promise<void> {
  const db = await getDB();

  await db.put('images', {
    id: imageId,
    blob: file,
    originalFilename,
    finalFilename,
    rb,
    timestamp: Date.now(),
  });
}

export async function getImageFromIndexedDB(imageId: string): Promise<File | null> {
  const db = await getDB();
  const record = await db.get('images', imageId);

  if (!record) return null;

  // Convert Blob back to File
  return new File([record.blob], record.originalFilename, { type: record.blob.type });
}

export async function getAllImagesFromIndexedDB(): Promise<Map<string, { file: File }>> {
  const db = await getDB();
  const allRecords = await db.getAll('images');

  const imageMap = new Map<string, { file: File }>();

  for (const record of allRecords) {
    const file = new File([record.blob], record.originalFilename, { type: record.blob.type });
    imageMap.set(record.id, { file });
  }

  return imageMap;
}

export async function deleteImageFromIndexedDB(imageId: string): Promise<void> {
  const db = await getDB();
  await db.delete('images', imageId);
}

export async function clearAllImagesFromIndexedDB(): Promise<void> {
  const db = await getDB();
  await db.clear('images');
}

export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  percentUsed: number;
}> {
  if (!navigator.storage || !navigator.storage.estimate) {
    return { usage: 0, quota: 0, percentUsed: 0 };
  }

  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage || 0;
  const quota = estimate.quota || 0;
  const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;

  return { usage, quota, percentUsed };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persist) {
    return false;
  }

  return await navigator.storage.persist();
}

export async function checkIfPersisted(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persisted) {
    return false;
  }

  return await navigator.storage.persisted();
}
