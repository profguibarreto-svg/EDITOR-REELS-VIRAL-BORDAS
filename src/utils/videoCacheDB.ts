import { VideoProjectSettings, VideoQueueItem } from '../types/video';
import { DEFAULT_PROJECT_SETTINGS, cloneVideoSettings } from './projectSettings';

export const VIDEO_CACHE_DB_NAME = 'wifive_pro_studio_cache_v1';
export const VIDEO_CACHE_DB_VERSION = 1;
export const STORE_QUEUE_ITEMS = 'queue_items';
export const STORE_VIDEO_BLOBS = 'video_blobs';

export type VideoBlobKind = 'original' | 'output';

export interface PersistedVideoBlobRecord {
  key: string;
  videoId: string;
  kind: VideoBlobKind;
  blob: Blob;
  mimeType: string;
  extension?: 'mp4' | 'webm';
  size: number;
  updatedAt: number;
}

export interface PersistedQueueRecord {
  id: string;
  order: number;
  name: string;
  mimeType: string;
  fileSize: number;
  duration: number;
  width: number;
  height: number;
  thumbnailUrl: string;
  trim: {
    startTime: number;
    endTime: number;
  };
  settings: VideoProjectSettings;
  customHeadline?: string;
  status: 'idle' | 'processing' | 'done' | 'error';
  progress: number;
  statusText?: string;
  outputMimeType?: string;
  outputExtension?: 'mp4' | 'webm';
  outputSizeMb?: number;
  errorMessage: string | null;
  hasOriginalBlob: boolean;
  hasOutputBlob: boolean;
  updatedAt: number;
}

export interface VideoCacheStats {
  itemCount: number;
  blobCount: number;
  totalBytes: number;
}

export function makeBlobKey(videoId: string, kind: VideoBlobKind): string {
  return `${kind === 'original' ? 'orig' : 'out'}:${videoId}`;
}

export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

export function serializeQueueItem(
  item: VideoQueueItem,
  order: number
): PersistedQueueRecord {
  const hasOriginalBlob = Boolean(item.originalCached || item.file);
  const hasOutputBlob = Boolean(
    item.outputCached || (item.outputBlob && item.outputBlob.size > 0)
  );
  const safeStatus: PersistedQueueRecord['status'] =
    item.status === 'processing' ? 'idle' : item.status;

  return {
    id: item.id,
    order,
    name: item.name,
    mimeType: item.file?.type || item.outputMimeType || 'video/mp4',
    fileSize: item.file?.size ?? item.fileSize ?? 0,
    duration: item.duration,
    width: item.width,
    height: item.height,
    thumbnailUrl: item.thumbnailUrl || '',
    trim: {
      startTime: item.trim.startTime,
      endTime: item.trim.endTime,
    },
    settings: cloneVideoSettings(item.settings || DEFAULT_PROJECT_SETTINGS),
    customHeadline: item.customHeadline,
    status: safeStatus,
    progress: safeStatus === 'done' ? 100 : 0,
    statusText: item.status === 'processing' ? undefined : item.statusText,
    outputMimeType: item.outputMimeType,
    outputExtension: item.outputExtension,
    outputSizeMb: item.outputSizeMb,
    errorMessage: item.errorMessage,
    hasOriginalBlob,
    hasOutputBlob,
    updatedAt: Date.now(),
  };
}

export function deserializeQueueRecord(
  record: PersistedQueueRecord,
  options?: {
    hasOriginalInDb?: boolean;
    hasOutputInDb?: boolean;
  }
): VideoQueueItem {
  const originalExists = options?.hasOriginalInDb ?? record.hasOriginalBlob;
  const outputExists = options?.hasOutputInDb ?? record.hasOutputBlob;

  let restoredStatus = record.status === 'processing' ? 'idle' : record.status;
  if (restoredStatus === 'done' && !outputExists) {
    restoredStatus = 'idle';
  }

  return {
    id: record.id,
    file: null,
    fileSize: record.fileSize,
    url: '',
    name: record.name,
    duration: record.duration,
    width: record.width,
    height: record.height,
    thumbnailUrl: record.thumbnailUrl || '',
    trim: {
      startTime: record.trim?.startTime ?? 0,
      endTime: record.trim?.endTime ?? record.duration ?? 0,
    },
    settings: cloneVideoSettings(record.settings || DEFAULT_PROJECT_SETTINGS),
    customHeadline: record.customHeadline,
    status: restoredStatus,
    progress: restoredStatus === 'done' ? 100 : 0,
    statusText: restoredStatus === 'done' ? record.statusText : undefined,
    outputBlob: null,
    outputUrl: null,
    outputMimeType: record.outputMimeType,
    outputExtension: record.outputExtension,
    outputSizeMb: record.outputSizeMb,
    errorMessage: record.errorMessage ?? null,
    originalCached: originalExists,
    outputCached: outputExists && restoredStatus === 'done',
  };
}

