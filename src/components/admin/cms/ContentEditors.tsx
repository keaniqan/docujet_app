"use client";

/**
 * The Content Management editors.
 *
 * One component per block, all in one file because they are the same three
 * ingredients — an `ActionForm`, some `Field`s, sometimes a `RowRepeater` — and
 * splitting eight thirty-line components across eight files would hide that.
 *
 * Contact details are the exception worth naming: they are scalars and stay in
 * `app_settings` where the footer and the assistant's brief already read them,
 * so that editor posts to a settings action while everything else here posts to
 * a content action. Two stores, one page, split by the shape of the value.
 */

import { useState } from "react";
import ActionForm from "./ActionForm";
import { Field, RepeatableList, RowRepeater } from "../Fields";
import { inputClassName } from "../field-styles";
import {
  updateBookingEmailAction,
  updateCatalogAction,
  updateChatCaptureAction,
  updateLandingAction,
  updateOutreachAction,
  updateSocialAction,
  updateTooltipsAction,
  resetContentBlockAction,
} from "@/lib/content/actions";
import {
  OUTREACH_TEMPLATE_IDS,
  OUTREACH_TEMPLATE_LABELS,
} from "@/lib/content/outreach-ids";
import type { SiteContent } from "@/lib/content/types";
import { updateBusinessAction } from "@/lib/settings/actions";
import type { BusinessInfo } from "@/lib/settings/types";

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

export function ContactEditor({ business }: { business: BusinessInfo }) {
  return (
    <ActionForm
      title="Contact information"
      description="Shown in the footer of every public page, on the contact page, and given to the chat assistant as fact it is allowed to state."
      action={updateBusinessAction}
      saveLabel="Save contact details"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Company name">
          <input
            name="companyName"
            defaultValue={business.companyName}
            className={inputClassName}
          />
        </Field>
        <Field label="Email">
          <input name="email" defaultValue={business.email} className={inputClassName} />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={business.phone} className={inputClassName} />
        </Field>
        <Field label="Business hours">
          <input name="hours" defaultValue={business.hours} className={inputClassName} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Address">
            <textarea
              name="address"
              rows={3}
              defaultValue={business.address}
              className={inputClassName}
            />
          </Field>
        </div>
      </div>
    </ActionForm>
  );
}

