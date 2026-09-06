"use server";

/**
 * Knowledge base edits, from /superadmin/settings/chatbot.
 *
 * Mirrors `src/lib/crm/actions.ts`'s shape: read the input, write through the
 * store, refresh, report ok/message rather than throwing. A failed embed or an
 * unreachable database has to land as a line of text next to the control the
 * admin just touched, never as a 500 that loses the page they were working on.
 *
 * Every write here goes through `replaceDocument()`, which embeds before it
 * writes — so an entry is never stored without the vector that makes it
 * findable. That embedding runs in this process, on the CPU, and costs a few
 * milliseconds once the model is loaded (the `prebuild` step ships it inside
 * the deployment; see src/lib/chat/embeddings.ts).
 */

import { refresh } from "next/cache";

import { assertSuperadmin } from "@/lib/supabase/authorization";

import {
  ADMIN_SOURCE,
  chunkText,
  formatQnaContent,
  knowledgeSlug,
  parseQnaContent,
} from "./corpus";
import {
  deleteDocuments,
  fetchKnowledgeEntry,
  hashOf,
  replaceDocument,
  storedDocumentIndex,
  type KnowledgeDocument,
} from "./knowledge";

export type KnowledgeActionResult = {
  ok: boolean;
  message: string;
};

/** Long enough for a real answer, short enough that one entry stays one idea. */
const MAX_QUESTION_CHARS = 300;
const MAX_ANSWER_CHARS = 4000;

function failure(cause: unknown, fallback: string): KnowledgeActionResult {
  return { ok: false, message: cause instanceof Error ? cause.message : fallback };
}

const DENIED = "Only a superadmin can edit the knowledge base.";

/**
 * The guard, as a result rather than a throw.
 *
 * `src/proxy.ts` protects the page these are called from, but not the actions
 * themselves — a Server Action is a POST addressable by its action id, and
 * everything below writes with the RLS-bypassing service client. Returns
 * `null` when the caller may proceed.
 */
async function denied(): Promise<KnowledgeActionResult | null> {
  try {
    await assertSuperadmin(DENIED);
    return null;
  } catch (cause) {
    return failure(cause, DENIED);
  }
}

/**
 * A readable id for a new entry.
 *
 * Slugged from the question rather than generated, for the same reason the
 * sheet's ids are kept verbatim: `crm_leads.cited` records knowledge-base entry
 * ids against a chatbot-sourced lead, and 'admin-what-is-heat-free-technology'
 * can be looked up by a person where a uuid cannot. Numbered on collision — two
 * entries may legitimately start with the same words.
 *
 * The id does not follow later edits to the question. It is a key, not a
 * summary; renaming it would orphan any citation already recorded against it.
 */
function newEntryId(question: string, taken: Set<string>): string {
  const base = `${ADMIN_SOURCE}-${knowledgeSlug(question)}` || `${ADMIN_SOURCE}-entry`;

  if (!taken.has(base)) return base;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  // A thousand entries opening with the same words is not a real scenario, but
  // returning a duplicate id silently overwrites someone else's answer.
  throw new Error("Could not find an unused id for this question. Try rewording it.");
}

/**
 * Adds one Q&A entry.
 *
 * Written in the same layout the sheet importer produces (`formatQnaContent`),
 * so a typed entry and an imported one are indistinguishable to retrieval —
 * which is the point: the assistant should not answer differently depending on
 * where an answer came from.
 */
export async function addKnowledgeEntryAction(
  formData: FormData,
): Promise<KnowledgeActionResult> {
  const refusal = await denied();
  if (refusal) return refusal;

  const question = String(formData.get("question") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();
  const keywords = String(formData.get("keywords") ?? "")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword !== "");

  if (question === "") return { ok: false, message: "Write the question first." };
  if (answer === "") return { ok: false, message: "Write the answer first." };
  if (question.length > MAX_QUESTION_CHARS) {
    return { ok: false, message: `Keep the question under ${MAX_QUESTION_CHARS} characters.` };
  }
  if (answer.length > MAX_ANSWER_CHARS) {
    return { ok: false, message: `Keep the answer under ${MAX_ANSWER_CHARS} characters.` };
  }

  try {
    const existing = await storedDocumentIndex();

    const document: KnowledgeDocument = {
      id: newEntryId(question, new Set(existing.keys())),
      title: question,
      source: ADMIN_SOURCE,
      // Nothing on this site covers a hand-written entry, and an external link
      // is never shown to the model anyway — see referenceBlock() in prompt.ts.
      url: null,
      content: formatQnaContent({ question, answer, keywords }),
    };

    await replaceDocument(document, chunkText(document.content), hashOf(document));
    refresh();

    return { ok: true, message: `Added "${question}" to the knowledge base.` };
  } catch (cause) {
    return failure(cause, "Could not add the entry.");
  }
}

export type EditableKnowledgeField = "question" | "answer";

/**
 * Saves one inline edit.
 *
 * The whole entry is rewritten, not the one field: the stored text is a single
 * block that a question and an answer are formatted into, and it has to be
 * re-chunked and re-embedded either way, since changing either half changes
 * what the entry means and therefore where it sits in the vector space.
 *
 * Editing re-stamps the entry as admin-owned. That is what stops the next
 * `npm run kb:ingest` from restoring the sheet's original wording over a
 * correction someone made deliberately — the importer skips anything carrying
 * this source.
 */
export async function updateKnowledgeEntryAction(
  id: string,
  field: EditableKnowledgeField,
  value: string,
): Promise<KnowledgeActionResult> {
  const refusal = await denied();
  if (refusal) return refusal;

  const next = value.trim();

  if (next === "") {
    return {
      ok: false,
      message: field === "question" ? "A question cannot be empty." : "An answer cannot be empty.",
    };
  }

  const limit = field === "question" ? MAX_QUESTION_CHARS : MAX_ANSWER_CHARS;
  if (next.length > limit) {
    return { ok: false, message: `Keep the ${field} under ${limit} characters.` };
  }

  try {
    // Read the entry as it currently stands rather than trusting what the
    // browser had on screen — the other half of the pair may have been edited
    // in another tab since this row was rendered.
    const entry = await fetchKnowledgeEntry(id);

    if (!entry) {
      return { ok: false, message: `${id} no longer exists.` };
    }

    const parsed = parseQnaContent(entry.content);
    const question = field === "question" ? next : parsed.question;
    const answer = field === "answer" ? next : parsed.answer;

    const document: KnowledgeDocument = {
      id: entry.id,
      // The title is what retrieval shows the model above each passage, so it
      // has to follow the question rather than keep the wording that was first
      // imported.
      title: question || entry.title,
      source: ADMIN_SOURCE,
      url: entry.url,
      content: formatQnaContent({ question, answer, keywords: parsed.keywords }),
    };

    await replaceDocument(document, chunkText(document.content), hashOf(document));
    refresh();

    return { ok: true, message: `${id} updated.` };
  } catch (cause) {
    return failure(cause, "Could not save the entry.");
  }
}

/**
 * Removes one entry for good.
 *
 * There is no undo and no tombstone: the importer no longer prunes, so nothing
 * will put this back, and nothing else remembers it. The UI asks first.
 */
export async function deleteKnowledgeEntryAction(id: string): Promise<KnowledgeActionResult> {
  const refusal = await denied();
  if (refusal) return refusal;

  try {
    await deleteDocuments([id]);
    refresh();
    return { ok: true, message: `${id} removed from the knowledge base.` };
  } catch (cause) {
    return failure(cause, "Could not remove the entry.");
  }
}
