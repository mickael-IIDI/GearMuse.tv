"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-[60dvh] place-items-center px-6 text-center">
      <div>
        <h1 className="font-display text-2xl font-bold">Une erreur est survenue</h1>
        <p className="mt-2 text-muted">La page n&apos;a pas pu être affichée. Réessayez dans un instant.{error.digest ? ` (réf. ${error.digest})` : ""}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={reset} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-ink">Réessayer</button>
          <Link href="/" className="rounded-full border border-line px-5 py-2 text-sm">Accueil</Link>
        </div>
      </div>
    </main>
  );
}
