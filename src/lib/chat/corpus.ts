/**
 * What the assistant is made to know, and how it is cut up.
 *
 * All of it pure: callers do the reading and the writing, this module does the
 * deciding. `npm run kb:ingest` uses the whole file; the editor in
 * /superadmin/settings/chatbot uses the Q&A format/parse pair,
 * `knowledgeSlug()` and `chunkText()`, so an entry a person types is shaped
 * exactly like an entry the importer produced.
 *
 *   1. `qnaDocuments()` turns the curated Q&A sheet (data/epson workforce
 *      rag.csv) into documents. This is the assistant's real knowledge: 111
 *      verified answers drawn from the WorkForce Enterprise brochure, each one
 *      already written the way a person would want it answered.
 *
 *   2. `siteKnowledgeDocuments()` turns src/lib/site-data.ts — the same product
 *      copy, benefits and FAQ answers the public pages render — into documents,
 *      so the site and the assistant cannot disagree about what the site says.
 *      It also covers what the sheet does not: how to book, and what the
 *      booking form asks for.
 *
 *   3. `chunkText()` splits a document into passages small enough that six of
 *      them fit comfortably in a prompt and specific enough that a similarity
 *      search can tell them apart. Most Q&A rows come out as a single chunk;
 *      the markdown files under `knowledge/` are what it is really for.
 *
 * Business contact details are deliberately absent. They live in editable
 * settings, and an embedded copy would go stale the moment an admin changed the
 * phone number — src/lib/chat/prompt.ts reads them fresh on every question
 * instead.
 */

import {
  benefitItems,
  bookingProducts,
  bookingTypes,
  faqItems,
  serviceItems,
  whyChooseItems,
} from "../site-data";
import type { KnowledgeDocument } from "./knowledge";

/** Source label stored on every document `siteKnowledgeDocuments()` produces. */
export const SITE_DATA_SOURCE = "site-data";

/**
 * Source label on anything a person has added or edited in
 * /superadmin/settings/chatbot.
 *
 * The whole protocol between the two writers of `kb_documents`: the importer
 * refuses to touch a document carrying this, so a correction made by hand is
 * not quietly reverted by the next `npm run kb:ingest`.
 *
 * It lives here, with the other source label, rather than next to the database
 * code — the admin table is a Client Component and needs to recognise it, and
 * this module is pure while `knowledge.ts` reaches for the database and the
 * embedder.
 */
export const ADMIN_SOURCE = "admin";

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * The website's own copy, as documents.
 *
 * One document per product and per FAQ entry, because those are the units a
 * visitor asks about; the range-wide selling points are collected into one,
 * because individually they are single sentences with nothing to distinguish
 * their vectors from one another.
 */
export function siteKnowledgeDocuments(): KnowledgeDocument[] {
  const documents: KnowledgeDocument[] = [];

  for (const product of serviceItems) {
    documents.push({
      id: `product-${slug(product.title)}`,
      title: `WorkForce Enterprise ${product.title}`,
      source: SITE_DATA_SOURCE,
      url: "/services",
      content: `${product.title}\n\n${product.description}`,
    });
  }

  documents.push({
    id: "range-benefits",
    title: "WorkForce Enterprise range — benefits",
    source: SITE_DATA_SOURCE,
    url: "/",
    content: [
      "Why the Epson WorkForce Enterprise range:",
      ...benefitItems.map((item) => `${item.title}: ${item.description}`),
      ...whyChooseItems.map((item) => `- ${item}`),
    ].join("\n"),
  });

  for (const item of faqItems) {
    documents.push({
      id: `faq-${slug(item.question)}`,
      title: item.question,
      source: SITE_DATA_SOURCE,
      url: "/faq",
      content: `Question: ${item.question}\n\nAnswer: ${item.answer}`,
    });
  }

  documents.push({
    id: "booking-consultation",
    title: "Booking a consultation",
    source: SITE_DATA_SOURCE,
    url: "/booking",
    content: [
      "Visitors can book a consultation on the booking page. The form asks which product they",
      "are interested in and what kind of appointment they want.",
      "",
      `Products that can be selected: ${bookingProducts.join("; ")}.`,
      `Appointment types: ${bookingTypes.join("; ")}.`,
    ].join("\n"),
  });

  return documents;
}

// ---------------------------------------------------------------------------
// The curated Q&A sheet
// ---------------------------------------------------------------------------

/**
 * Columns the sheet is expected to have. Extra columns are ignored; a missing
 * one is an error, because a sheet that has been re-exported with different
 * headers should stop the run rather than quietly ingest blank answers.
 */
const QNA_COLUMNS = ["lead", "question", "answer", "category", "tags", "source_url", "status"] as const;

