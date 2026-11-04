import type { Metadata } from "next";
import { LibraryList } from "@/components/library/library-list";

export const metadata: Metadata = { title: "Favoris", robots: { index: false } };

export default function Page() {
  return <LibraryList mode="favorites" />;
}
