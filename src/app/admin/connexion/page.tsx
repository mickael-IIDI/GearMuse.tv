import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo, Wordmark } from "@/components/brand/logo";
import { ActionForm } from "@/components/admin/form-state";
import { input } from "@/components/admin/ui";
import { getSession } from "@/server/auth/session";
import { loginAction } from "../actions";

export const metadata: Metadata = { title: "Connexion administration", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await getSession()) redirect("/admin");
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-elev p-7 shadow-[var(--shadow)]">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={32} />
          <div>
            <Wordmark className="block text-lg" />
            <div className="text-xs text-muted">Administration</div>
          </div>
        </div>
        <ActionForm action={loginAction} submitLabel="Se connecter" pendingLabel="Vérification…">
          <label className="mb-3 block text-sm font-medium">
            E-mail
            <input name="email" type="email" autoComplete="username" required className={`${input} mt-1`} />
          </label>
          <label className="block text-sm font-medium">
            Mot de passe
            <input name="password" type="password" autoComplete="current-password" required className={`${input} mt-1`} />
          </label>
        </ActionForm>
        <p className="mt-5 text-xs text-faint">Accès réservé. Les tentatives sont journalisées ; le compte est verrouillé 15 minutes après 5 échecs.</p>
      </div>
    </main>
  );
}