/**
 * Only rows marked this way are ingested.
 *
 * Everything in the sheet today is `verified`, which is exactly why the check
 * is worth having: it is what makes adding a `draft` row to the sheet a safe
 * thing to do.
 */
const INGESTED_STATUS = "verified";

/**
 * Turns the Q&A sheet into documents.
 *
 * The `lead` column becomes the document id verbatim ('EPSON-042'). That is not
 * cosmetic: `crm_leads.cited` already exists to record "knowledge-base entry
 * ids" against a chatbot-sourced lead, and keeping the sheet's own ids means a
 * citation recorded there can be looked up by a human in the sheet.
 *
 * `note` is dropped. It carries the same brochure-provenance sentence on every
 * row, and identical text on every row is the one thing guaranteed to make a
 * hundred embeddings look more alike than they are.
 *
 * @param csv Raw file contents, byte-order mark and all.
 * @param source Provenance label stored on each document, e.g. the file path.
 */
export function qnaDocuments(csv: string, source: string): KnowledgeDocument[] {
  const rows = parseCsv(csv);
  if (rows.length === 0) return [];

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const index = (column: string): number => {
    const at = header.indexOf(column);
    if (at === -1) {
      throw new Error(
        `${source} has no '${column}' column. Expected: ${QNA_COLUMNS.join(", ")}.`,
      );
    }
    return at;
  };

  const columns = Object.fromEntries(
    QNA_COLUMNS.map((column) => [column, index(column)]),
  ) as Record<(typeof QNA_COLUMNS)[number], number>;

  const documents: KnowledgeDocument[] = [];

  for (const row of rows.slice(1)) {
    // Trailing blank line, or a row the export truncated.
    if (row.length < header.length) continue;

    const cell = (column: (typeof QNA_COLUMNS)[number]): string => row[columns[column]].trim();

    const id = cell("lead");
    const question = cell("question");
    const answer = cell("answer");

    if (id === "" || question === "" || answer === "") continue;
    if (cell("status").toLowerCase() !== INGESTED_STATUS) continue;

    // Tags and category ride along with the text they describe. They are the
    // only place a model code appears as a bare token ('wf-c20600'), which is
    // what a question like "specs for the C20600?" has to match against.
    const keywords = [cell("category"), ...cell("tags").split(";")]
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword !== "");

    documents.push({
      id,
      title: question,
      source,
      // Kept for provenance. These point at Epson's own site rather than at a
      // page here, and src/lib/chat/prompt.ts only ever shows the model the
      // relative ones — see the note there on what it is allowed to link to.
      url: cell("source_url") || null,
      content: formatQnaContent({ question, answer, keywords }),
    });
  }

  return documents;
}

export type QnaContent = {
  question: string;
  answer: string;
  keywords: string[];
};

/**
 * The layout a Q&A entry is stored in.
 *
 * Paired with `parseQnaContent()` below, and the only place this shape is
 * written. It matters that there is exactly one definition: the sheet importer
 * produces it, the admin editor in /superadmin/settings/chatbot reads it back apart and
 * writes it again, and a drift between those two would quietly turn an edited
 * answer into an unparseable blob.
 */
export function formatQnaContent({ question, answer, keywords }: QnaContent): string {
  return [
    `Question: ${question}`,
    "",
    `Answer: ${answer}`,
    keywords.length > 0 ? `\nKeywords: ${keywords.join(", ")}` : "",
  ]
    .join("\n")
    .trim();
}

/**
 * Takes a stored entry back apart.
 *
 * Deliberately forgiving, because not every document is Q&A-shaped: the twelve
 * entries generated from site-data.ts are prose, and a markdown file dropped in
 * `knowledge/` is whatever its author wrote. Anything without the `Question:`
 * marker comes back as an answer with no question, which is what lets the admin
 * table show one row per document rather than one row per document it happens
 * to recognise.
 */
export function parseQnaContent(content: string): QnaContent {
  const normalized = content.replace(/\r\n/g, "\n").trim();

  const match = normalized.match(
    /^Question:\s*([\s\S]*?)\n\s*Answer:\s*([\s\S]*?)(?:\n\s*Keywords:\s*([\s\S]*))?$/,
  );

  if (!match) {
    return { question: "", answer: normalized, keywords: [] };
  }

  return {
    question: match[1].trim(),
    answer: match[2].trim(),
    keywords: (match[3] ?? "")
      .split(",")
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword !== ""),
  };
}

/** Shared with the admin editor, which needs the same ids the importer would produce. */
export { slug as knowledgeSlug };

