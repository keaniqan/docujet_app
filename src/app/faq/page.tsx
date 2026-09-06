import type { Metadata } from "next";
import FAQPage from "@/components/pages/FAQPage";
import PublicPlasmicPage from "@/components/plasmic/PublicPlasmicPage";
import { getContentSafe } from "@/lib/content/store";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about DocuJet consultations, demonstrations, booking, pricing, and support.",
};

export default async function FaqPage() {
  const { catalog, landing } = await getContentSafe();

  return (
    <PublicPlasmicPage
      path="/faq"
      fallback={
        <FAQPage
          faqItems={catalog.faq}
          ctaTitle={landing.ctaTitle}
          ctaDescription={landing.ctaDescription}
          ctaButtonText={landing.ctaButtonText}
          ctaButtonUrl={landing.ctaButtonUrl}
        />
      }
    />
  );
}
