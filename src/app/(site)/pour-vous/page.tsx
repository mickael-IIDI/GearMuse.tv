import type { Metadata } from "next";
import { ForYouFeed } from "./feed";

export const metadata: Metadata = { title: "Pour vous", robots: { index: false } };

export default function ForYouPage() {
  return <ForYouFeed />;
}
