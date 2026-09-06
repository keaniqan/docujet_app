import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { getContentSafe } from "@/lib/content/store";
import { getSettingsSafe } from "@/lib/settings/store";

type PublicSiteFallbackProps = {
  children: React.ReactNode;
};

/**
 * The composition root for pages Plasmic Studio has nothing published for
 * (see `PublicPlasmicPage.tsx`) — the render path that must reflect live
 * admin-configured business info, since it's the only one not subject to
 * whatever a Plasmic editor has (or hasn't) authored.
 *
 * Uses `getSettingsSafe()`, not `getSettings()`: this is the composition
 * root for every non-Plasmic public page, so unreadable settings must
 * degrade to the default business info, never 500 the page.
 */
export default async function PublicSiteFallback({
  children,
}: PublicSiteFallbackProps) {
  const [{ business }, { social }] = await Promise.all([
    getSettingsSafe(),
    getContentSafe(),
  ]);

  return (
    <>
      <Navbar companyName={business.companyName} />
      <main>{children}</main>
      <Footer
        companyName={business.companyName}
        phone={business.phone}
        email={business.email}
        address={business.address}
        hours={business.hours}
        socialLinks={social.links}
      />
    </>
  );
}
