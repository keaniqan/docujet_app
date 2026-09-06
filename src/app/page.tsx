import type { Metadata } from "next";
import HomePage from "@/components/pages/HomePage";
import PublicPlasmicPage from "@/components/plasmic/PublicPlasmicPage";
import { getContentSafe } from "@/lib/content/store";

export const metadata: Metadata = {
  title: "Printing & Document Solutions",
  description:
    "Professional printing, consultation, and document solutions for modern businesses.",
};

export default async function Home() {
  // The fallback is the page a visitor sees whenever Studio has nothing
  // published for "/", so it is the render path that has to carry live content.
  // `{...landing}` rather than twenty named props: LandingContent's field names
  // are HomePage's prop names, deliberately, so the two cannot drift apart.
  const { landing, catalog } = await getContentSafe();

  return (
    <PublicPlasmicPage
      path="/"
      fallback={
        <HomePage
          {...landing}
          benefits={catalog.benefits}
          services={catalog.services}
          faq={catalog.faq}
        />
      }
    />
  );
}
