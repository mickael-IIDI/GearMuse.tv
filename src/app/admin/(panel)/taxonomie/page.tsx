import { asc, desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { brands, categories, subcategories, vehicleModels } from "@/db/schema";
import { ActionForm } from "@/components/admin/form-state";
import { Card, btnGhost, input, td, th } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/session";
import { addBrandAction, updateCategoryAction } from "../../actions";

export const metadata = { title: "Catégories et marques" };

function CatRow({ kind, id, fr, en, active, count, slug }: { kind: "cat" | "sub"; id: number; fr: string; en?: string; active: boolean; count: number; slug: string }) {
  return (
    <form action={updateCategoryAction} className="flex flex-wrap items-center gap-1.5 py-1">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <code className="w-48 truncate text-xs text-faint" title={slug}>{slug}</code>
      <input name="fr" defaultValue={fr} className={`${input} w-56 py-1`} aria-label="Libellé français" />
      <input name="en" defaultValue={en ?? ""} className={`${input} w-48 py-1`} aria-label="Libellé anglais" />
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={active} className="accent-[var(--accent)]" /> actif</label>
      <span className="w-10 text-right text-xs tabular-nums text-muted">{count}</span>
      <button className={`${btnGhost} py-1`}>OK</button>
    </form>
  );
}

export default async function TaxonomyPage() {
  await requireAdmin("viewer");
  const db = await getDb();
  const cats = await db.select().from(categories).orderBy(asc(categories.kind), asc(categories.sortOrder));
  const subs = await db.select().from(subcategories).orderBy(asc(subcategories.sortOrder));
  const brandList = await db.select().from(brands).orderBy(desc(brands.videoCount), asc(brands.name));
  const models = await db.select().from(vehicleModels).orderBy(desc(vehicleModels.videoCount));
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Catégories, marques et modèles</h1>
      <Card title="Univers et sous-catégories">
        {cats.filter((c) => c.kind === "universe").map((u) => (
          <details key={u.id} className="border-b border-line/60 py-2">
            <summary className="cursor-pointer font-medium">{u.labels.fr} <span className="text-xs text-muted">({u.videoCount} vidéos)</span></summary>
            <div className="mt-2 pl-2">
              <CatRow kind="cat" id={u.id} slug={u.slug} fr={u.labels.fr} en={u.labels.en} active={u.isActive} count={u.videoCount} />
              {subs.filter((s) => s.categoryId === u.id).map((s) => <CatRow key={s.id} kind="sub" id={s.id} slug={s.slug} fr={s.labels.fr} en={s.labels.en} active={s.isActive} count={s.videoCount} />)}
            </div>
          </details>
        ))}
      </Card>
      <Card title="Thèmes, formats et technologies">
        {cats.filter((c) => c.kind !== "universe").map((c) => <CatRow key={c.id} kind="cat" id={c.id} slug={c.slug} fr={c.labels.fr} en={c.labels.en} active={c.isActive} count={c.videoCount} />)}
      </Card>
      <Card title="Ajouter une marque ou un modèle">
        <ActionForm action={addBrandAction} submitLabel="Ajouter">
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-sm">Nom<input name="name" required className={`${input} mt-1`} placeholder="ex. Ferrari 288 GTO" /></label>
            <label className="text-sm">Marque parente (pour un modèle)<select name="brand" className={`${input} mt-1`}><option value="">— nouvelle marque —</option>{brandList.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select></label>
            <label className="text-sm">Univers (slugs)<input name="universes" className={`${input} mt-1`} placeholder="automobile" /></label>
            <label className="text-sm">Alias (séparés par des virgules)<input name="aliases" className={`${input} mt-1`} placeholder="288 gto" /></label>
          </div>
        </ActionForm>
      </Card>
      <Card title={`Marques (${brandList.length}) et modèles (${models.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className={th}>Marque</th><th className={th}>Univers</th><th className={th}>Vidéos</th><th className={th}>Modèles présents</th></tr></thead>
            <tbody>
              {brandList.map((b) => (
                <tr key={b.id}>
                  <td className={td}>{b.name}<div className="text-xs text-faint">{b.slug}{b.aliases.length ? ` · alias : ${b.aliases.join(", ")}` : ""}</div></td>
                  <td className={td}>{b.universes.join(", ")}</td>
                  <td className={`${td} tabular-nums`}>{b.videoCount}</td>
                  <td className={`${td} text-xs text-muted`}>{models.filter((m) => m.brandId === b.id).map((m) => `${m.name} (${m.videoCount})`).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
