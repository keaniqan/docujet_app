import type { Metadata } from "next";
import BookingPageView from "@/components/pages/BookingPage";
import PublicPlasmicPage from "@/components/plasmic/PublicPlasmicPage";
import { getContentSafe } from "@/lib/content/store";

export const metadata: Metadata = {
  title: "Book Appointment",
  description:
    "Request a consultation, demonstration, pricing discussion, or technical session with DocuJet.",
};

export default async function BookingPage() {
  const { catalog } = await getContentSafe();

  return (
    <PublicPlasmicPage
      path="/booking"
      fallback={
        <BookingPageView
          products={catalog.bookingProducts}
          types={catalog.bookingTypes}
        />
      }
    />
  );
}
