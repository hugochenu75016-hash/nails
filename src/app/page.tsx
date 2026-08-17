import Link from "next/link";

const steps = [
  {
    title: "1. Calibrez",
    text: "Placez une carte bancaire ou d'identité face à la caméra pour donner l'échelle réelle (mm).",
  },
  {
    title: "2. Scannez",
    text: "Présentez votre main à la caméra, on détecte chaque doigt et la largeur de chaque ongle.",
  },
  {
    title: "3. Recevez votre pose",
    text: "Votre set de faux ongles est découpé sur-mesure à partir de vos mesures exactes.",
  },
];

export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto max-w-3xl px-6 pt-24 pb-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Des faux ongles à votre taille exacte,
          <br className="hidden sm:block" /> mesurés par caméra
        </h1>
        <p className="mt-6 text-lg text-neutral-600">
          Fini les kits de 20 tailles qui ne vont jamais parfaitement. Scannez
          votre main, on mesure chaque ongle au millimètre près et on
          personnalise votre pose.
        </p>
        <div className="mt-10">
          <Link
            href="/mesure"
            className="inline-flex items-center rounded-full bg-neutral-900 px-8 py-3 text-white font-medium hover:bg-neutral-700 transition-colors"
          >
            Mesurer mes ongles
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="grid gap-8 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.title} className="rounded-2xl border border-neutral-200 p-6">
              <h2 className="font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm text-neutral-600">{step.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-xs text-neutral-400">
          Version bêta — la mesure par caméra est une estimation. Pour une
          précision maximale, utilisez un fond uni et un bon éclairage.
        </p>
      </section>
    </main>
  );
}
