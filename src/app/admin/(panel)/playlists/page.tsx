import Link from "next/link";
import { Card, StatusBadge, btnPrimary, td, th } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/session";
import { playlistSummaries } from "@/server/queries/catalog";
import { getDb } from "@/db/client";
import { playlists } from "@/db/schema";
import { asc } from "drizzle-orm";

export const metadata = { title: "Playlists" };

export default async function AdminPlaylists() {
  await requireAdmin("viewer");
  const db = await getDb();
  const all = await db.select().from(playlists).orderBy(asc(playlists.tier), asc(playlists.sortOrder));
  const counts = new Map((await playlistSummaries({ includeDrafts: true, minItems: 0 })).map((p) => [p.id, p.count]));
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Playlists</h1>
        <Link href="/admin/playlists/nouvelle" className={btnPrimary}>Nouvelle playlist</Link>
      </div>
      <Card>
        <p className="mb-3 text-sm text-muted">Les playlists « intelligentes » sont recalculées à partir de règles (tâche « Recalculer les playlists ») ; les vidéos ajoutées ou réordonnées à la main sont épinglées et conservées. Une playlist de moins de 3 vidéos publiées n&apos;est pas affichée sur le site.</p>
        <table className="w-full">
          <thead><tr><th className={th}>Titre</th><th className={th}>Type</th><th className={th}>Niveau</th><th className={th}>Vidéos publiées</th><th className={th}>Statut</th></tr></thead>
          <tbody>
            {all.map((p) => (
              <tr key={p.id}>
                <td className={td}><Link href={`/admin/playlists/${p.id}`} className="font-medium hover:text-accent">{p.titles.fr}</Link><div className="text-xs text-faint">/{p.slug}</div></td>
                <td className={td}>{p.kind === "smart" ? "Intelligente" : "Éditoriale"}</td>
                <td className={td}>{p.tier === "start" ? "Pour commencer" : "Pour aller plus loin"}</td>
                <td className={`${td} tabular-nums ${(counts.get(p.id) ?? 0) < 3 ? "text-danger" : ""}`}>{counts.get(p.id) ?? 0}</td>
                <td className={td}><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
