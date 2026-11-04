import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { playlists } from "@/db/schema";
import { ActionForm } from "@/components/admin/form-state";
import { Card, StatusBadge, btnGhost, btnPrimary, input, td } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/session";
import { playlistItemAction, savePlaylistAction } from "../../../actions";

export const metadata = { title: "Playlist" };

export default async function AdminPlaylist({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("viewer");
  const raw = (await params).id;
  const db = await getDb();
  const isNew = raw === "nouvelle";
  const p = isNew ? null : await db.query.playlists.findFirst({ where: eq(playlists.id, Number(raw)) });
  if (!isNew && !p) notFound();
  const items = p
    ? rows<{ video_id: number; position: number; pinned: boolean; added_by: string; note: string | null; title: string; external_id: string; status: string; quality_score: number | null }>(
        await db.execute(sql`select pi.video_id, pi.position, pi.pinned, pi.added_by, pi.note, v.title, v.external_id, v.status, v.quality_score from playlist_items pi join videos v on v.id = pi.video_id where pi.playlist_id = ${p.id} order by pi.position`),
      )
    : [];

  return (
    <div className="space-y-6">
      <Link href="/admin/playlists" className="text-sm text-muted hover:text-fg">← Playlists</Link>
      <h1 className="font-display text-2xl font-bold">{p ? p.titles.fr : "Nouvelle playlist"}</h1>
      <Card title="Paramètres et métadonnées SEO">
        <ActionForm action={savePlaylistAction}>
          {p && <input type="hidden" name="id" value={p.id} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Titre (FR)<input name="titleFr" required defaultValue={p?.titles.fr} className={`${input} mt-1`} /></label>
            <label className="text-sm">Titre (EN)<input name="titleEn" defaultValue={p?.titles.en} className={`${input} mt-1`} /></label>
            <label className="text-sm">Identifiant d&apos;URL<input name="slug" required pattern="[a-z0-9-]{3,80}" defaultValue={p?.slug} className={`${input} mt-1`} /></label>
            <label className="text-sm">Accroche<input name="pitchFr" defaultValue={p?.pitches?.fr} className={`${input} mt-1`} /></label>
            <label className="text-sm sm:col-span-2">Description<textarea name="descFr" rows={3} defaultValue={p?.descriptions?.fr} className={`${input} mt-1`} /></label>
            <label className="text-sm">Type<select name="kind" defaultValue={p?.kind ?? "editorial"} className={`${input} mt-1`}><option value="editorial">Éditoriale (manuelle)</option><option value="smart">Intelligente (règles)</option></select></label>
            <label className="text-sm">Niveau<select name="tier" defaultValue={p?.tier ?? "start"} className={`${input} mt-1`}><option value="start">Pour commencer</option><option value="deep">Pour aller plus loin</option></select></label>
            <label className="text-sm">Statut<select name="status" defaultValue={p?.status ?? "draft"} className={`${input} mt-1`}><option value="draft">Brouillon</option><option value="published">Publiée</option></select></label>
            <label className="text-sm">Titre SEO<input name="seoTitle" defaultValue={p?.seoTitle ?? ""} className={`${input} mt-1`} /></label>
            <label className="text-sm sm:col-span-2">Meta description<input name="seoDescription" defaultValue={p?.seoDescription ?? ""} className={`${input} mt-1`} /></label>
            <label className="text-sm sm:col-span-2">
              Règles (JSON, playlists intelligentes) — clés : universes, subcategories, themes, formats, technologies, brands, keywords, minScore, minDurationSeconds, limit, order
              <textarea name="rules" rows={4} defaultValue={p?.rules ? JSON.stringify(p.rules, null, 2) : ""} className={`${input} mt-1 font-mono text-xs`} />
            </label>
          </div>
        </ActionForm>
      </Card>

      {p && (
        <Card title={`Vidéos (${items.length})`}>
          <form action={playlistItemAction} className="mb-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="playlistId" value={p.id} />
            <input type="hidden" name="op" value="add" />
            <label className="text-sm">Ajouter une vidéo du catalogue (URL ou identifiant)<input name="video" required className={`${input} mt-1 w-80`} /></label>
            <label className="text-sm">Note de curation<input name="note" className={`${input} mt-1 w-80`} /></label>
            <button className={btnPrimary}>Ajouter</button>
          </form>
          <table className="w-full">
            <tbody>
              {items.map((it, i) => (
                <tr key={it.video_id}>
                  <td className={`${td} w-8 tabular-nums text-faint`}>{i + 1}</td>
                  <td className={td}>
                    <Link href={`/admin/videos/${it.video_id}`} className="font-medium hover:text-accent">{it.title}</Link>
                    <div className="text-xs text-muted"><StatusBadge status={it.status} /> note {it.quality_score ?? "—"} · {it.added_by === "editor" ? "ajoutée à la main" : "règle"}{it.pinned ? " · épinglée" : ""}</div>
                    <form action={playlistItemAction} className="mt-1 flex gap-1.5">
                      <input type="hidden" name="playlistId" value={p.id} /><input type="hidden" name="videoId" value={it.video_id} /><input type="hidden" name="op" value="note" />
                      <input name="note" defaultValue={it.note ?? ""} placeholder="Note de curation" className={`${input} py-1 text-xs`} />
                      <button className={`${btnGhost} py-1 text-xs`}>OK</button>
                    </form>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {(["up", "down", "pin", "remove"] as const).map((op) => (
                      <form key={op} action={playlistItemAction} className="inline">
                        <input type="hidden" name="playlistId" value={p.id} /><input type="hidden" name="videoId" value={it.video_id} /><input type="hidden" name="op" value={op} />
                        <button className={`${btnGhost} mr-1 px-2 py-1 text-xs`} aria-label={op}>{op === "up" ? "↑" : op === "down" ? "↓" : op === "pin" ? (it.pinned ? "Désépingler" : "Épingler") : "Retirer"}</button>
                      </form>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
