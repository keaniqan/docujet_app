import { redirect } from "next/navigation";

/**
 * Settings moved to /superadmin/settings.
 *
 * Kept as a redirect rather than deleted: this was the only settings URL for
 * the life of the project, so it is in bookmarks and in the browser history of
 * everyone who has used the admin. An admin who is not a superadmin lands on
 * /superadmin/settings/system and is turned back to /admin by the proxy, which
 * is the correct answer to "may I see this?" and a better one than a 404.
 */
export default function AdminSettingsRedirect() {
  redirect("/superadmin/settings/system");
}
