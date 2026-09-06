/**
 * The assistant's knowledge base: what goes in, and what comes back out.
 *
 * This is the half of the old n8n workflow that was doing retrieval. A question
 * is embedded (src/lib/chat/embeddings.ts), the nearest passages are fetched
 * from `kb_chunks` by cosine similarity, and src/lib/chat/prompt.ts pastes them
 * into the system prompt. Nothing else in the app reads these tables.
 *
 * Read and write live together here for the same reason they do in
 * src/lib/crm/leads.ts: `scripts/ingest-knowledge.ts` and the admin editor's
 * actions in `src/lib/chat/actions.ts` are callers like any other, and
 * splitting "the write half" into its own module would only make the row shapes
 * travel further from the query that reads them.
 *
 * Two writers, one table. The importer seeds and refreshes from the Q&A sheet;
 * a person edits in /superadmin/settings/chatbot. `ADMIN_SOURCE` below is the whole of the
 * protocol between them.
 *
 * Both halves go through the secret-key client, so this module is server-side
 * only — and carries no `server-only` marker, because the ingest script imports
 * it under plain Node where that marker throws.
 */

import { createHash } from "node:crypto";

import { isSupabaseConfigured, supabase } from "../supabase/service";
import { embed, embedOne, EMBEDDING_DIMENSIONS } from "./embeddings";

const DOCUMENTS_TABLE = "kb_documents";
const CHUNKS_TABLE = "kb_chunks";
const MATCH_FUNCTION = "match_kb_chunks";

export { isSupabaseConfigured as isKnowledgeConfigured };

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/**
 * One source of truth before it is cut up: a product, an FAQ entry, a section
 * of a brochure. `id` is a slug rather than a generated key so that re-ingesting
 * updates a document in place — see the migration's note on `kb_documents.id`.
 */
export type KnowledgeDocument = {
  id: string;
  title: string;
  /** Provenance for humans reading logs: 'site-data', 'knowledge/specs.md'. */
  source: string;
  /** A page on this site that covers the same ground, or null if there is none. */
  url: string | null;
  content: string;
};

/** A passage the search found, with how close it was. */
export type RetrievedChunk = {
  documentId: string;
  title: string;
  url: string | null;
  content: string;
  /** 0..1, cosine. Higher is closer. */
  similarity: number;
};

// ---------------------------------------------------------------------------
// Retrieval — the request path
// ---------------------------------------------------------------------------

export type RetrieveOptions = {
  /** Passages handed to the model. Enough for a spec question, few enough to stay cheap. */
  limit?: number;
  /**
   * Floor, 0..1. Below this a passage is treated as "the corpus does not cover
   * this" rather than "here is the closest thing in it" — with a corpus this
   * small, every question has a nearest neighbour, and most of them are noise.
   */
  minSimilarity?: number;
};

const DEFAULT_LIMIT = 6;

/**
 * Where "related" stops.
 *
 * Measured against this corpus rather than guessed, because gte-small's cosine
 * scores sit high and close together — nothing here ever scores 0.2, so a
 * textbook 0.3 floor would filter nothing at all. Over the 123 chunks and a
 * spread of questions:
 *
 *   on-topic, best match     0.836 .. 0.916
 *   off-topic, best match    0.760 .. 0.818   (weather, football, a poem)
 *
 * 0.8 sits in that gap, nearer the noise than the signal: an unusually phrased
 * printer question keeps its answer, and a question about the weather comes
 * back empty. The two bands are 0.02 apart, so this is a threshold to re-measure
 * whenever the corpus changes shape — and one that means nothing at all if the
 * embedding model changes, since the numbers are that model's, not the
 * language's.
 */
const DEFAULT_MIN_SIMILARITY = 0.8;

/**
 * Finds the passages most likely to answer a question.
 *
 * Degrades to `[]` rather than throwing on every failure it can have — no
 * Supabase project, an unapplied migration, an empty corpus, a model that will
 * not load. The assistant can still answer from the business facts and product
 * line in the system prompt; losing retrieval should make it less specific, not
 * make the panel show an error. Failures are logged, because an assistant that
 * has quietly stopped retrieving looks exactly like one that is merely vague.
 */
