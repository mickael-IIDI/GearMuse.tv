import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowseView } from "@/components/browse/browse-view";
import { IconExternal } from "@/components/icons";
import { getI18n } from "@/server/locale";
import { getCreator } from "@/server/queries/catalog";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCreator(Number((await params).id));
  if (!c) return {};
  return { title: `${c.name} — vidéos sélectionnées`, robots: { index: false, follow: true } };
}

export default async function CreatorPage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const { locale } = await getI18n();
  const en = locale === "en";
  const c = await getCreator(id);
  if (!c) notFound();
  const badge = c.isOfficial ? (en ? "Official channel" : "Chaîne officielle") : c.isCuratedSource ? (en ? "Specialist channel followed by the editors" : "Chaîne spécialisée suivie par la rédaction") : null;
  return (
    <BrowseView
      searchParams={await searchParams}
      fixed={{ chaine: id }}
      title={c.name}
      subtitle={
        <span className="flex flex-wrap items-center gap-3">
          {badge && <span className="rounded-md bg-accent-soft px-2 py-0.5 text-sm text-accent">{badge}</span>}
          {c.url && (
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-link underline">
              {en ? "Channel on YouTube" : "La chaîne sur YouTube"} <IconExternal size={14} />
            </a>
          )}
        </span>
      }
      defaultSort="qualite"
    />
  );
}
