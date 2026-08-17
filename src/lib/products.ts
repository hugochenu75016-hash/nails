import type { NailShape } from "@/components/NailSwatch";
import type { FingerMeasurementMm } from "@/lib/measurementsStore";

export type SizeProfile = "fine" | "standard" | "large";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  shape: NailShape;
  colorFrom: string;
  colorTo?: string;
  sizeProfile: SizeProfile;
}

/** Placeholder catalog — 10 example press-on nail sets standing in for a
 * real product feed, so the recommendation flow has something to show. */
export const PRODUCTS: Product[] = [
  {
    id: "nude-essential",
    name: "Nude Essential",
    description: "Amande, nude mat",
    price: 14.9,
    shape: "almond",
    colorFrom: "#d9a679",
    sizeProfile: "standard",
  },
  {
    id: "french-classic",
    name: "French Classic",
    description: "Ovale, French tip intemporel",
    price: 16.9,
    shape: "round",
    colorFrom: "#f5e6d3",
    colorTo: "#ffffff",
    sizeProfile: "standard",
  },
  {
    id: "rouge-passion",
    name: "Rouge Passion",
    description: "Stiletto, rouge glossy",
    price: 18.9,
    shape: "almond",
    colorFrom: "#b3122e",
    sizeProfile: "fine",
  },
  {
    id: "glossy-nude",
    name: "Glossy Nude",
    description: "Squoval, beige rosé",
    price: 13.9,
    shape: "square",
    colorFrom: "#e8c4b8",
    sizeProfile: "large",
  },
  {
    id: "coffin-chrome",
    name: "Coffin Chrome",
    description: "Coffin, argent chromé",
    price: 19.9,
    shape: "square",
    colorFrom: "#dee1e3",
    colorTo: "#9aa0a6",
    sizeProfile: "standard",
  },
  {
    id: "glitter-night",
    name: "Glitter Night",
    description: "Amande, noir pailleté or",
    price: 17.9,
    shape: "almond",
    colorFrom: "#1a1a1a",
    colorTo: "#3a2f13",
    sizeProfile: "fine",
  },
  {
    id: "soft-pink",
    name: "Soft Pink",
    description: "Rond, rose pâle",
    price: 12.9,
    shape: "round",
    colorFrom: "#f3c9d6",
    sizeProfile: "large",
  },
  {
    id: "milky-white",
    name: "Milky White",
    description: "Squoval, blanc laiteux",
    price: 13.9,
    shape: "square",
    colorFrom: "#f7f4ee",
    sizeProfile: "large",
  },
  {
    id: "emerald-edge",
    name: "Emerald Edge",
    description: "Stiletto, vert émeraude",
    price: 18.9,
    shape: "almond",
    colorFrom: "#0f5c46",
    sizeProfile: "fine",
  },
  {
    id: "caramel-ombre",
    name: "Caramel Ombré",
    description: "Coffin, dégradé caramel",
    price: 17.9,
    shape: "square",
    colorFrom: "#a9673a",
    colorTo: "#d9a679",
    sizeProfile: "standard",
  },
];

/** Buckets the client's average nail width into a rough size profile.
 * These thresholds are placeholders pending real sizing data. */
export function profileFromMeasurements(
  results: FingerMeasurementMm[]
): SizeProfile {
  const avg =
    results.reduce((sum, r) => sum + r.widthMm, 0) / (results.length || 1);
  if (avg < 12) return "fine";
  if (avg > 15) return "large";
  return "standard";
}

/** Sorts the catalog so items matching the client's size profile come
 * first, each tagged with whether it's a recommended match. */
export function rankProducts(profile: SizeProfile | null) {
  return PRODUCTS.map((p) => ({
    product: p,
    recommended: profile !== null && p.sizeProfile === profile,
  })).sort((a, b) => Number(b.recommended) - Number(a.recommended));
}
