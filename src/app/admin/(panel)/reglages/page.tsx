import { ActionForm } from "@/components/admin/form-state";
import { Card, input } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/session";
import { getSetting } from "@/server/settings";
import { saveSettingsAction } from "../../actions";

export const metadata = { title: "Moteur de sélection" };

export default async function SettingsAdmin() {
  await requireAdmin("viewer");
  const [scoring, ingestion, ai] = await Promise.all([getSetting("scoring"), getSetting("ingestion"), getSetting("ai")]);
  const block = (key: string, title: string, help: string, value: unknown, rescore = false) => (
    <Card title={title}>
      <p className="mb-3 text-sm text-muted">{help}</p>
      <ActionForm action={saveSettingsAction}>
        <input type="hidden" name="key" value={key} />
        <textarea name="value" rows={Math.min(28, JSON.stringify(value, null, 2).split("\n").length + 1)} defaultValue={JSON.stringify(value, null, 2)} className={`${input} font-mono text-xs`} spellCheck={false} />
        {rescore && <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" name="rescore" defaultChecked className="accent-[var(--accent)]" /> Renoter tout le catalogue après l&apos;enregistrement</label>}
      </ActionForm>
    </Card>
  );
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Moteur de sélection</h1>
      {block(
        "scoring",
        "Notation sur 100 : pondérations, seuils et pénalités",
        "Les pondérations sont relatives (normalisées sur les critères mesurables). « publish » : note minimale pour la publication automatique ; « review » : en dessous, la vidéo est rejetée ; entre les deux, elle part en validation humaine. Les vidéos au statut verrouillé par un éditeur ne sont jamais modifiées.",
        scoring,
        true,
      )}
      {block("ingestion", "Ingestion", "autoPublish : publication automatique (sinon tout passe en validation). hnMinPoints : seuil de points des stories Hacker News. commentDiscoveryMinAuthors : nombre de personnes distinctes requises pour retenir une vidéo citée en commentaire. refreshAfterDays : délai avant revérification (≤ 30 jours pour respecter les règles de l'API YouTube).", ingestion)}
      {block("ai", "Analyse par modèle de langage", "Nécessite ANTHROPIC_API_KEY. enabled : active l'analyse IA (sinon classifieur à règles). model : identifiant du modèle. monthlyBudgetUsd : plafond mensuel ; au-delà, l'analyse repasse automatiquement en mode règles.", ai)}
    </div>
  );
}
