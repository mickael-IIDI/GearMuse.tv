import Link from "next/link";
import { Logo } from "@/components/icons";
import { getI18n } from "@/server/locale";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <div className="mx-auto mb-5 w-fit"><Logo size={44} /></div>
        <h1 className="font-display text-2xl font-bold">{t.common.notFound}</h1>
        <p className="mt-2 text-muted">{t.common.notFoundText}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-ink">{t.nav.home}</Link>
          <Link href="/recherche" className="rounded-full border border-line px-5 py-2 text-sm">{t.search.button}</Link>
        </div>
      </div>
    </main>
  );
}
