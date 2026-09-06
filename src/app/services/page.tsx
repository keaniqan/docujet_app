import type { Metadata } from "next";
import ServicesPageView from "@/components/pages/ServicesPage";
import PublicPlasmicPage from "@/components/plasmic/PublicPlasmicPage";
import { getContentSafe } from "@/lib/content/store";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Explore the Epson WorkForce Enterprise product range and review the key details for each available model.",
};

export default async function ServicesPage() {
  // Only the shared call to action. The product photographs, spec bullets and
  // comparison matrix on this page are hardcoded in the component and stay
  // there — they are a data sheet, not copy, and editing them in a textarea
  // would be worse than editing them in the file.
  const { landing } = await getContentSafe();

  return (
    <PublicPlasmicPage
      path="/services"
      fallback={
        <ServicesPageView
          ctaTitle={landing.ctaTitle}
          ctaDescription={landing.ctaDescription}
          ctaButtonText={landing.ctaButtonText}
          ctaButtonUrl={landing.ctaButtonUrl}
        />
      }
    />
  );
}
