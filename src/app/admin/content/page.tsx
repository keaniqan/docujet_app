import { redirect } from "next/navigation";

/**
 * Website content moved to /superadmin/settings/cms.
 *
 * What used to be here was a placeholder: four cards linking to Plasmic Studio
 * URLs that did not exist and an "Edit Content" button with no handler. The
 * real editor now lives in the settings area, behind the superadmin guard.
 */
export default function AdminContentRedirect() {
  redirect("/superadmin/settings/cms");
}
