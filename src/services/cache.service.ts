type CacheItem<T> = {
  data: T;
  expiresAt: number;
};

export class CacheService {
  private static store = new Map<string, CacheItem<any>>();

  /**
   * Retrieves data from the cache, or executes the callback, stores the result for the specified duration, and returns it.
   * 
   * @param key Unique cache key
   * @param ttlSeconds Time-to-live in seconds
   * @param callback Async function to retrieve fresh data if cache missed or expired
   */
  public static async remember<T>(
    key: string,
    ttlSeconds: number,
    callback: () => Promise<T>
  ): Promise<T> {
    const now = Date.now();
    const cached = this.store.get(key);

    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const freshData = await callback();
    this.store.set(key, {
      data: freshData,
      expiresAt: now + ttlSeconds * 1000,
    });

    return freshData;
  }

  /**
   * Manually clears a key from the cache.
   */
  public static forget(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clears the entire cache.
   */
  public static clear(): void {
    this.store.clear();
  }
}
