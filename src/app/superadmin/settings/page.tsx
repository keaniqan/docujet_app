import { redirect } from "next/navigation";

/**
 * `/superadmin/settings` is not a page of its own.
 *
 * There is no useful overview to show above three sections that each want the
 * full width, so the bare path lands on the first of them rather than on a menu
 * whose only job is to be clicked through.
 */
export default function SuperadminSettingsIndex() {
  redirect("/superadmin/settings/system");
}
