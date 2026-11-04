"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Vrai une fois le composant hydraté côté navigateur (faux pendant le rendu serveur). */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** Minute courante (stable pendant une minute), nulle côté serveur : évite tout calcul impur au rendu. */
export function useNowMinute(): number | null {
  return useSyncExternalStore(
    (cb) => {
      const t = setInterval(cb, 60_000);
      return () => clearInterval(t);
    },
    () => Math.floor(Date.now() / 60_000),
    () => null,
  );
}
