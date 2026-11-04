import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { adminUsers, ADMIN_ROLES } from "@/db/schema";
import { ActionForm } from "@/components/admin/form-state";
import { Card, fmtDate, input, td, th } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/session";
import { saveAdminUserAction } from "../../actions";

export const metadata = { title: "Comptes" };

const ROLES: Record<string, string> = { owner: "Propriétaire : tout, y compris les comptes", admin: "Administrateur : sources, réglages, tâches", editor: "Éditeur : modération, édition, import, playlists", viewer: "Lecteur : consultation seule" };

export default async function AccountsPage() {
  await requireAdmin("owner");
  const db = await getDb();
  const users = await db.select().from(adminUsers).orderBy(asc(adminUsers.id));
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Comptes administrateurs</h1>
      <Card>
        <table className="w-full">
          <thead><tr><th className={th}>Compte</th><th className={th}>Rôle</th><th className={th}>Actif</th><th className={th}>Dernière connexion</th></tr></thead>
          <tbody>{users.map((u) => <tr key={u.id}><td className={td}>{u.name}<div className="text-xs text-muted">{u.email}</div></td><td className={td}>{u.role}</td><td className={td}>{u.isActive ? "oui" : "non"}</td><td className={td}>{fmtDate(u.lastLoginAt)}</td></tr>)}</tbody>
        </table>
      </Card>
      <Card title="Créer ou modifier un compte">
        <ActionForm action={saveAdminUserAction}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">E-mail<input name="email" type="email" required className={`${input} mt-1`} /></label>
            <label className="text-sm">Nom<input name="name" className={`${input} mt-1`} /></label>
            <label className="text-sm">Rôle<select name="role" className={`${input} mt-1`}>{ADMIN_ROLES.map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}</select></label>
            <label className="text-sm">Mot de passe (12 caractères min. ; vide = inchangé)<input name="password" type="password" autoComplete="new-password" className={`${input} mt-1`} /></label>
            <label className="text-sm">État<select name="active" className={`${input} mt-1`}><option value="on">Actif</option><option value="off">Désactivé</option></select></label>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
