/**
 * Analysis Cache Service for Code Canvas
 * Provides persistent caching of static analysis results using IndexedDB
 * 
 * Requirements: 7.1, 7.2
 * - Cache analysis results per commit and code segment
 * - Return cached results when code segment has not changed
 */

import { AnalysisResult, AnalysisCacheEntry } from '../types/analysis';

const DB_NAME = 'CodeCanvasAnalysisCache';
const DB_VERSION = 1;
const STORE_NAME = 'analysisResults';

let dbInstance: IDBDatabase | null = null;

/**
 * Generate a cache key using the format: ${commitHash}:${segmentId}:${contentHash}
 */
export function generateCacheKey(
  commitHash: string | undefined,
  segmentId: string,
  contentHash: string
): string {
  const commit = commitHash || 'local';
  return `${commit}:${segmentId}:${contentHash}`;
}

/**
 * Generate a content hash for cache key generation
 */
export function generateContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Initialize the IndexedDB database
 */
async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        // Create index for segmentId to enable efficient invalidation
        store.createIndex('segmentId', 'result.segmentId', { unique: false });
        // Create index for timestamp for potential cleanup
        store.createIndex('timestamp', 'result.timestamp', { unique: false });
      }
    };
  });
}


/**
 * Check cache for existing analysis result
 * Returns the cached result if found and valid, null otherwise
 */
export async function checkCache(
  segmentId: string,
  contentHash: string,
  commitHash?: string
): Promise<AnalysisResult | null> {
  try {
    const db = await initDB();
    const cacheKey = generateCacheKey(commitHash, segmentId, contentHash);

    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(cacheKey);

      request.onsuccess = () => {
        const entry = request.result as AnalysisCacheEntry | undefined;
        if (entry && entry.contentHash === contentHash) {
          resolve(entry.result);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.warn('Cache check failed:', request.error);
        resolve(null);
      };
    });
  } catch (error) {
    console.warn('Failed to check cache:', error);
    return null;
  }
}

/**
 * Store analysis result in cache
 */
export async function storeResult(
  segmentId: string,
  contentHash: string,
  result: AnalysisResult,
  commitHash?: string
): Promise<void> {
  try {
    const db = await initDB();
    const cacheKey = generateCacheKey(commitHash, segmentId, contentHash);

    const entry: AnalysisCacheEntry = {
      key: cacheKey,
      result,
      contentHash,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.warn('Failed to store cache entry:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn('Failed to store result in cache:', error);
  }
}

/**
 * Invalidate cache entries
 * If segmentId is provided, only invalidate entries for that segment
 * If no segmentId is provided, clear all cache entries
 */
export async function invalidateCache(segmentId?: string): Promise<void> {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      if (!segmentId) {
        // Clear all entries
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } else {
        // Delete entries matching the segmentId using index
        const index = store.index('segmentId');
        const request = index.openCursor(IDBKeyRange.only(segmentId));

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = () => {
          console.warn('Failed to invalidate cache:', request.error);
          reject(request.error);
        };
      }
    });
  } catch (error) {
    console.warn('Failed to invalidate cache:', error);
  }
}

/**
 * Get cache statistics for debugging/monitoring
 */
export async function getCacheStats(): Promise<{ count: number; oldestTimestamp: number | null }> {
  try {
    const db = await initDB();

    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      const countRequest = store.count();
      let count = 0;
      let oldestTimestamp: number | null = null;

      countRequest.onsuccess = () => {
        count = countRequest.result;
      };

      const index = store.index('timestamp');
      const cursorRequest = index.openCursor();

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const entry = cursor.value as AnalysisCacheEntry;
          if (oldestTimestamp === null || entry.result.timestamp < oldestTimestamp) {
            oldestTimestamp = entry.result.timestamp;
          }
        }
      };

      transaction.oncomplete = () => {
        resolve({ count, oldestTimestamp });
      };

      transaction.onerror = () => {
        resolve({ count: 0, oldestTimestamp: null });
      };
    });
  } catch (error) {
    console.warn('Failed to get cache stats:', error);
    return { count: 0, oldestTimestamp: null };
  }
}

/**
 * Clean up old cache entries (older than maxAge in milliseconds)
 * Default: 7 days
 */
export async function cleanupOldEntries(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  try {
    const db = await initDB();
    const cutoffTime = Date.now() - maxAge;
    let deletedCount = 0;

    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoffTime);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        resolve(deletedCount);
      };

      transaction.onerror = () => {
        resolve(deletedCount);
      };
    });
  } catch (error) {
    console.warn('Failed to cleanup old cache entries:', error);
    return 0;
  }
}