export async function retrieveContext(
  question: string,
  { limit = DEFAULT_LIMIT, minSimilarity = DEFAULT_MIN_SIMILARITY }: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  if (!isSupabaseConfigured()) {
    // Silent until now, which made an unconfigured deployment indistinguishable
    // from a working one whose corpus simply had no answer — the assistant
    // politely says "I don't know" to everything either way.
    console.warn(
      "[chat] SUPABASE_URL / SUPABASE_SECRET_KEY are not set — answering without the " +
        "knowledge base, so the assistant knows nothing about the products.",
    );
    return [];
  }

  let embedding: number[];
  try {
    embedding = await embedOne(question);
  } catch (cause) {
    console.warn(
      "[chat] could not embed the question, answering without retrieval:",
      cause instanceof Error ? cause.message : cause,
    );
    return [];
  }

  const { data, error } = await supabase().rpc(MATCH_FUNCTION, {
    query_embedding: embedding,
    match_count: limit,
    min_similarity: minSimilarity,
  });

  if (error) {
    console.warn(`[chat] knowledge search failed, answering without retrieval: ${error.message}`);
    return [];
  }

  const rows = (data ?? []) as {
    document_id: string;
    title: string;
    url: string | null;
    content: string;
    similarity: number;
  }[];

  return rows.map((row) => ({
    documentId: row.document_id,
    title: row.title,
    url: row.url,
    content: row.content,
    similarity: row.similarity,
  }));
}

// ---------------------------------------------------------------------------
// Writing — the ingest script and the admin editor
// ---------------------------------------------------------------------------

/** What the importer needs to know about a document it did not just build. */
export type StoredDocument = {
  hash: string;
  source: string;
};

/**
 * Every stored document's hash and source, keyed by id.
 *
 * Two questions in one round trip, because the importer asks both about every
 * document: has this changed (hash), and am I allowed to write it (source).
 */
export async function storedDocumentIndex(): Promise<Map<string, StoredDocument>> {
  const { data, error } = await supabase()
    .from(DOCUMENTS_TABLE)
    .select("id,content_hash,source")
    // PostgREST caps an unbounded select at its configured max-rows (1000 by
    // default). Asking for more than the corpus could plausibly hold makes the
    // cap visible as a warning below rather than as an ingest that mysteriously
    // re-embeds the same documents every run.
    .range(0, 9999);

  if (error) {
    throw new Error(`Could not read the knowledge base: ${error.message}`);
  }

  const rows = data as { id: string; content_hash: string; source: string }[];

  if (rows.length === 1000) {
    console.warn(
      "[kb] read exactly 1000 documents — this is probably PostgREST's row cap, and any " +
        "document past it will be re-embedded on every run.",
    );
  }

  return new Map(rows.map((row) => [row.id, { hash: row.content_hash, source: row.source }]));
}

/**
 * What "changed" means for a document.
 *
 * Everything that ends up either embedded or stored alongside the vectors, so
 * that correcting a title or a link rewrites the row and nothing else does.
 *
 * It lives here rather than in the ingest script because the admin editor
 * writes documents too, and two definitions of "changed" would mean an entry
 * saved from /superadmin/settings/chatbot looked stale to the importer the
 * moment it landed.
 * The separator is a NUL because it cannot occur in any of the three fields,
 * so no combination of them can collide with another.
 */
export function hashOf(document: KnowledgeDocument): string {
  return createHash("sha256")
    .update([document.title, document.url ?? "", document.content].join("\u0000"))
    .digest("hex");
}

/**
 * Writes one document and its chunks, replacing whatever was there.
 *
 * Delete-then-insert rather than a diff: chunk boundaries move when the text
 * moves, so "chunk 3" after an edit is not the same passage as "chunk 3" before
 * it, and matching them up would be work in service of a fiction. The delete
 * cascades to `kb_chunks` (see the migration), so the document is never left
 * holding vectors of text it no longer contains.
 *
 * Not a transaction — PostgREST has no way to span one. The window where a
 * document has no chunks is milliseconds long during an offline script, and its
 * only symptom would be an answer that missed one passage.
 */
