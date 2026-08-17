const STORAGE_KEY = "onestud:measurements";

export interface FingerMeasurementMm {
  name: string;
  widthMm: number;
  confident: boolean;
}

export function saveMeasurements(results: FingerMeasurementMm[]) {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ results, savedAt: Date.now() })
    );
  } catch {
    // sessionStorage unavailable (private browsing, etc.) — recommendations
    // page will fall back to its no-data state.
  }
}

export function loadMeasurements(): FingerMeasurementMm[] | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { results: FingerMeasurementMm[] };
    return parsed.results ?? null;
  } catch {
    return null;
  }
}
