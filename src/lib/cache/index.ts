export interface Cache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
}
export class MemoryCache implements Cache {
  private entries = new Map<string, { value: unknown; expires: number }>();
  get<T>(key: string): T | undefined {
    const v = this.entries.get(key);
    if (!v) return;
    if (v.expires < Date.now()) {
      this.entries.delete(key);
      return;
    }
    return v.value as T;
  }
  set<T>(key: string, value: T, ttlMs: number) {
    if (this.entries.size >= 200)
      this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, { value, expires: Date.now() + ttlMs });
  }
}
export const cache = new MemoryCache();
