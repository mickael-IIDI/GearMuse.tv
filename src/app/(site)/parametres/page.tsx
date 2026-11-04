import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { getI18n, getTheme } from "@/server/locale";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Paramètres", robots: { index: false } };

export default async function SettingsPage() {
  const [{ t }, theme] = await Promise.all([getI18n(), getTheme()]);
  return (
    <>
      <PageHeader title={t.settings.title} />
      <SettingsForm theme={theme} />
    </>
  );
}
