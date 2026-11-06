// Kern van de opslag op dit toestel (localStorage), los van React zodat hij te testen is. `store.ts` maakt er hooks van.
//
// Lukt schrijven niet (privévenster, volle of geblokkeerde opslag), dan blijft de waarde in het geheugen staan: "Bewaar"
// werkt dan nog tijdens dit bezoek, en de bezoeker krijgt één keer een melding (zie `onStorageFailure`).

type Listener = () => void;

let failed = false;
const failureListeners = new Set<Listener>();

/** true zodra schrijven naar de opslag op dit toestel een keer is mislukt (blijft zo tot herladen) */
export const storageFailed = () => failed;

/** Abonneren op "opslaan lukt niet"; geeft een afmeldfunctie terug */
export function onStorageFailure(l: Listener): () => void {
  failureListeners.add(l);
  return () => failureListeners.delete(l);
}

function markFailed() {
  if (failed) return;
  failed = true;
  failureListeners.forEach((l) => l());
}

/** Alleen voor tests */
export function resetStorageFailure() {
  failed = false;
}

export type StoreOptions<T> = {
  /** Wat er in de opslag staat omzetten naar de waarde; undefined = ongeldig, dan de standaardwaarde */
  decode: (stored: unknown) => T | undefined;
  /** Wat er in de opslag komt (standaard de waarde zelf) */
  encode?: (value: T) => unknown;
};

export type LocalStore<T> = {
  read: () => T;
  write: (next: T) => void;
  subscribe: (l: Listener) => () => void;
};

const storage = (): Storage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export function createLocalStore<T>(key: string, fallback: T, { decode, encode = (v) => v }: StoreOptions<T>): LocalStore<T> {
  const listeners = new Set<Listener>();
  let cache: { raw: string | null; value: T } = { raw: null, value: fallback };
  // Waarde die niet in de opslag paste: gaat voor wat er (nog) in de opslag staat
  let memory: { raw: string; value: T } | null = null;

  const parse = (raw: string | null): T => {
    if (raw === null) return fallback;
    try {
      return decode(JSON.parse(raw)) ?? fallback;
    } catch {
      return fallback; // kapotte opslag: begin opnieuw
    }
  };

  const read = (): T => {
    if (memory) return memory.value;
    let raw: string | null = null;
    try {
      raw = storage()?.getItem(key) ?? null;
    } catch {
      return fallback;
    }
    if (raw === cache.raw) return cache.value;
    cache = { raw, value: parse(raw) };
    return cache.value;
  };

  const write = (next: T) => {
    const raw = JSON.stringify(encode(next));
    try {
      const s = storage();
      if (!s) throw new Error("geen opslag");
      s.setItem(key, raw);
      memory = null;
    } catch {
      memory = { raw, value: next };
      markFailed();
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (l: Listener) => {
    listeners.add(l);
    // Een ander tabblad wijzigde deze sleutel, of wiste alles (localStorage.clear(): key is dan null)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key && e.key !== null) return;
      // Een geslaagde wijziging elders gaat voor wat hier alleen in het geheugen stond
      if (memory && e.key === key) memory = null;
      l();
    };
    const w = typeof window === "undefined" ? undefined : window;
    w?.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      w?.removeEventListener("storage", onStorage);
    };
  };

  return { read, write, subscribe };
}
