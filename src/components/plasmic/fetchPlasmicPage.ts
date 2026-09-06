import { getServerPlasmicLoader, PLASMIC } from "@/plasmic-init";
import { resolveEnvMany } from "@/lib/settings/resolve";

type PlasmicPageData = Awaited<ReturnType<typeof PLASMIC.maybeFetchComponentData>>;

/**
 * Fetches a page's Plasmic design, or `null` when there is nothing to fetch.
 *
 * The name `maybeFetchComponentData` suggests this is already safe, but its
 * "maybe" only covers a project that has no such page: it throws on a missing
 * credential, a rejected token, and a Plasmic outage alike. Those all reached
 * `next build` as a prerender error, which is how a blank environment variable
 * turned into a failed deployment rather than into the coded fallback pages.
 *
 * So all three are treated the same way here, and the same way as "this page is
 * not in the project": return null, and let the caller render the version of
 * the page that lives in this repository. A site that renders its own
 * components is a far better outcome than a site that does not build.
 *
 * Logged rather than swallowed — falling back is fine, doing so silently for a
 * month is not.
 *
 * The credentials come from `resolveEnvMany`, not `process.env`: they are
 * editable on /superadmin/settings/system, and this is the only place in the
 * app where they are actually used to fetch anything. `getServerPlasmicLoader()`
 * hands back the module-level loader unchanged whenever the resolved pair is
 * the environment pair, which is the ordinary case.
 */
export async function fetchPlasmicPage(path: string): Promise<PlasmicPageData> {
  const { PLASMIC_PROJECT_ID, PLASMIC_API_TOKEN } = await resolveEnvMany([
    "PLASMIC_PROJECT_ID",
    "PLASMIC_API_TOKEN",
  ] as const);

  if (!PLASMIC_PROJECT_ID || !PLASMIC_API_TOKEN) {
    console.warn(
      `[plasmic] no project id / API token is configured — rendering ${path} from ` +
        "src/components/pages/ instead of the Studio design.",
    );
    return null;
  }

  try {
    const loader = await getServerPlasmicLoader();
    return await loader.maybeFetchComponentData(path);
  } catch (cause) {
    console.warn(
      `[plasmic] could not fetch ${path}, falling back to the coded page:`,
      cause instanceof Error ? cause.message : cause,
    );
    return null;
  }
}
