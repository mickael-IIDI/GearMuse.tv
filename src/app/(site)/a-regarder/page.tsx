import type { Metadata } from "next";
import { LibraryList } from "@/components/library/library-list";

export const metadata: Metadata = { title: "À regarder plus tard", robots: { index: false } };

export default function Page() {
  return <LibraryList mode="later" />;
}
