/**
 * Persistence for website content.
 *
 * One table, `site_content`, holding one jsonb document per block — see
 * `supabase/migrations/0010_site_content_and_system_config.sql`. Modelled on
 * `src/lib/settings/store.ts` and sharing its client, its
 * configured-or-degrade rule, and its merge-over-defaults behaviour.
 *
 * The one difference worth naming: a block is merged one level deep rather than
 * replaced wholesale. A stored `landing` document written before a new heading
 * was added would otherwise take that heading away from the page, and a content
 * store that can silently un-ship a section is worse than no content store.
 */

import { isSupabaseConfigured, supabase } from "../supabase/service";
import { DEFAULT_CONTENT } from "./defaults";
import { CONTENT_BLOCK_KEYS, type ContentBlockKey, type SiteContent } from "./types";

const TABLE = "site_content";

export { isSupabaseConfigured as isContentConfigured };

type Row = { key: string; value: unknown };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merges one stored document onto its default.
 *
 * Shallow: a block's own fields are replaced individually, so a key the stored
 * document has never heard of keeps the value that ships in `src/`. Arrays are
 * taken whole — a stored FAQ of five entries means five, not five merged over
 * the shipped seven.
 */
function mergeBlock<K extends ContentBlockKey>(
  key: K,
  stored: unknown,
): SiteContent[K] {
  const base = DEFAULT_CONTENT[key];
  if (!isPlainObject(stored)) return base;

  // `tooltips` is a free-form map rather than a fixed shape: every stored entry
  // is meaningful, and there is no default to fall back to field by field.
  if (key === "tooltips") return stored as SiteContent[K];

  return { ...(base as Record<string, unknown>), ...stored } as SiteContent[K];
}

function mergeRows(rows: Row[]): SiteContent {
  const found = new Map(rows.map((row) => [row.key, row.value]));
  const out = {} as SiteContent;

  for (const key of CONTENT_BLOCK_KEYS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (out as any)[key] = mergeBlock(key, found.get(key));
  }

  return out;
}

/**
 * Reads website content.
 *
 * Returns `DEFAULT_CONTENT` with no network call when Supabase is not
 * configured, which is what makes the CMS page and every page it feeds fully
 * renderable with zero backend setup. Configured-but-unreachable still throws —
 * `getContentSafe()` is for callers that must not.
 */
export async function getContent(): Promise<SiteContent> {
  if (!isSupabaseConfigured()) return DEFAULT_CONTENT;

  const { data, error } = await supabase().from(TABLE).select("key,value");
  if (error) {
    throw new Error(`Could not read website content: ${error.message}`);
  }

  return mergeRows((data ?? []) as Row[]);
}

/**
 * `getContent()`, but falling back to the shipped copy on any failure.
 *
 * For every public page: a visitor must never see an error because the content
 * table is unreachable, and the coded defaults are a complete, correct site.
 * Logged rather than swallowed, so an unapplied migration is visible somewhere.
 */
export async function getContentSafe(): Promise<SiteContent> {
  try {
    return await getContent();
  } catch (cause) {
    console.warn(
      "[content] could not read website content, using defaults:",
      cause instanceof Error ? cause.message : cause,
    );
    return DEFAULT_CONTENT;
  }
}

/** Writes one block, replacing the stored document for that key. */
export async function updateContentBlock<K extends ContentBlockKey>(
  key: K,
  value: SiteContent[K],
): Promise<void> {
  const { error } = await supabase()
    .from(TABLE)
    .upsert([{ key, value }], { onConflict: "key" });

  if (error) {
    throw new Error(`Could not save website content: ${error.message}`);
  }
}

/** Removes a block's overrides, putting the shipped copy back. */
export async function resetContentBlock(key: ContentBlockKey): Promise<void> {
  const { error } = await supabase().from(TABLE).delete().eq("key", key);
  if (error) {
    throw new Error(`Could not restore the shipped content: ${error.message}`);
  }
}
