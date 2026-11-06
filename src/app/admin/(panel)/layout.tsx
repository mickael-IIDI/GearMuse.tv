import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Logo, Wordmark } from "@/components/brand/logo";
import { can, requireAdmin } from "@/server/auth/session";
import { logoutAction } from "../actions";

export const metadata: Metadata = { title: { default: "Administration", template: `%s · Administration ${siteConfig.name}` }, robots: { index: false, follow: false } };

const NAV: { href: string; label: string; min?: "editor" | "admin" | "owner" }[] = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/moderation", label: "File de modération" },
  { href: "/admin/videos", label: "Vidéos" },
  { href: "/admin/videos?statut=unavailable", label: "Contenus indisponibles" },
  { href: "/admin/import", label: "Import", min: "editor" },
  { href: "/admin/playlists", label: "Playlists" },
  { href: "/admin/taxonomie", label: "Catégories et marques" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/taches", label: "Tâches automatiques" },
  { href: "/admin/ia", label: "Analyses IA et coûts" },
  { href: "/admin/reglages", label: "Moteur de sélection" },
  { href: "/admin/journal", label: "Journal des opérations" },
  { href: "/admin/comptes", label: "Comptes", min: "owner" },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const s = await requireAdmin("viewer");
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="shrink-0 border-b border-line bg-elev lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <Logo size={26} />
          <div className="leading-tight">
            <Wordmark />
            <div className="text-[11px] text-faint">Administration</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible" aria-label="Administration">
          {NAV.filter((n) => !n.min || can(s.role, n.min)).map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-[13.5px] text-fg/85 hover:bg-hover">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-line px-5 py-4 text-xs text-muted lg:block">
          <div className="truncate font-medium text-fg">{s.name}</div>
          <div className="truncate">{s.email} · {s.role}</div>
          <div className="mt-3 flex gap-3">
            <Link href="/" className="hover:text-fg">Voir le site</Link>
            <form action={logoutAction}><button type="submit" className="hover:text-fg">Déconnexion</button></form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
