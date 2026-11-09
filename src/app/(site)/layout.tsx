import { Shell } from "@/components/layout/shell";
import { VideoLanguageProvider } from "@/components/video-language/provider";
import { buildLanguageOptions } from "@/lib/languages";
import { getI18n, getTheme, getVideoLanguage } from "@/server/locale";
import { publishedLanguages } from "@/server/queries/videos";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [theme, { locale }, current, { languages, total }] = await Promise.all([getTheme(), getI18n(), getVideoLanguage(), publishedLanguages()]);
  return (
    <VideoLanguageProvider current={current ?? null} options={buildLanguageOptions(languages, locale, current)} total={total}>
      <Shell theme={theme}>{children}</Shell>
    </VideoLanguageProvider>
  );
}
