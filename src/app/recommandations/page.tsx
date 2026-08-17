"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NailSwatch from "@/components/NailSwatch";
import { loadMeasurements } from "@/lib/measurementsStore";
import { profileFromMeasurements, rankProducts, type SizeProfile } from "@/lib/products";

const PROFILE_LABEL: Record<SizeProfile, string> = {
  fine: "Fine",
  standard: "Standard",
  large: "Ample",
};

export default function RecommandationsPage() {
  const [profile, setProfile] = useState<SizeProfile | null | undefined>(
    undefined
  );

  useEffect(() => {
    // sessionStorage only exists client-side, so this can't be read during
    // the initial (server) render — reading it here, post-mount, is the
    // standard escape hatch for browser-only storage in a prerendered page.
    const results = loadMeasurements();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(results ? profileFromMeasurements(results) : null);
  }, []);

  if (profile === undefined) {
    return (
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center text-neutral-400">
          Chargement…
        </div>
      </main>
    );
  }

  const ranked = rankProducts(profile);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-5xl px-6 pb-24 pt-4">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Tes recommandations
          </h1>
          {profile ? (
            <p className="mt-2 text-neutral-600">
              Taille recommandée :{" "}
              <span className="font-semibold">{PROFILE_LABEL[profile]}</span>{" "}
              — les modèles marqués ci-dessous sont ajustés à ta morphologie.
            </p>
          ) : (
            <p className="mt-2 text-neutral-600">
              Pas encore de scan enregistré.{" "}
              <Link href="/mesure" className="underline hover:text-neutral-900">
                Mesure tes ongles
              </Link>{" "}
              pour voir tes recommandations personnalisées.
            </p>
          )}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {ranked.map(({ product, recommended }) => (
            <div
              key={product.id}
              className={`rounded-2xl border p-3 ${
                recommended
                  ? "border-green-500 ring-1 ring-green-500"
                  : "border-neutral-200"
              }`}
            >
              <div className="relative">
                <NailSwatch
                  id={product.id}
                  shape={product.shape}
                  colorFrom={product.colorFrom}
                  colorTo={product.colorTo}
                  className="w-full"
                />
                {recommended && (
                  <span className="absolute left-1 top-1 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Pour toi
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold">{product.name}</p>
              <p className="text-xs text-neutral-500">{product.description}</p>
              <p className="mt-1 text-sm font-mono">
                {product.price.toFixed(2)} €
              </p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-neutral-400">
          Catalogue d&apos;exemple — modèles factices en attendant le vrai
          catalogue produit.
        </p>
      </div>
    </main>
  );
}
