import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ContributionForm } from "@/components/ui/contribution-form";

export const metadata: Metadata = { title: "Signaler un contenu", alternates: { canonical: "/signaler" } };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ video?: string }> }) {
  const { video } = await searchParams;
  return (
    <>
      <PageHeader
        title="Signaler un contenu"
        subtitle="Vidéo indisponible, erreur de classement, contenu inapproprié ou demande de retrait d'un ayant droit : chaque signalement est examiné par un administrateur."
      />
      <ContributionForm
        kind="report"
        submitLabel="Envoyer le signalement"
        successText="Merci. Votre signalement a été transmis à l'équipe d'administration."
        fields={[
          { name: "video", label: "Vidéo concernée (lien ou identifiant)", defaultValue: video ? `https://www.youtube.com/watch?v=${video.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 11)}` : "" },
          {
            name: "reason",
            label: "Motif",
            type: "select",
            required: true,
            options: [
              ["rights_holder", "Je suis l'auteur / l'ayant droit et demande le retrait"],
              ["unavailable", "La vidéo ne fonctionne plus"],
              ["wrong_category", "Classement ou information erronés"],
              ["inappropriate", "Contenu inapproprié"],
              ["other", "Autre"],
            ],
          },
          { name: "message", label: "Message", type: "textarea", required: true },
          { name: "contact", label: "Moyen de vous répondre (facultatif)" },
        ]}
      />
    </>
  );
}
