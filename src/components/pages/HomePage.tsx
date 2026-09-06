import Link from "next/link";

import CallToAction from "@/components/CallToAction";
import Hero from "@/components/Hero";
import ServicesSection from "@/components/ServicesSection";

import { DEFAULT_CONTENT } from "@/lib/content/defaults";
import type { BenefitItem } from "@/lib/content/types";
import type { FaqItem, ServiceItem } from "@/lib/site-data";

/**
 * The copy this page ships with.
 *
 * Read from the content defaults rather than written as prop defaults, so the
 * strings a Plasmic editor sees, the strings the Content Management page
 * restores, and the strings an unconfigured deployment renders are one set.
 */
const shipped = DEFAULT_CONTENT.landing;

type HomePageProps = {
  className?: string;

  heroEyebrow?: string;
  heroTitle?: string;
  heroDescription?: string;

  primaryButtonText?: string;
  primaryButtonUrl?: string;

  secondaryButtonText?: string;
  secondaryButtonUrl?: string;

  benefitsEyebrow?: string;
  benefitsHeading?: string;

  servicesHeading?: string;
  servicesDescription?: string;

  whyChooseEyebrow?: string;
  whyChooseHeading?: string;
  whyChooseBody?: string;
  whyChooseItems?: string[];

  faqEyebrow?: string;
  faqHeading?: string;

  ctaTitle?: string;
  ctaDescription?: string;
  ctaButtonText?: string;
  ctaButtonUrl?: string;

  /** The lists, from the Content Management page. Default to what ships. */
  benefits?: BenefitItem[];
  services?: ServiceItem[];
  faq?: FaqItem[];
};

export default function HomePage({
  className,

  heroEyebrow = shipped.heroEyebrow,
  heroTitle = shipped.heroTitle,
  heroDescription = shipped.heroDescription,

  primaryButtonText = shipped.primaryButtonText,
  primaryButtonUrl = shipped.primaryButtonUrl,

  secondaryButtonText = shipped.secondaryButtonText,
  secondaryButtonUrl = shipped.secondaryButtonUrl,

  benefitsEyebrow = shipped.benefitsEyebrow,
  benefitsHeading = shipped.benefitsHeading,

  servicesHeading = shipped.servicesHeading,
  servicesDescription = shipped.servicesDescription,

  whyChooseEyebrow = shipped.whyChooseEyebrow,
  whyChooseHeading = shipped.whyChooseHeading,
  whyChooseBody = shipped.whyChooseBody,
  whyChooseItems = shipped.whyChooseItems,

  faqEyebrow = shipped.faqEyebrow,
  faqHeading = shipped.faqHeading,

  ctaTitle = shipped.ctaTitle,
  ctaDescription = shipped.ctaDescription,
  ctaButtonText = shipped.ctaButtonText,
  ctaButtonUrl = shipped.ctaButtonUrl,

  benefits = DEFAULT_CONTENT.catalog.benefits,
  services = DEFAULT_CONTENT.catalog.services,
  faq = DEFAULT_CONTENT.catalog.faq,
}: HomePageProps) {
  return (
    <main
      className={`w-full min-w-0 overflow-x-hidden ${
        className ?? ""
      }`}
    >
      {/* HERO */}
      <Hero
        eyebrow={heroEyebrow}
        title={heroTitle}
        description={heroDescription}
        primaryButtonText={primaryButtonText}
        primaryButtonUrl={primaryButtonUrl}
        secondaryButtonText={secondaryButtonText}
        secondaryButtonUrl={secondaryButtonUrl}
      />

      {/* KEY BENEFITS */}
      <section className="w-full py-20">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-800">
              {benefitsEyebrow}
            </p>

            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              {benefitsHeading}
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {benefits.map((item) => (
              <article
                key={item.title}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.35)]"
              >
                <h3 className="text-xl font-semibold text-slate-950">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="w-full">
        <ServicesSection
          title={servicesHeading}
          description={servicesDescription}
          serviceItems={services}
        />
      </section>

      {/* WHY CHOOSE DOCUJET */}
      <section className="w-full py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-800">
              {whyChooseEyebrow}
            </p>

            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              {whyChooseHeading}
            </h2>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
              {whyChooseBody}
            </p>
          </div>

          <div className="grid gap-4">
            {whyChooseItems.map((item) => (
              <div
                key={item}
                className="rounded-[1.5rem] border border-slate-200 bg-white px-6 py-5 text-sm font-medium text-slate-700 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.35)]"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full">
        <CallToAction
          title={ctaTitle}
          description={ctaDescription}
          buttonText={ctaButtonText}
          buttonUrl={ctaButtonUrl}
        />
      </section>

      {/* FAQ PREVIEW */}
      <section className="w-full py-20">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-800">
                {faqEyebrow}
              </p>

              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                {faqHeading}
              </h2>
            </div>

            <Link
              href="/faq"
              className="inline-flex items-center text-sm font-semibold text-sky-800 transition hover:text-sky-900"
            >
              View all FAQ
            </Link>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {faq.slice(0, 3).map((item) => (
              <article
                key={item.question}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.35)]"
              >
                <h3 className="text-lg font-semibold text-slate-950">
                  {item.question}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