/**
 * A CSV reader, in the RFC 4180 sense: quoted fields, doubled quotes inside
 * them, and newlines inside quotes.
 *
 * Written out rather than pulled from npm because this is the whole of what the
 * project needs a CSV library for, it runs once per ingest against a file this
 * project controls, and it is thirty lines. A dependency here would be carried
 * by `next build` forever to serve a script that runs by hand.
 *
 * The leading byte-order mark that Excel and Sheets write is stripped: left in,
 * it would make the first header 'lead' fail to match 'lead'.
 */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const endField = () => {
    row.push(field);
    field = "";
  };

  const endRow = () => {
    endField();
    // A blank line is not a row of one empty field.
    if (!(row.length === 1 && row[0].trim() === "")) rows.push(row);
    row = [];
  };

  for (let at = 0; at < input.length; at += 1) {
    const character = input[at];

    if (quoted) {
      if (character !== '"') {
        field += character;
      } else if (input[at + 1] === '"') {
        field += '"';
        at += 1;
      } else {
        quoted = false;
      }
      continue;
    }

    switch (character) {
      case '"':
        quoted = true;
        break;
      case ",":
        endField();
        break;
      case "\r":
        break;
      case "\n":
        endRow();
        break;
      default:
        field += character;
    }
  }

  if (field !== "" || row.length > 0) endRow();

  return rows;
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

/**
 * Target size of a passage, in characters.
 *
 * Chosen from what a passage has to do at both ends. Small enough that six of
 * them plus the conversation stay a modest prompt, and that one embedding
 * describes one idea rather than averaging four; large enough that a spec and
 * the sentence explaining it are rarely torn apart. Characters rather than
 * tokens because the split points are paragraph boundaries either way — the
 * precision a tokenizer would add has nothing here to spend itself on.
 */
const MAX_CHUNK_CHARS = 900;

/**
 * How much of the previous passage each one repeats.
 *
 * Insurance against the boundary landing mid-answer: a question whose answer
 * straddles a split still matches a passage that contains all of it. Costs a
 * little duplication in the table and nothing at query time.
 */
const OVERLAP_CHARS = 150;

/** Below this, a trailing fragment is folded back into the previous passage rather than stored alone. */
const MIN_CHUNK_CHARS = 80;

/**
 * Splits text into overlapping passages, preferring paragraph breaks.
 *
 * Paragraphs are accumulated until adding the next one would overflow. A single
 * paragraph longer than the target is split on sentence ends, and only failing
 * that on a hard character boundary — which is what a wall of specifications
 * with no full stops in it will hit.
 */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized === "") return [];
  if (normalized.length <= MAX_CHUNK_CHARS) return [normalized];

  const paragraphs = normalized.split(/\n{2,}/).flatMap(splitOversizedParagraph);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (current === "") {
      current = paragraph;
      continue;
    }

    if (current.length + paragraph.length + 2 <= MAX_CHUNK_CHARS) {
      current = `${current}\n\n${paragraph}`;
      continue;
    }

    chunks.push(current);
    current = OVERLAP_CHARS > 0 ? `${tail(current)}\n\n${paragraph}` : paragraph;
  }

  if (current !== "") {
    // A last scrap on its own embeds badly — too little text to mean anything —
    // so it goes back where it came from.
    if (chunks.length > 0 && current.length < MIN_CHUNK_CHARS) {
      chunks[chunks.length - 1] = `${chunks[chunks.length - 1]}\n\n${current}`;
    } else {
      chunks.push(current);
    }
  }

  return chunks;
}

/** The last whole sentence(s) of a passage, up to the overlap budget. */
function tail(chunk: string): string {
  const slice = chunk.slice(-OVERLAP_CHARS);
  const boundary = slice.search(/[.!?]\s/);
  return (boundary === -1 ? slice : slice.slice(boundary + 2)).trim();
}

function splitOversizedParagraph(paragraph: string): string[] {
  const trimmed = paragraph.trim();
  if (trimmed.length <= MAX_CHUNK_CHARS) return trimmed === "" ? [] : [trimmed];

  const sentences = trimmed.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [trimmed];

  const parts: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const piece = sentence.trim();
    if (piece === "") continue;

    if (current === "") {
      current = piece;
    } else if (current.length + piece.length + 1 <= MAX_CHUNK_CHARS) {
      current = `${current} ${piece}`;
    } else {
      parts.push(current);
      current = piece;
    }

    // A "sentence" longer than the target has no punctuation to cut on — a
    // specification table pasted as one line, most likely. Cut it anyway.
    while (current.length > MAX_CHUNK_CHARS) {
      parts.push(current.slice(0, MAX_CHUNK_CHARS));
      current = current.slice(MAX_CHUNK_CHARS);
    }
  }

  if (current !== "") parts.push(current);

  return parts;
}
