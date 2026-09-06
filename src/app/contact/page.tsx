import type { Metadata } from "next";
import ContactPageView from "@/components/pages/ContactPage";
import PublicPlasmicPage from "@/components/plasmic/PublicPlasmicPage";
import { getSettingsSafe } from "@/lib/settings/store";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact DocuJet for consultations, demonstrations, printing support, and business document solution enquiries.",
};

export default async function ContactPage() {
  // Until now this page rendered `<ContactPageView />` with no props, so it
  // showed the hardcoded placeholders in site-data.ts while the footer three
  // scrolls above it showed the saved values. Same source for both now.
  const { business } = await getSettingsSafe();

  return (
    <PublicPlasmicPage
      path="/contact"
      fallback={
        <ContactPageView
          phone={business.phone}
          email={business.email}
          address={business.address}
          businessHours={business.hours}
        />
      }
    />
  );
}
