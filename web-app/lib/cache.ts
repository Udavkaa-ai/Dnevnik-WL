const store = new Map<string, { data: unknown; ts: number }>();
const TTL = 60_000;

export function getCache<T>(key: string): T | null {
  const e = store.get(key);
  if (e && Date.now() - e.ts < TTL) return e.data as T;
  return null;
}

export function setCache(key: string, data: unknown) {
  store.set(key, { data, ts: Date.now() });
}

export function bustCache(...keys: string[]) {
  if (keys.length === 0) { store.clear(); return; }
  for (const k of keys) store.delete(k);
}
