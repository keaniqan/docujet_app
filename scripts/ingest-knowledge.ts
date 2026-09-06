/**
 * Builds the chat assistant's knowledge base.
 *
 *   npm run kb:ingest                  -- embed anything new or changed
 *   npm run kb:ingest -- --force       -- re-embed everything
 *   npm run kb:ingest -- --dry-run     -- list what would change, write nothing
 *   npm run kb:ingest -- --csv=path    -- read a different Q&A sheet
 *
 * Three sources, in descending order of how much the assistant leans on them:
 *
 *   data/epson workforce rag.csv  the curated Q&A sheet — 111 verified answers
 *                                 from the WorkForce Enterprise brochure. This
 *                                 is the assistant's actual knowledge. It is
 *                                 gitignored (see .gitignore's `data`), so a
 *                                 fresh clone has to be given a copy.
 *   src/lib/site-data.ts          the website's own product copy, benefits, FAQ
 *                                 and booking flow, so the assistant and the
 *                                 pages cannot contradict each other.
 *   knowledge/*.md                free-form documents to drop in later — a spec
 *                                 sheet, a service agreement, a price list.
 *                                 The directory need not exist.
 *
 * Re-running is cheap and safe. Documents are keyed by a stable id and matched
 * on a content hash, so an unchanged document is never re-embedded and a changed
 * one is replaced whole. That matters because embedding runs on this machine's
 * CPU (see src/lib/chat/embeddings.ts) — the first run loads a model and takes a
 * minute; a re-run after editing three rows takes seconds.
 *
 * ---------------------------------------------------------------------------
 * This script seeds and refreshes. It does not own the knowledge base.
 *
 * The database is the source of truth, and /superadmin/settings/chatbot is
 * where entries are added, corrected and removed. Two consequences worth
 * knowing before running this:
 *
 *   - It never deletes. Removing a row from the sheet leaves the entry in the
 *     database; deleting it is something a person does in the admin screen.
 *   - It never overwrites an entry whose stored source is 'admin'. Editing an
 *     entry there claims it, and this script leaves it alone from then on —
 *     otherwise the next import would silently undo the correction.
 * ---------------------------------------------------------------------------
 *
 * Runs outside Next, which is why nothing it imports carries a `server-only`
 * marker, and why it goes through `tsx` rather than Node's own type stripping —
 * the same reasoning as scripts/seed-leads.ts.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import {
  ADMIN_SOURCE,
  chunkText,
  qnaDocuments,
  siteKnowledgeDocuments,
} from "../src/lib/chat/corpus";
import { warmEmbeddings } from "../src/lib/chat/embeddings";
import {
  countChunks,
  hashOf,
  replaceDocument,
  storedDocumentIndex,
  type KnowledgeDocument,
} from "../src/lib/chat/knowledge";
import { isSupabaseConfigured } from "../src/lib/supabase/service";

/** Where the Q&A sheet lives unless `--csv=` says otherwise. */
const DEFAULT_CSV = path.join("data", "epson workforce rag.csv");

/** Markdown dropped here is ingested as-is. Absent is fine — most projects will not have one. */
const MARKDOWN_DIR = "knowledge";

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

async function readIfPresent(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw cause;
  }
}

/**
 * The markdown drop-box.
 *
 * One document per file rather than per heading: chunking already splits on
 * paragraphs, and a document per file keeps the id stable while someone is
 * still editing the headings.
 */
async function markdownDocuments(): Promise<KnowledgeDocument[]> {
  let entries: string[];
  try {
    entries = await readdir(MARKDOWN_DIR);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw cause;
  }

  const documents: KnowledgeDocument[] = [];

  for (const entry of entries.filter((name) => name.toLowerCase().endsWith(".md")).sort()) {
    const file = path.join(MARKDOWN_DIR, entry);
    const content = (await readFile(file, "utf8")).trim();
    if (content === "") continue;

    const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const name = entry.replace(/\.md$/i, "");

    documents.push({
      id: `doc-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: heading || name,
      source: file.replace(/\\/g, "/"),
      url: null,
      content,
    });
  }

  return documents;
}

async function gather(csvPath: string): Promise<KnowledgeDocument[]> {
  const documents: KnowledgeDocument[] = [];

  const csv = await readIfPresent(csvPath);
  if (csv === null) {
    // Not fatal — site-data alone still produces a working, if thin, assistant.
    // Loud, though: this file is the reason the assistant knows anything.
    console.warn(
      `! ${csvPath} not found. Skipping the Q&A sheet; the assistant will only know what the ` +
        "website says. Pass --csv=<path> if it lives somewhere else.",
    );
  } else {
    documents.push(...qnaDocuments(csv, csvPath.replace(/\\/g, "/")));
  }

  documents.push(...siteKnowledgeDocuments());
  documents.push(...await markdownDocuments());

  // Two documents sharing an id would silently overwrite each other, and which
  // one survived would depend on the order they were gathered in.
  const seen = new Set<string>();
  for (const document of documents) {
    if (seen.has(document.id)) {
      throw new Error(
        `Duplicate knowledge document id '${document.id}'. Ids come from the sheet's 'lead' ` +
          "column and from filenames; both must be unique across every source.",
      );
    }
    seen.add(document.id);
  }

  return documents;
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env before ingesting. See .env.example.",
    );
  }

  const force = process.argv.includes("--force");
  const dryRun = process.argv.includes("--dry-run");
  const csvPath =
    process.argv.find((argument) => argument.startsWith("--csv="))?.slice("--csv=".length) ??
    DEFAULT_CSV;

  const documents = await gather(csvPath);
  console.log(`Gathered ${documents.length} documents.`);

  const stored = await storedDocumentIndex();

  // Entries a person has added or corrected in /superadmin/settings/chatbot. The sheet has
  // no claim on them: re-importing over a deliberate correction is exactly the
  // failure this rule exists to prevent.
  const owned = documents.filter((document) => stored.get(document.id)?.source === ADMIN_SOURCE);

  const changed = documents.filter((document) => {
    const existing = stored.get(document.id);
    if (existing?.source === ADMIN_SOURCE) return false;
    return force || existing?.hash !== hashOf(document);
  });

  if (owned.length > 0) {
    console.log(
      `Leaving ${owned.length} admin-edited document(s) alone: ${owned
        .map((document) => document.id)
        .join(", ")}`,
    );
  }

  if (changed.length === 0) {
    console.log(`Nothing to do — all ${documents.length} documents are up to date.`);
    return;
  }

  if (dryRun) {
    console.log(`Would embed ${changed.length} document(s):`);
    for (const document of changed) console.log(`  ${document.id}  ${document.title}`);
    return;
  }

  if (changed.length > 0) {
    // The first run downloads ~33 MB of model weights before it can embed
    // anything. Announcing it is the difference between a slow start and an
    // apparent hang.
    console.log("Loading the embedding model (first run downloads it)...");
    await warmEmbeddings();
  }

  let written = 0;
  for (const [at, document] of changed.entries()) {
    const chunks = chunkText(document.content);
    if (chunks.length === 0) {
      console.warn(`  [${at + 1}/${changed.length}] ${document.id} — empty, skipped`);
      continue;
    }

    await replaceDocument(document, chunks, hashOf(document));
    written += 1;
    console.log(
      `  [${at + 1}/${changed.length}] ${document.id} — ${chunks.length} chunk${
        chunks.length === 1 ? "" : "s"
      }`,
    );
  }

  console.log(
    `Done. ${written} document(s) embedded; the knowledge base now holds ${await countChunks()} chunks.`,
  );
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : cause);
  process.exitCode = 1;
});
