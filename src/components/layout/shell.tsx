"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { siteConfig } from "@/config/site";
import { useI18n } from "@/components/locale-provider";
import { setUiCookie } from "@/components/library/store";
import {
  IconCar, IconClock, IconCompass, IconFolder, IconGrid, IconHeart, IconHistory, IconHome, IconList, IconLong, IconMenu,
  IconMoon, IconMoto, IconPiston, IconPlane, IconBoat, IconRocket, IconSettings, IconSparkle, IconStar, IconSun, IconInfo, Logo,
} from "@/components/icons";
import { SearchBox } from "./search-box";

type Item = { href: string; label: string; icon: (p: { size?: number }) => React.JSX.Element; match?: (p: string) => boolean };

/* État replié du menu (préférence locale), exposé comme une source externe. */
const SIDEBAR_KEY = "vc:sidebar";
function readSidebar(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === "collapsed";
  } catch {
    return false;
  }
}
function subscribeSidebar(cb: () => void) {
  window.addEventListener("vc:sidebar", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("vc:sidebar", cb);
    window.removeEventListener("storage", cb);
  };
}
function writeSidebar(collapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event("vc:sidebar"));
}

export function Shell({ children, theme }: { children: React.ReactNode; theme: "dark" | "light" | "system" }) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  // Le tiroir mobile n'est ouvert que pour la page où il a été ouvert : il se referme à chaque navigation.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (v: boolean) => setOpenAt(v ? pathname : null);
  const collapsed = useSyncExternalStore(subscribeSidebar, readSidebar, () => false);
  const [mode, setMode] = useState(theme);

  const toggleMenu = () => {
    if (window.matchMedia("(max-width: 1023px)").matches) setOpen(!open);
    else writeSidebar(!collapsed);
  };
  const toggleTheme = () => {
    const isDark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = isDark ? "light" : "dark";
    setMode(next);
    document.documentElement.dataset.theme = next;
    setUiCookie("theme", next);
  };

  const en = locale === "en";
  const sections: { title?: string; items: Item[] }[] = [
    {
      items: [
        { href: "/", label: t.nav.home, icon: IconHome, match: (p) => p === "/" },
        { href: "/pour-vous", label: t.nav.forYou, icon: IconSparkle },
        { href: "/videos", label: t.nav.all, icon: IconGrid, match: (p) => p === "/videos" },
        { href: "/videos/longues", label: t.nav.long, icon: IconLong },
      ],
    },
    {
      title: t.nav.universes,
      items: [
        { href: "/univers/automobile", label: en ? "Cars" : "Automobile", icon: IconCar },
        { href: "/univers/moto", label: en ? "Motorcycles" : "Moto", icon: IconMoto },
        { href: "/univers/aviation", label: "Aviation", icon: IconPlane },
        { href: "/univers/nautisme", label: en ? "Boats & ships" : "Bateaux", icon: IconBoat },
        { href: "/univers/autres-vehicules", label: en ? "Other vehicles" : "Autres véhicules", icon: IconRocket },
        { href: "/technologies", label: t.nav.technologies, icon: IconPiston, match: (p) => p.startsWith("/technologies") || p.startsWith("/themes") },
      ],
    },
    {
      title: t.nav.explore,
      items: [
        { href: "/decouvertes", label: t.nav.discoveries, icon: IconCompass },
        { href: "/mieux-notees", label: t.nav.topRated, icon: IconStar },
        { href: "/categories", label: t.nav.categories, icon: IconFolder, match: (p) => p === "/categories" || p.startsWith("/marques") },
        { href: "/playlists", label: t.nav.playlists, icon: IconList },
      ],
    },
    {
      title: t.nav.library,
      items: [
        { href: "/favoris", label: t.nav.favorites, icon: IconHeart },
        { href: "/historique", label: t.nav.history, icon: IconHistory },
        { href: "/a-regarder", label: t.nav.later, icon: IconClock },
        { href: "/parametres", label: t.nav.settings, icon: IconSettings },
      ],
    },
  ];
  const isActive = (it: Item) => (it.match ? it.match(pathname) : pathname === it.href || pathname.startsWith(it.href + "/"));
  const rail = collapsed && !open;

  return (
    <div className="min-h-dvh">
      <a href="#contenu" className="skip-link">{en ? "Skip to content" : "Aller au contenu"}</a>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-line/60 bg-bg/90 px-2 backdrop-blur sm:px-4">
        <button type="button" onClick={toggleMenu} aria-label={t.nav.menu} aria-expanded={open || !collapsed} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-hover">
          <IconMenu />
        </button>
        <Link href="/" className="flex shrink-0 items-center gap-2 pr-2" aria-label={`${siteConfig.name} — ${t.nav.home}`}>
          <Logo size={28} />
          <span className="hidden font-display text-[19px] font-bold tracking-tight sm:inline">{siteConfig.name}</span>
        </Link>
        <div className="mx-auto w-full max-w-[640px] min-w-0">
          <SearchBox />
        </div>
        <Link href="/a-propos" aria-label={t.nav.about} title={t.nav.about} className="hidden size-10 shrink-0 place-items-center rounded-full hover:bg-hover sm:grid">
          <IconInfo />
        </Link>
        <button type="button" onClick={toggleTheme} aria-label={en ? "Toggle theme" : "Changer de thème"} title={en ? "Toggle theme" : "Changer de thème"} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-hover">
          <span className="[[data-theme=light]_&]:hidden"><IconMoon /></span>
          <span className="hidden [[data-theme=light]_&]:inline"><IconSun /></span>
        </button>
      </header>

      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <nav
        aria-label={en ? "Main navigation" : "Navigation principale"}
        className={`fixed bottom-0 top-14 z-50 overflow-y-auto overscroll-contain bg-bg pb-6 scrollbar-none transition-transform lg:z-30 ${
          open ? "left-0 w-64 translate-x-0 border-r border-line shadow-2xl" : "-translate-x-full lg:translate-x-0"
        } ${rail ? "lg:w-[76px]" : "lg:w-60"}`}
      >
        {sections.map((s, i) => (
          <div key={i} className={`px-3 py-2 ${i > 0 ? "border-t border-line/60" : ""}`}>
            {s.title && !rail && <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-faint">{s.title}</div>}
            {s.items.map((it) => {
              const active = isActive(it);
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  title={rail ? it.label : undefined}
                  className={`flex items-center rounded-lg transition-colors ${rail ? "flex-col gap-1 px-1 py-3 text-[10px]" : "gap-4 px-3 py-2 text-[14px]"} ${
                    active ? "bg-soft font-semibold text-fg" : "text-fg/85 hover:bg-hover"
                  }`}
                >
                  <span className={active ? "text-accent" : ""}><Icon size={rail ? 22 : 20} /></span>
                  <span className={rail ? "w-full truncate text-center" : "truncate"}>{it.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
        {!rail && (
          <div className="border-t border-line/60 px-6 pt-4 text-xs leading-6 text-faint">
            <div className="flex flex-wrap gap-x-3">
              <Link className="hover:text-fg" href="/a-propos">{t.nav.about}</Link>
              <Link className="hover:text-fg" href="/proposer">{t.nav.suggest}</Link>
              <Link className="hover:text-fg" href="/signaler">{t.nav.report}</Link>
              <Link className="hover:text-fg" href="/marques">{t.nav.brands}</Link>
              <Link className="hover:text-fg" href="/confidentialite">{t.nav.privacy}</Link>
              <Link className="hover:text-fg" href="/mentions-legales">{t.nav.legal}</Link>
              <Link className="hover:text-fg" href="/contact">{t.nav.contact}</Link>
            </div>
            <p className="mt-3">{en ? "Videos remain the property of their authors and are played through YouTube's official player." : "Les vidéos restent la propriété de leurs auteurs et sont lues via le lecteur officiel de YouTube."}</p>
          </div>
        )}
      </nav>

      <main id="contenu" className={`pt-14 transition-[padding] ${rail ? "lg:pl-[76px]" : "lg:pl-60"}`}>
        <div className="mx-auto max-w-[2000px] px-4 pb-16 pt-5 sm:px-6">{children}</div>
      </main>
    </div>
  );
}
