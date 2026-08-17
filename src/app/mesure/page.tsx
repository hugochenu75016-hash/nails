import Link from "next/link";
import NailScanner from "@/components/NailScanner";

export const metadata = {
  title: "Mesurer mes ongles — NailFit",
};

export default function MesurePage() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 pt-8">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Retour
        </Link>
      </div>
      <NailScanner />
    </main>
  );
}
