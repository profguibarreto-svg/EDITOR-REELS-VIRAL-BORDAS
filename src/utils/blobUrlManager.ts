export interface BlobUrlManagerOptions {
  maxIdleUrls?: number;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
}

interface CacheEntry {
  key: string;
  url: string;
  lastUsedAt: number;
}

/**
 * Manages Object URLs (`blob:...`) with reuse by cache key and bounded LRU eviction
 * so large video batches avoid repeatedly recreating URLs or leaking RAM.
 */
export class BlobUrlManager {
  private readonly maxIdleUrls: number;
  private readonly createUrlFn: (blob: Blob) => string;
  private readonly revokeUrlFn: (url: string) => void;
  private readonly entries = new Map<string, CacheEntry>();
  private tick = 0;

  constructor(options: BlobUrlManagerOptions = {}) {
    this.maxIdleUrls = Math.max(0, options.maxIdleUrls ?? 3);
    this.createUrlFn =
      options.createObjectURL ??
      ((blob: Blob) => URL.createObjectURL(blob));
    this.revokeUrlFn =
      options.revokeObjectURL ??
      ((url: string) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore revoke failures
        }
      });
  }

  private nextTick(): number {
    this.tick += 1;
    return this.tick;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  hasUrl(url: string): boolean {
    for (const entry of this.entries.values()) {
      if (entry.url === url) return true;
    }
    return false;
  }

  get(key: string): string | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    entry.lastUsedAt = this.nextTick();
    return entry.url;
  }

  /**
   * Returns an existing Object URL for `key` if already cached, or creates one from `blob`.
   */
  acquire(key: string, blob: Blob): string {
    const existing = this.entries.get(key);
    if (existing) {
      existing.lastUsedAt = this.nextTick();
      return existing.url;
    }
    const url = this.createUrlFn(blob);
    this.entries.set(key, {
      key,
      url,
      lastUsedAt: this.nextTick(),
    });
    return url;
  }

  /**
   * Registers an already-created `blob:` URL under `key` (e.g. from demo generator),
   * replacing and revoking any prior URL stored under the same key if different.
   */
  register(key: string, url: string): string {
    if (!url) return '';
    const existing = this.entries.get(key);
    if (existing) {
      if (existing.url === url) {
        existing.lastUsedAt = this.nextTick();
        return url;
      }
      this.revokeUrlFn(existing.url);
    }
    this.entries.set(key, {
      key,
      url,
      lastUsedAt: this.nextTick(),
    });
    return url;
  }

  markUsed(key: string): void {
    const existing = this.entries.get(key);
    if (existing) {
      existing.lastUsedAt = this.nextTick();
    }
  }

  release(key: string): boolean {
    const existing = this.entries.get(key);
    if (!existing) return false;
    this.revokeUrlFn(existing.url);
    this.entries.delete(key);
    return true;
  }

  /**
   * Keeps all keys in `pinnedKeys` plus up to `maxIdleUrls` most-recently-used
   * unpinned entries; evicts and revokes older idle entries to bound RAM.
   * Returns the list of evicted `{ key, url }` pairs.
   */
  evictUnpinned(
    pinnedKeys: Iterable<string>
  ): Array<{ key: string; url: string }> {
    const pinned = new Set(pinnedKeys);
    const unpinned: CacheEntry[] = [];

    for (const entry of this.entries.values()) {
      if (pinned.has(entry.key)) {
        entry.lastUsedAt = this.nextTick();
      } else {
        unpinned.push(entry);
      }
    }

    if (unpinned.length <= this.maxIdleUrls) {
      return [];
    }

    // Oldest first
    unpinned.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
    const toEvictCount = unpinned.length - this.maxIdleUrls;
    const evicted: Array<{ key: string; url: string }> = [];

    for (let i = 0; i < toEvictCount; i++) {
      const target = unpinned[i];
      this.revokeUrlFn(target.url);
      this.entries.delete(target.key);
      evicted.push({ key: target.key, url: target.url });
    }

    return evicted;
  }

  clearAll(): void {
    for (const entry of this.entries.values()) {
      this.revokeUrlFn(entry.url);
    }
    this.entries.clear();
  }

  size(): number {
    return this.entries.size;
  }

  keys(): string[] {
    return Array.from(this.entries.keys());
  }
}

export function makeOriginalUrlKey(videoId: string): string {
  return `orig:${videoId}`;
}

export function makeOutputUrlKey(videoId: string): string {
  return `out:${videoId}`;
}

export const videoBlobUrlManager = new BlobUrlManager({ maxIdleUrls: 3 });
