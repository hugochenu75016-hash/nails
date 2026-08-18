import type { Metadata } from "next";
import Link from "next/link";
import PageTransition from "@/components/PageTransition";
import "./globals.css";

export const metadata: Metadata = {
  title: "ONE STUD' — Mesure d'ongles par caméra",
  description:
    "Mesurez vos ongles avec votre caméra et obtenez une pose personnalisée à votre taille exacte.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-neutral-900">
        <PageTransition />
        <header className="px-6 py-5">
          <Link href="/" className="text-sm font-black tracking-tight">
            ONE STUD&apos;
          </Link>
        </header>
        {children}
      </body>
    </html>
  );
}
