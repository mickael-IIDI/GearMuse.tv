"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useOptimistic, useTransition } from "react";
import { setUiCookie } from "@/components/library/store";
import { VIDEO_LANGUAGE_COOKIE, type LanguageOption } from "@/lib/languages";

type VideoLanguageContext = { current: string | null; options: LanguageOption[]; total: number };

const Ctx = createContext<VideoLanguageContext>({ current: null, options: [], total: 0 });

export function VideoLanguageProvider({ children, ...value }: VideoLanguageContext & { children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Langue des vidéos choisie par le visiteur ; la modifier recharge les données du serveur. */
export function useVideoLanguage() {
  const context = useContext(Ctx);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setShown] = useOptimistic(context.current);

  const setLanguage = (code: string | null) => {
    setUiCookie(VIDEO_LANGUAGE_COOKIE, code);
    startTransition(() => {
      setShown(code);
      router.refresh();
    });
  };

  return { ...context, current, pending, setLanguage };
}