export function computeCacheStatsFromBlobs(
  blobs: Array<{ size?: number }>
): { blobCount: number; totalBytes: number } {
  let totalBytes = 0;
  for (const b of blobs) {
    if (typeof b.size === 'number' && Number.isFinite(b.size) && b.size > 0) {
      totalBytes += b.size;
    }
  }
  return {
    blobCount: blobs.length,
    totalBytes,
  };
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openVideoCacheDB(): Promise<IDBDatabase | null> {
  if (!isIndexedDBAvailable()) {
    return Promise.resolve(null);
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(VIDEO_CACHE_DB_NAME, VIDEO_CACHE_DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_QUEUE_ITEMS)) {
          db.createObjectStore(STORE_QUEUE_ITEMS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_VIDEO_BLOBS)) {
          const blobStore = db.createObjectStore(STORE_VIDEO_BLOBS, {
            keyPath: 'key',
          });
          blobStore.createIndex('by_videoId', 'videoId', { unique: false });
        }
      };

      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          try {
            db.close();
          } catch {}
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };

      req.onerror = () => {
        dbPromise = null;
        resolve(null);
      };

      req.onblocked = () => {
        dbPromise = null;
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

export async function saveVideoBlob(
  videoId: string,
  kind: VideoBlobKind,
  blob: Blob,
  extension?: 'mp4' | 'webm'
): Promise<boolean> {
  if (!blob || blob.size === 0) return false;
  const db = await openVideoCacheDB();
  if (!db) return false;

  const record: PersistedVideoBlobRecord = {
    key: makeBlobKey(videoId, kind),
    videoId,
    kind,
    blob,
    mimeType: blob.type || (extension === 'webm' ? 'video/webm' : 'video/mp4'),
    extension,
    size: blob.size,
    updatedAt: Date.now(),
  };

  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE_VIDEO_BLOBS, 'readwrite');
      const store = tx.objectStore(STORE_VIDEO_BLOBS);
      store.put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function saveOriginalVideoBlob(
  videoId: string,
  blob: Blob
): Promise<boolean> {
  return saveVideoBlob(videoId, 'original', blob);
}

export async function saveOutputVideoBlob(
  videoId: string,
  blob: Blob,
  extension: 'mp4' | 'webm' = 'mp4'
): Promise<boolean> {
  return saveVideoBlob(videoId, 'output', blob, extension);
}

export async function getVideoBlob(
  videoId: string,
  kind: VideoBlobKind
): Promise<Blob | null> {
  const db = await openVideoCacheDB();
  if (!db) return null;

  const key = makeBlobKey(videoId, kind);
  return new Promise<Blob | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_VIDEO_BLOBS, 'readonly');
      const store = tx.objectStore(STORE_VIDEO_BLOBS);
      const req = store.get(key);
      req.onsuccess = () => {
        const res = req.result as PersistedVideoBlobRecord | undefined;
        resolve(res?.blob instanceof Blob ? res.blob : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function hasVideoBlob(
  videoId: string,
  kind: VideoBlobKind
): Promise<boolean> {
  const db = await openVideoCacheDB();
  if (!db) return false;

  const key = makeBlobKey(videoId, kind);
  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE_VIDEO_BLOBS, 'readonly');
      const store = tx.objectStore(STORE_VIDEO_BLOBS);
      const req = store.getKey(key);
      req.onsuccess = () => resolve(req.result !== undefined);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function syncQueueRecordsToDB(
  items: VideoQueueItem[]
): Promise<boolean> {
  const db = await openVideoCacheDB();
  if (!db) return false;

  const serialized = items.map((item, idx) => serializeQueueItem(item, idx));
  const keepIds = new Set(serialized.map((r) => r.id));

  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE_QUEUE_ITEMS, 'readwrite');
      const store = tx.objectStore(STORE_QUEUE_ITEMS);
      const keysReq = store.getAllKeys();
      keysReq.onsuccess = () => {
        const existingKeys = (keysReq.result || []) as string[];
        for (const existingKey of existingKeys) {
          if (!keepIds.has(existingKey)) {
            store.delete(existingKey);
          }
        }
        for (const rec of serialized) {
          store.put(rec);
        }
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function loadAllQueueItemsFromDB(): Promise<VideoQueueItem[]> {
  const db = await openVideoCacheDB();
  if (!db) return [];

  return new Promise<VideoQueueItem[]>((resolve) => {
    try {
      const tx = db.transaction(
        [STORE_QUEUE_ITEMS, STORE_VIDEO_BLOBS],
        'readonly'
      );
      const queueStore = tx.objectStore(STORE_QUEUE_ITEMS);
      const blobStore = tx.objectStore(STORE_VIDEO_BLOBS);

      const recordsReq = queueStore.getAll();
      const blobKeysReq = blobStore.getAllKeys();

      tx.oncomplete = () => {
        const records = ((recordsReq.result || []) as PersistedQueueRecord[]).sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0)
        );
        const blobKeys = new Set((blobKeysReq.result || []) as string[]);

        const hydrated: VideoQueueItem[] = [];
        for (const rec of records) {
          const hasOrig = blobKeys.has(makeBlobKey(rec.id, 'original'));
          const hasOut = blobKeys.has(makeBlobKey(rec.id, 'output'));
          if (!hasOrig && !hasOut) continue;
          hydrated.push(
            deserializeQueueRecord(rec, {
              hasOriginalInDb: hasOrig,
              hasOutputInDb: hasOut,
            })
          );
        }
        resolve(hydrated);
      };

      tx.onerror = () => resolve([]);
      tx.onabort = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function deleteVideoCacheEntry(videoId: string): Promise<void> {
  const db = await openVideoCacheDB();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(
        [STORE_QUEUE_ITEMS, STORE_VIDEO_BLOBS],
        'readwrite'
      );
      tx.objectStore(STORE_QUEUE_ITEMS).delete(videoId);
      const blobStore = tx.objectStore(STORE_VIDEO_BLOBS);
      blobStore.delete(makeBlobKey(videoId, 'original'));
      blobStore.delete(makeBlobKey(videoId, 'output'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function deleteOutputBlobFromCache(videoId: string): Promise<void> {
  const db = await openVideoCacheDB();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_VIDEO_BLOBS, 'readwrite');
      tx.objectStore(STORE_VIDEO_BLOBS).delete(makeBlobKey(videoId, 'output'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearAllVideoCache(): Promise<void> {
  const db = await openVideoCacheDB();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(
        [STORE_QUEUE_ITEMS, STORE_VIDEO_BLOBS],
        'readwrite'
      );
      tx.objectStore(STORE_QUEUE_ITEMS).clear();
      tx.objectStore(STORE_VIDEO_BLOBS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getVideoCacheStats(): Promise<VideoCacheStats> {
  const db = await openVideoCacheDB();
  if (!db) return { itemCount: 0, blobCount: 0, totalBytes: 0 };

  return new Promise<VideoCacheStats>((resolve) => {
    try {
      const tx = db.transaction(
        [STORE_QUEUE_ITEMS, STORE_VIDEO_BLOBS],
        'readonly'
      );
      const itemsCountReq = tx.objectStore(STORE_QUEUE_ITEMS).count();
      const blobsReq = tx.objectStore(STORE_VIDEO_BLOBS).openCursor();

      let blobCount = 0;
      let totalBytes = 0;

      blobsReq.onsuccess = () => {
        const cursor = blobsReq.result;
        if (cursor) {
          const val = cursor.value as PersistedVideoBlobRecord;
          blobCount += 1;
          if (typeof val?.size === 'number' && Number.isFinite(val.size)) {
            totalBytes += val.size;
          }
          cursor.continue();
        }
      };

      tx.oncomplete = () => {
        resolve({
          itemCount: itemsCountReq.result || 0,
          blobCount,
          totalBytes,
        });
      };
      tx.onerror = () => resolve({ itemCount: 0, blobCount: 0, totalBytes: 0 });
      tx.onabort = () => resolve({ itemCount: 0, blobCount: 0, totalBytes: 0 });
    } catch {
      resolve({ itemCount: 0, blobCount: 0, totalBytes: 0 });
    }
  });
}

export function formatBytesCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}