export async function replaceDocument(
  document: KnowledgeDocument,
  chunks: string[],
  contentHash: string,
): Promise<number> {
  const vectors = await embed(chunks);

  const client = supabase();

  const { error: deleteError } = await client
    .from(DOCUMENTS_TABLE)
    .delete()
    .eq("id", document.id);
  if (deleteError) {
    throw new Error(`Could not replace ${document.id}: ${deleteError.message}`);
  }

  const { error: documentError } = await client.from(DOCUMENTS_TABLE).insert({
    id: document.id,
    title: document.title,
    source: document.source,
    url: document.url,
    // The text the chunks were cut from. Stored whole as well as in pieces so
    // the admin editor has something to show and to edit — reassembling it from
    // overlapping chunks would give back something subtly not what was written.
    content: document.content,
    content_hash: contentHash,
  });
  if (documentError) {
    throw new Error(`Could not write ${document.id}: ${documentError.message}`);
  }

  const { error: chunkError } = await client.from(CHUNKS_TABLE).insert(
    chunks.map((content, ordinal) => ({
      document_id: document.id,
      ordinal,
      content,
      embedding: vectors[ordinal],
    })),
  );
  if (chunkError) {
    throw new Error(`Could not write chunks for ${document.id}: ${chunkError.message}`);
  }

  return chunks.length;
}

/**
 * Removes documents outright.
 *
 * The only way anything leaves the knowledge base now that the importer no
 * longer prunes: a delete is something a person does in /superadmin/settings/chatbot, on
 * purpose, to an entry they have read. The chunks go with the document — the
 * foreign key cascades — so the assistant cannot be left quoting a passage
 * whose entry is gone.
 */
export async function deleteDocuments(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const { error } = await supabase().from(DOCUMENTS_TABLE).delete().in("id", ids);
  if (error) {
    throw new Error(`Could not delete from the knowledge base: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// The admin editor's view
// ---------------------------------------------------------------------------

/** One row of the table in /superadmin/settings/chatbot. */
export type KnowledgeEntry = KnowledgeDocument & {
  updatedAt: string;
};

/**
 * Every entry, for the admin table.
 *
 * Documents only — the chunks and their vectors are machinery, and an admin
 * editing an answer should never have to think about how it was cut up. Newest
 * first, so an entry someone just added or corrected is at the top of the list
 * they are looking at.
 *
 * Degrades to `[]` when Supabase is unconfigured, matching `retrieveContext()`:
 * the settings page must render on a laptop with no database rather than fail.
 */
export async function fetchKnowledgeEntry(id: string): Promise<KnowledgeEntry | null> {
  const { data, error } = await supabase()
    .from(DOCUMENTS_TABLE)
    .select("id,title,source,url,content,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read ${id}: ${error.message}`);
  }
  if (!data) return null;

  const row = data as {
    id: string;
    title: string;
    source: string;
    url: string | null;
    content: string;
    updated_at: string;
  };

  return {
    id: row.id,
    title: row.title,
    source: row.source,
    url: row.url,
    content: row.content,
    updatedAt: row.updated_at,
  };
}

export async function fetchKnowledgeEntries(): Promise<KnowledgeEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase()
    .from(DOCUMENTS_TABLE)
    .select("id,title,source,url,content,updated_at")
    .order("updated_at", { ascending: false })
    .range(0, 9999);

  if (error) {
    throw new Error(`Could not read the knowledge base: ${error.message}`);
  }

  return (
    data as {
      id: string;
      title: string;
      source: string;
      url: string | null;
      content: string;
      updated_at: string;
    }[]
  ).map((row) => ({
    id: row.id,
    title: row.title,
    source: row.source,
    url: row.url,
    content: row.content,
    updatedAt: row.updated_at,
  }));
}

/** Chunk count, for the ingest script's summary line and for a quick health check. */
export async function countChunks(): Promise<number> {
  const { count, error } = await supabase()
    .from(CHUNKS_TABLE)
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(`Could not count knowledge chunks: ${error.message}`);
  }

  return count ?? 0;
}

/** Re-exported so the ingest script can check the column width without reaching into the embedder. */
export { EMBEDDING_DIMENSIONS };
