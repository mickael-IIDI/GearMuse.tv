"use client";

import { useEffect, useRef, useState } from "react";
import { library, useLibrary } from "@/components/library/store";
import { useI18n } from "@/components/locale-provider";
import { IconExternal, IconPlay } from "@/components/icons";

/**
 * Lecteur embarqué officiel YouTube (mode confidentialité renforcée youtube-nocookie.com),
 * chargé uniquement au clic (façade) sauf si le visiteur a choisi le chargement automatique.
 * Aucune publicité ni élément obligatoire n'est masqué : c'est le lecteur YouTube standard.
 * Les erreurs de lecture (vidéo bloquée, retirée, intégration interdite) affichent un repli.
 */

type YTPlayer = { destroy: () => void };
type YTNamespace = { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer };
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => reject(new Error("api"));
    document.head.appendChild(s);
  });
  return apiPromise;
}

export function Player({ externalId, title, poster, embeddable, availability }: { externalId: string; title: string; poster: string; embeddable: boolean | null; availability: string }) {
  const { t } = useI18n();
  const lib = useLibrary();
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const holder = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const watchUrl = `https://www.youtube.com/watch?v=${externalId}`;
  const blocked = availability === "unavailable" || availability === "private";
  const noEmbed = embeddable === false;

  useEffect(() => {
    library.addHistory(externalId);
  }, [externalId]);

  const start = async (autoplay: boolean) => {
    if (!holder.current || state === "loading" || state === "playing") return;
    setState("loading");
    try {
      const YT = await loadApi();
      const el = document.createElement("div");
      holder.current.replaceChildren(el);
      player.current = new YT.Player(el, {
        host: "https://www.youtube-nocookie.com",
        videoId: externalId,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: autoplay ? 1 : 0, rel: 0, playsinline: 1 },
        events: {
          onReady: () => setState("playing"),
          onError: () => setState("error"),
        },
      });
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    // Chargement automatique choisi par le visiteur : l'effet initialise un système externe (lecteur YouTube).
    if (!lib.prefs.autoLoadPlayer || blocked || noEmbed) return;
    const t = setTimeout(() => start(false), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- démarrage unique, selon la préférence
  }, [lib.prefs.autoLoadPlayer]);
  useEffect(() => () => player.current?.destroy(), []);

  const fallback = (msg: string) => (
    <div className="absolute inset-0 grid place-items-center bg-black/75 p-6 text-center text-white">
      <div>
        <p className="mx-auto max-w-md text-[15px]">{msg}</p>
        {!blocked && (
          <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90">
            {t.video.watchOnYoutube} <IconExternal size={16} />
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black sm:rounded-2xl">
      <div ref={holder} className="absolute inset-0 [&>iframe]:size-full" />
      {state !== "playing" && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- miniature officielle YouTube */}
          <img src={poster} alt="" className={`absolute inset-0 size-full object-cover ${state === "loading" ? "opacity-60" : ""} ${blocked ? "grayscale" : ""}`} referrerPolicy="no-referrer" />
          {blocked ? (
            fallback(t.video.unavailable)
          ) : noEmbed ? (
            fallback(t.video.embedDisabled)
          ) : state === "error" ? (
            fallback(t.video.playbackError)
          ) : (
            <button
              type="button"
              onClick={() => start(true)}
              className="group absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-black/60 via-transparent to-black/20 text-white"
              aria-label={`${t.video.play} : ${title}`}
            >
              <span className="grid size-[72px] place-items-center rounded-full bg-black/70 shadow-xl transition group-hover:scale-105 group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-ink)]">
                <IconPlay size={34} />
              </span>
              <span className="max-w-md px-6 text-center text-xs text-white/85">{t.video.playerConsent}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