export function SocialEditor({ social }: { social: SiteContent["social"] }) {
  return (
    <ActionForm
      title="Social links"
      description="Added to the footer. Leave the list empty and the footer shows no social section at all, which is how it has always looked."
      action={updateSocialAction}
      saveLabel="Save social links"
      onReset={() => resetContentBlockAction("social")}
    >
      <RowRepeater
        prefix="social"
        addLabel="Add a link"
        rowLabel={(index) => `Link ${index}`}
        fields={[
          { name: "label", label: "Label", placeholder: "LinkedIn" },
          { name: "url", label: "URL", placeholder: "https://…" },
        ]}
        initial={social.links.map((link) => ({ label: link.label, url: link.url }))}
      />
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Landing page
// ---------------------------------------------------------------------------

export function LandingEditor({ landing }: { landing: SiteContent["landing"] }) {
  const [whyChoose, setWhyChoose] = useState<string[]>(
    landing.whyChooseItems.length > 0 ? landing.whyChooseItems : [""],
  );

  return (
    <ActionForm
      title="Landing page"
      description="The home page's headings and body copy. These also apply to any page Plasmic Studio has nothing published for."
      action={updateLandingAction}
      saveLabel="Save landing copy"
      onReset={() => resetContentBlockAction("landing")}
    >
      <div className="space-y-6">
        <Section title="Hero">
          <Text name="heroEyebrow" label="Eyebrow" value={landing.heroEyebrow} />
          <Text name="heroTitle" label="Title" value={landing.heroTitle} />
          <Area name="heroDescription" label="Description" value={landing.heroDescription} />
          <Text name="primaryButtonText" label="Primary button" value={landing.primaryButtonText} />
          <Text name="primaryButtonUrl" label="Primary button URL" value={landing.primaryButtonUrl} />
          <Text
            name="secondaryButtonText"
            label="Secondary button"
            value={landing.secondaryButtonText}
          />
          <Text
            name="secondaryButtonUrl"
            label="Secondary button URL"
            value={landing.secondaryButtonUrl}
          />
        </Section>

        <Section title="Key benefits">
          <Text name="benefitsEyebrow" label="Eyebrow" value={landing.benefitsEyebrow} />
          <Text name="benefitsHeading" label="Heading" value={landing.benefitsHeading} />
        </Section>

        <Section title="Product range">
          <Text name="servicesHeading" label="Heading" value={landing.servicesHeading} />
          <Area
            name="servicesDescription"
            label="Description"
            value={landing.servicesDescription}
          />
        </Section>

        <Section title="Why choose us">
          <Text name="whyChooseEyebrow" label="Eyebrow" value={landing.whyChooseEyebrow} />
          <Text name="whyChooseHeading" label="Heading" value={landing.whyChooseHeading} />
          <Area name="whyChooseBody" label="Body" value={landing.whyChooseBody} />
          <div className="md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">Bullets</span>
            <RepeatableList
              name="whyChooseItems"
              values={whyChoose}
              onChange={setWhyChoose}
              addLabel="Add a bullet"
            />
          </div>
        </Section>

        <Section title="Call to action">
          <Text name="ctaTitle" label="Title" value={landing.ctaTitle} />
          <Area name="ctaDescription" label="Description" value={landing.ctaDescription} />
          <Text name="ctaButtonText" label="Button" value={landing.ctaButtonText} />
          <Text name="ctaButtonUrl" label="Button URL" value={landing.ctaButtonUrl} />
        </Section>

        <Section title="FAQ preview">
          <Text name="faqEyebrow" label="Eyebrow" value={landing.faqEyebrow} />
          <Text name="faqHeading" label="Heading" value={landing.faqHeading} />
        </Section>
      </div>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export function CatalogEditor({ catalog }: { catalog: SiteContent["catalog"] }) {
  const [products, setProducts] = useState<string[]>(
    catalog.bookingProducts.length > 0 ? catalog.bookingProducts : [""],
  );
  const [types, setTypes] = useState<string[]>(
    catalog.bookingTypes.length > 0 ? catalog.bookingTypes : [""],
  );

  return (
    <ActionForm
      title="Products, benefits and questions"
      description="The lists the public pages iterate. Removing a row here removes it from the site; the first booking option is the one pre-selected on the form."
      action={updateCatalogAction}
      saveLabel="Save lists"
      onReset={() => resetContentBlockAction("catalog")}
    >
      <div className="space-y-8">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Benefit tiles</h3>
          <RowRepeater
            prefix="benefit"
            addLabel="Add a benefit"
            rowLabel={(index) => `Benefit ${index}`}
            fields={[
              { name: "title", label: "Title" },
              { name: "description", label: "Description", textarea: true },
            ]}
            initial={catalog.benefits.map((item) => ({
              title: item.title,
              description: item.description,
            }))}
          />
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Product cards</h3>
          <RowRepeater
            prefix="service"
            addLabel="Add a product"
            rowLabel={(index) => `Product ${index}`}
            fields={[
              { name: "title", label: "Name" },
              { name: "buttonText", label: "Button" },
              { name: "buttonUrl", label: "Button URL" },
              { name: "description", label: "Description", textarea: true, rows: 4 },
            ]}
            initial={catalog.services.map((item) => ({
              title: item.title,
              buttonText: item.buttonText ?? "",
              buttonUrl: item.buttonUrl ?? "",
              description: item.description,
            }))}
          />
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Frequently asked questions
          </h3>
          <RowRepeater
            prefix="faq"
            addLabel="Add a question"
            rowLabel={(index) => `Question ${index}`}
            fields={[
              { name: "question", label: "Question", textarea: true, rows: 2 },
              { name: "answer", label: "Answer", textarea: true, rows: 4 },
            ]}
            initial={catalog.faq.map((item) => ({
              question: item.question,
              answer: item.answer,
            }))}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Booking — product of interest
            </span>
            <RepeatableList
              name="bookingProducts"
              values={products}
              onChange={setProducts}
              addLabel="Add an option"
            />
          </div>
          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Booking — appointment type
            </span>
            <RepeatableList
              name="bookingTypes"
              values={types}
              onChange={setTypes}
              addLabel="Add an option"
            />
          </div>
        </div>
      </div>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Lead contact templates
// ---------------------------------------------------------------------------

export function BookingEmailEditor({
  bookingEmail,
  whatsappTemplateName,
}: {
  bookingEmail: SiteContent["bookingEmail"];
  whatsappTemplateName: string;
}) {
  return (
    <ActionForm
      title="Booking confirmation"
      description={
        <>
          Sent the moment somebody books. Placeholders are{" "}
          <code className="font-mono">{"{name}"}</code>{" "}
          <code className="font-mono">{"{type}"}</code>{" "}
          <code className="font-mono">{"{date}"}</code>{" "}
          <code className="font-mono">{"{time}"}</code>{" "}
          <code className="font-mono">{"{bookingId}"}</code>{" "}
          <code className="font-mono">{"{sender}"}</code>. Every substituted value is escaped;
          the HTML around them is not, so it is yours to get right.
        </>
      }
      action={updateBookingEmailAction}
      saveLabel="Save email"
      onReset={() => resetContentBlockAction("bookingEmail")}
    >
      <div className="space-y-4">
        <Field label="Subject">
          <input name="subject" defaultValue={bookingEmail.subject} className={inputClassName} />
        </Field>
        <Field label="HTML body">
          <textarea
            name="html"
            rows={10}
            defaultValue={bookingEmail.html}
            spellCheck={false}
            className={`${inputClassName} font-mono text-xs leading-6`}
          />
        </Field>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
          <p className="font-semibold">The WhatsApp confirmation is not editable here.</p>
          <p className="mt-1">
            WhatsApp requires a pre-approved Content Template, so its words live in the Twilio
            console rather than in this app. This site sends five values into it, in this order:
            name, appointment type, date, time, booking reference. The template in use is{" "}
            <code className="rounded bg-white px-1 py-0.5 font-mono">
              {whatsappTemplateName || "not configured"}
            </code>
            , which you can change on the System Config tab.
          </p>
        </div>
      </div>
    </ActionForm>
  );
}

export function ChatCaptureEditor({
  chatCapture,
}: {
  chatCapture: SiteContent["chatCapture"];
}) {
  const cards = [
    {
      key: "intent" as const,
      heading: "They asked about price, leasing or a demo",
      note: "The assistant is told never to answer these, so offering a person is the only route to what they asked for.",
    },
    {
      key: "unanswered" as const,
      heading: "The knowledge base had nothing",
      note: "The recovery. A lead captured here is marked in the CRM as both high-intent and a content gap.",
    },
    {
      key: "depth" as const,
      heading: "Several questions in",
      note: "Not urgent, easy to ignore, offered once per session.",
    },
  ];

  return (
    <ActionForm
      title="Chat handover cards"
      description="What the chat panel says when it offers to put a visitor in touch with a person. Three moments, three different conversations."
      action={updateChatCaptureAction}
      saveLabel="Save handover cards"
      onReset={() => resetContentBlockAction("chatCapture")}
    >
      <div className="space-y-4">
        {cards.map((card) => (
          <div key={card.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">{card.heading}</p>
            <p className="mt-1 text-xs leading-6 text-slate-500">{card.note}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Title">
                <input
                  name={`${card.key}.title`}
                  defaultValue={chatCapture[card.key].title}
                  className={inputClassName}
                />
              </Field>
              <Field label="Button">
                <input
                  name={`${card.key}.cta`}
                  defaultValue={chatCapture[card.key].cta}
                  className={inputClassName}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Body">
                  <textarea
                    name={`${card.key}.body`}
                    rows={3}
                    defaultValue={chatCapture[card.key].body}
                    className={inputClassName}
                  />
                </Field>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ActionForm>
  );
}

export function OutreachEditor({ outreach }: { outreach: SiteContent["outreach"] }) {
  return (
    <ActionForm
      title="CRM follow-up drafts"
      description={
        <>
          The message a rep sees pre-written when they open Contact now. Which one appears is
          decided by the lead&apos;s stage, its appointments and how it was lost — that stays in
          code; only the words are here. Placeholders:{" "}
          <code className="font-mono">{"{greeting}"}</code>{" "}
          <code className="font-mono">{"{matter}"}</code>{" "}
          <code className="font-mono">{"{sign}"}</code>, plus the ones each draft names.
        </>
      }
      action={updateOutreachAction}
      saveLabel="Save drafts"
      onReset={() => resetContentBlockAction("outreach")}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
          <p className="font-semibold">These go out under a rep&apos;s own name.</p>
          <p className="mt-1">
            No prices, no lead times, no availability, and no promise about what an engineer will
            do — this business quotes after a consultation, and a figure invented by a template
            arrives in a customer&apos;s inbox as a commitment. Never claim a conversation
            happened; the drafts that mention one are only used when the record shows it.
          </p>
        </div>

        {OUTREACH_TEMPLATE_IDS.map((id) => (
          <div key={id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
              {OUTREACH_TEMPLATE_LABELS[id]}
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Subject">
                <input
                  name={`${id}.subject`}
                  defaultValue={outreach[id].subject}
                  className={inputClassName}
                />
              </Field>
              <Field
                label="Subject without a named product"
                caption="Used when the lead's interest names no model. Blank uses the subject above."
              >
                <input
                  name={`${id}.subjectGeneric`}
                  defaultValue={outreach[id].subjectGeneric ?? ""}
                  className={inputClassName}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Body">
                  <textarea
                    name={`${id}.body`}
                    rows={8}
                    defaultValue={outreach[id].body}
                    className={inputClassName}
                  />
                </Field>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Tooltips
// ---------------------------------------------------------------------------

export function TooltipsEditor({
  tooltips,
  terms,
}: {
  tooltips: SiteContent["tooltips"];
  /** Every term the shipped glossary defines, so an override can be aimed at one. */
  terms: { key: string; term: string; what: string }[];
}) {
  const [filter, setFilter] = useState("");
  const overridden = Object.keys(tooltips);
  const needle = filter.trim().toLowerCase();

  /**
   * Filtering hides rows; it must not remove them.
   *
   * The action replaces the whole block from what the form submits, so a row
   * that is not in the DOM is a row whose override is deleted. Searching for
   * "stage" and pressing Save would otherwise wipe every tooltip that is not a
   * stage — so every term stays mounted and non-matching ones are just hidden.
   */
  function matches(item: { key: string; term: string }) {
    if (needle === "") return true;
    return (
      item.key.toLowerCase().includes(needle) || item.term.toLowerCase().includes(needle)
    );
  }

  const matchCount = terms.filter(matches).length;

  return (
    <ActionForm
      title="Tooltip glossary"
      description="The explanations behind the small dots on the CRM pages. Only the terms you override are stored — everything else keeps the text that ships, including the parts that quote the stall thresholds and would go stale if copied."
      action={updateTooltipsAction}
      saveLabel="Save tooltips"
      onReset={() => resetContentBlockAction("tooltips")}
    >
      <div className="space-y-4">
        <Field
          label="Find a term"
          caption={
            needle === ""
              ? `${terms.length} terms defined, ${overridden.length} overridden.`
              : `${matchCount} of ${terms.length} terms shown. Saving still keeps the ones filtered out.`
          }
        >
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="stage, kpi, going cold…"
            className={inputClassName}
          />
        </Field>

        <p className="text-xs leading-6 text-slate-500">
          Leaving &ldquo;What it is&rdquo; blank on a row means no override: that term goes back
          to the shipped explanation on save.
        </p>

        <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
          {terms.map((item) => {
            const override = tooltips[item.key];
            return (
              <div
                key={item.key}
                hidden={!matches(item)}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.term}</p>
                  <code className="font-mono text-xs text-slate-400">{item.key}</code>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-6 text-slate-500">
                  Ships as: {item.what}
                </p>
                <input type="hidden" name="tooltip.term" value={item.key} />
                <div className="mt-3 space-y-3">
                  <Field label="What it is">
                    <textarea
                      name="tooltip.what"
                      rows={2}
                      defaultValue={override?.what ?? ""}
                      className={inputClassName}
                    />
                  </Field>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Why it matters">
                      <textarea
                        name="tooltip.why"
                        rows={2}
                        defaultValue={override?.why ?? ""}
                        className={inputClassName}
                      />
                    </Field>
                    <Field label="What to do">
                      <textarea
                        name="tooltip.how"
                        rows={2}
                        defaultValue={override?.how ?? ""}
                        className={inputClassName}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Text({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <Field label={label}>
      <input name={name} defaultValue={value} className={inputClassName} />
    </Field>
  );
}

function Area({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <div className="md:col-span-2">
      <Field label={label}>
        <textarea name={name} rows={3} defaultValue={value} className={inputClassName} />
      </Field>
    </div>
  );
}
