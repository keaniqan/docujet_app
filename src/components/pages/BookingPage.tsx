import BookingForm from "@/components/BookingForm";

type BookingPageProps = {
  className?: string;
  pageTitle?: string;
  pageDescription?: string;
  introTitle?: string;
  /** The booking form's two dropdowns, from the Content Management page. */
  products?: string[];
  types?: string[];
};

export default function BookingPage({
  className,
  pageTitle = "Schedule a WorkForce Enterprise consultation",
  pageDescription = "Use the form below to request a product consultation, demonstration, pricing discussion, or technical review for the Epson WorkForce Enterprise WF-C20600, WF-C20750, and WF-C21000.",
  introTitle = "What to prepare before booking",
  products,
  types,
}: BookingPageProps) {
  return (
    <main className={`w-full min-w-0 ${className ?? ""}`}>
      <section className="docujet-hero-surface border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:py-24">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-800">
            Book Appointment
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            {pageTitle}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600">
            {pageDescription}
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">
              {introTitle}
            </h2>
            <div className="mt-6 space-y-4 text-sm leading-7 text-slate-600">
              <p>
                Share your business context, the product or issue you want to
                discuss, and your preferred timing.
              </p>
              <p>
                Choose an available time in Malaysia time (UTC+8). Times that
                have already passed cannot be booked.
              </p>
              <p>
                Your appointment is confirmed once your booking is saved.
                Please wait for the confirmation message before leaving this page.
              </p>
            </div>
          </div>

          <BookingForm products={products} types={types} />
        </div>
      </section>
    </main>
  );
}
