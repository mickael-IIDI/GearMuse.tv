import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ContributionForm } from "@/components/ui/contribution-form";

export const metadata: Metadata = { title: "Proposer une vidéo", alternates: { canonical: "/proposer" } };

export default function SuggestPage() {
  return (
    <>
      <PageHeader
        title="Proposer une vidéo"
        subtitle="Une vidéo remarquable manque au catalogue ? Proposez-la : elle sera vérifiée, analysée puis validée par la rédaction avant toute publication."
      />
      <ContributionForm
        kind="suggestion"
        submitLabel="Envoyer la proposition"
        successText="Merci ! Votre proposition a été enregistrée et sera examinée par la rédaction."
        fields={[
          { name: "url", label: "Lien YouTube", type: "url", required: true, placeholder: "https://www.youtube.com/watch?v=…" },
          { name: "note", label: "Pourquoi cette vidéo mérite sa place (facultatif)", type: "textarea" },
        ]}
      />
    </>
  );
}
