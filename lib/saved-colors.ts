const STORAGE_KEY = "agentcut-saved-colors";
const STORAGE_EVENT = "agentcut-saved-colors-changed";
const MAX_COLORS = 18;

function normalizeColor(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(trimmed) ? trimmed : null;
}

function isSavedColor(value: unknown): value is string {
  return typeof value === "string" && normalizeColor(value) !== null;
}

function emitSavedColorsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function persist(colors: string[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // Ignore quota or privacy-mode failures. Presets just become session-only.
  }
}

export function loadSavedColors(): string[] {
  if (typeof localStorage === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const entry of parsed) {
      if (!isSavedColor(entry)) continue;
      const value = normalizeColor(entry);
      if (!value || seen.has(value)) continue;
      seen.add(value);
      normalized.push(value);
      if (normalized.length >= MAX_COLORS) break;
    }

    return normalized;
  } catch {
    return [];
  }
}

export function saveSavedColor(value: string): string[] {
  const normalized = normalizeColor(value);
  if (!normalized) {
    return loadSavedColors();
  }

  const next = [
    normalized,
    ...loadSavedColors().filter((savedColor) => savedColor !== normalized),
  ].slice(0, MAX_COLORS);

  persist(next);
  emitSavedColorsChanged();
  return next;
}

export function removeSavedColor(value: string): string[] {
  const normalized = normalizeColor(value);
  if (!normalized) {
    return loadSavedColors();
  }

  const next = loadSavedColors().filter(
    (savedColor) => savedColor !== normalized,
  );
  persist(next);
  emitSavedColorsChanged();
  return next;
}

export function subscribeSavedColors(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => listener();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(STORAGE_EVENT, handleChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(STORAGE_EVENT, handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}
