"use client";

/**
 * How the assistant behaves, short of what it knows.
 *
 * Lifted out of the old single `SettingsForm` when settings became three pages.
 * The knowledge base sits beside this rather than inside it: `KnowledgeManager`
 * has a form of its own for adding an entry, and forms do not nest.
 */

import { useState, useTransition } from "react";
import { Field, Panel, RepeatableList, SaveRow } from "./Fields";
import { inputClassName, pillButtonClassName } from "./field-styles";
import {
  updateChatConfigAction,
  type SettingsActionResult,
} from "@/lib/settings/actions";
import type { SafeSiteSettings } from "@/lib/settings/mask";

type ChatConfigFormProps = {
  chat: SafeSiteSettings["chat"];
  /** The live `DEEPSEEK_MODEL`, and where it came from. */
  model: { value: string; source: string };
  /**
   * The brief as it ships, for the Restore default button. Passed down rather
   * than imported so this client bundle does not pull in chat/prompt.ts.
   */
  defaultSystemPrompt: string;
};

export default function ChatConfigForm({
  chat,
  model,
  defaultSystemPrompt,
}: ChatConfigFormProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SettingsActionResult | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(
    chat.suggestions.length > 0 ? chat.suggestions : [""],
  );
  // Controlled, unlike its neighbours, only so that Restore default can put the
  // shipped text back without a page reload.
  const [systemPrompt, setSystemPrompt] = useState(chat.systemPrompt);

  function onSubmit(formData: FormData) {
    // Controlled separately from the rest of the form, since it is a
    // variable-length list rather than a fixed input — replace whatever the
    // browser collected for "suggestions" with the current in-memory list.
    formData.delete("suggestions");
    for (const suggestion of suggestions) {
      if (suggestion.trim() !== "") formData.append("suggestions", suggestion);
    }

    startTransition(async () => {
      setResult(await updateChatConfigAction(formData));
    });
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <Panel
        title="Conversation"
        description="What the assistant opens with, and what it is told to be."
      >
        <div className="space-y-5">
          <Field label="Greeting" caption="Shown when a visitor opens the chat panel.">
            <textarea
              name="greeting"
              rows={2}
              defaultValue={chat.greeting}
              className={inputClassName}
            />
          </Field>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="block text-sm font-medium text-slate-700">System prompt</span>
              <button
                type="button"
                onClick={() => setSystemPrompt(defaultSystemPrompt)}
                disabled={systemPrompt === defaultSystemPrompt}
                className={pillButtonClassName}
              >
                Restore default
              </button>
            </div>
            <textarea
              name="systemPrompt"
              rows={16}
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              spellCheck={false}
              className={`${inputClassName} font-mono text-xs leading-6`}
            />
            <p className="mt-2 text-xs leading-6 text-slate-500">
              The assistant&apos;s instructions. The business details from the Content tab and the
              matching knowledge base entries below are appended automatically on every question —
              write rules here, not facts. Clearing this box restores the default.
            </p>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Suggested questions
            </span>
            <RepeatableList
              name="suggestions"
              values={suggestions}
              onChange={setSuggestions}
              addLabel="Add suggestion"
            />
          </div>
        </div>
      </Panel>

      <Panel
        title="Model"
        description="Which DeepSeek model answers. The API key that reaches it is a credential, and lives on the System Config tab."
      >
        <Field
          label="Model"
          caption={
            <>
              <code className="font-mono">DEEPSEEK_MODEL</code> — currently{" "}
              <code className="font-mono">{model.value || "deepseek-v4-flash"}</code> (
              {model.source}). Blank falls back to the shipped default.
            </>
          }
        >
          <input
            name="DEEPSEEK_MODEL"
            defaultValue={model.source === "database" ? model.value : ""}
            placeholder="deepseek-v4-flash"
            className={inputClassName}
          />
        </Field>
      </Panel>

      <Panel
        title="Retrieval"
        description="How much of the knowledge base the assistant is allowed to see per question, and how close a passage has to be before it counts as relevant."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Passages per question" caption="Was DEFAULT_LIMIT in chat/knowledge.ts.">
            <input
              name="retrievalLimit"
              type="number"
              min={1}
              max={20}
              defaultValue={chat.retrievalLimit}
              className={inputClassName}
            />
          </Field>
          <Field
            label="Similarity floor"
            caption="0 to 1. 0.8 was measured against this corpus and this embedding model — off-topic questions score 0.76–0.82 and on-topic ones 0.84–0.92, so the useful gap is narrow. Change the corpus or the model and this number means nothing until it is measured again."
          >
            <input
              name="minSimilarity"
              type="number"
              min={0}
              max={1}
              step={0.01}
              defaultValue={chat.minSimilarity}
              className={inputClassName}
            />
          </Field>
        </div>
      </Panel>

      <Panel
        title="Limits"
        description="What one visitor may send, and how much of the conversation the model is shown."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Max message length" caption="Characters. route.ts / ChatWidget.tsx">
            <input
              name="maxMessageChars"
              type="number"
              min={1}
              defaultValue={chat.maxMessageChars}
              className={inputClassName}
            />
          </Field>
          <Field label="History turns kept" caption="route.ts / ChatWidget.tsx">
            <input
              name="maxHistoryTurns"
              type="number"
              min={0}
              defaultValue={chat.maxHistoryTurns}
              className={inputClassName}
            />
          </Field>
          <Field label="Rate limit window (ms)" caption="route.ts">
            <input
              name="rateLimitWindowMs"
              type="number"
              min={1000}
              step={1000}
              defaultValue={chat.rateLimitWindowMs}
              className={inputClassName}
            />
          </Field>
          <Field label="Rate limit max requests" caption="route.ts">
            <input
              name="rateLimitMaxRequests"
              type="number"
              min={1}
              defaultValue={chat.rateLimitMaxRequests}
              className={inputClassName}
            />
          </Field>
        </div>
      </Panel>

      <SaveRow isPending={isPending} result={result} label="Save chatbot config" />
    </form>
  );
}
