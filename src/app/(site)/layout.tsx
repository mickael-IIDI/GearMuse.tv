import { Shell } from "@/components/layout/shell";
import { getTheme } from "@/server/locale";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const theme = await getTheme();
  return <Shell theme={theme}>{children}</Shell>;
}
