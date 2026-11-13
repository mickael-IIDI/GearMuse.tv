import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { BrowseView } from "@/components/browse/browse-view";
import { IconExternal } from "@/components/icons";
import { label } from "@/lib/i18n";
import { creatorSlug, idFromCreatorSlug } from "@/lib/text";
import { getI18n } from "@/server/locale";
import { getCreatorPage } from "@/server/queries/catalog";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** En dessous de ce nombre de vidéos publiées, la page n'est ni indexée ni inscrite au plan du site. */
const MIN_INDEXED_VIDEOS = 3;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = idFromCreatorSlug((await params).id);
  const r = id ? await getCreatorPage(id) : null;
  if (!r) return {};
  const c = r.creator;
  const universes = r.universes.map((u) => u.labels.fr.toLowerCase()).join(", ");
  const title = `${c.name} : ${r.published > 1 ? `${r.published} vidéos sélectionnées` : "vidéos sélectionnées"}`;
  const description = `Les vidéos de la chaîne ${c.name} retenues et notées par ${siteConfig.name}${universes ? ` (${universes})` : ""}, classées de la mieux notée à la plus récente.`;
  return {
    title,
    description,
    alternates: { canonical: `/chaine/${creatorSlug(c.id, c.name)}` },
    openGraph: { title, description, ...(r.image ? { images: [{ url: r.image }] } : {}) },
    robots: r.published < MIN_INDEXED_VIDEOS ? { index: false, follow: true } : undefined,
  };
}

export default async function CreatorPage({ params, searchParams }: Props) {
  const slug = (await params).id;
  const id = idFromCreatorSlug(slug);
  if (!id) notFound();
  const { locale } = await getI18n();
  const en = locale === "en";
  const r = await getCreatorPage(id);
  if (!r) notFound();
  const c = r.creator;
  const canonical = creatorSlug(c.id, c.name);
  if (slug !== canonical) permanentRedirect(`/chaine/${canonical}`);
  const badge = c.isOfficial ? (en ? "Official channel" : "Chaîne officielle") : c.isCuratedSource ? (en ? "Specialist channel followed by the editors" : "Chaîne spécialisée suivie par la rédaction") : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: c.name,
    url: `${siteConfig.url}/chaine/${canonical}`,
    ...(c.url ? { about: { "@type": "Organization", name: c.name, sameAs: c.url } } : {}),
  };
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
      intro={
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
          {r.published > 0 && (
            <section className="mb-5 max-w-3xl rounded-2xl bg-soft p-4 text-[14.5px] sm:p-5">
              <p>
                {en ? (
                  <>{siteConfig.name} has selected <strong>{r.published.toLocaleString("en")} video{r.published > 1 ? "s" : ""}</strong> from this channel{r.picks > 0 && <>, including {r.picks} editor&apos;s pick{r.picks > 1 ? "s" : ""}</>}.</>
                ) : (
                  <>{siteConfig.name} a retenu <strong>{r.published.toLocaleString("fr-FR")} vidéo{r.published > 1 ? "s" : ""}</strong> de cette chaîne{r.picks > 0 && <>, dont {r.picks} en « Sélection de la rédaction »</>}.</>
                )}              </p>
              {r.universes.length > 0 && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-muted">{en ? "Universes:" : "Univers :"}</span>
                  {r.universes.map((u) => (
                    <Link key={u.slug} href={`/univers/${u.slug}`} className="rounded-md bg-elev px-2 py-0.5 text-[12.5px] font-medium hover:text-accent">
                      {label(u.labels, locale)} <span className="text-faint">{u.count}</span>
                    </Link>
                  ))}
                </p>
              )}
              <p className="mt-2 text-xs text-faint">
                {en ? "Videos stay on YouTube and belong to their author. " : "Les vidéos restent sur YouTube et appartiennent à leur auteur. "}
                <Link href="/a-propos#notation" className="underline hover:text-fg">{en ? "How videos are selected and scored" : "Comment les vidéos sont choisies et notées"}</Link>
              </p>
            </section>
          )}
        </>
      }
      defaultSort="qualite"
    />
  );
}
