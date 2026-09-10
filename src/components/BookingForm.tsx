"use client";

import { useEffect, useRef, useState } from "react";
import { bookingProducts, bookingTypes } from "@/lib/site-data";
import { createClient } from "@/lib/supabase/client";
import { bookingDate, isFutureBooking } from "@/lib/booking-time";

type FormValues = {
  fullName: string;
  companyName: string;
  email: string;
  phoneNumber: string;
  productOfInterest: string;
  appointmentType: string;
  preferredDate: string;
  preferredTime: string;
  additionalNotes: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

/**
 * A blank form.
 *
 * Takes the two dropdown lists rather than closing over the module-level ones,
 * because both are editable from the Content Management page now and the
 * pre-selected option has to be the first entry of the list actually rendered —
 * not the first entry of the list that shipped.
 */
function initialValues(products: string[], types: string[]): FormValues {
  return {
    fullName: "",
    companyName: "",
    email: "",
    phoneNumber: "",
    productOfInterest: products[0] ?? "",
    appointmentType: types[0] ?? "",
    preferredDate: "",
    preferredTime: "",
    additionalNotes: "",
  };
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.fullName.trim()) errors.fullName = "Full name is required.";
  if (!values.companyName.trim())
    errors.companyName = "Company name is required.";
  if (!values.email.trim()) {
    errors.email = "Email address is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.phoneNumber.trim()) {
    errors.phoneNumber = "Phone number is required.";
  }

  if (!values.preferredDate) {
    errors.preferredDate = "Preferred date is required.";
  }

  if (!values.preferredTime) {
    errors.preferredTime = "Preferred time is required.";
  } else if (values.preferredDate && !isFutureBooking(values.preferredDate, values.preferredTime)) {
    errors.preferredTime = "This time has already passed. Please choose a future time.";
  }

  return errors;
}

export type BookingFormProps = {
  /** The "product of interest" options. Defaults to what ships in site-data.ts. */
  products?: string[];
  /** The "appointment type" options. Same default. */
  types?: string[];
};

export default function BookingForm({
  products = bookingProducts,
  types = bookingTypes,
}: BookingFormProps = {}) {
  const [values, setValues] = useState<FormValues>(() => initialValues(products, types));
  const [errors, setErrors] = useState<FormErrors>({});
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submittingRef = useRef(false);
  const [now, setNow] = useState(() => new Date());
  const today = bookingDate(now);
  const futureSlots = availableSlots.filter((slot) => isFutureBooking(values.preferredDate, slot, now));

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    if (!values.preferredDate) {
      return;
    }

    let active = true;

    async function loadBookedSlots() {
      setIsLoadingSlots(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("get_available_time_slots", {
          p_date: values.preferredDate,
        });

        if (!active) {
          return;
        }

        setIsLoadingSlots(false);

        if (error) {
          setAvailableSlots([]);
          setSubmitError(error.message);
          return;
        }

        setAvailableSlots(
          (data ?? []).map((slot: { preferred_time: string }) =>
            String(slot.preferred_time).slice(0, 5),
          ),
        );
        setSubmitError(null);
      } catch {
        if (active) {
          setAvailableSlots([]);
          setSubmitError("Could not load appointment times. Please select the date again.");
        }
      } finally {
        if (active) setIsLoadingSlots(false);
      }
    }

    loadBookedSlots();

    return () => {
      active = false;
    };
  }, [values.preferredDate]);

  function updateField<Key extends keyof FormValues>(
    field: Key,
    value: FormValues[Key],
  ) {
    setValues((current) => {
      const next = { ...current, [field]: value };

      if (field === "preferredDate") {
        next.preferredTime = "";
        setAvailableSlots([]);
      }

      return next;
    });
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const nextErrors = validate(values);
    setErrors(nextErrors);
    setSubmitted(false);
    setSubmitError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    submittingRef.current = true;
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("create_booking", {
        p_full_name: values.fullName,
        p_company_name: values.companyName,
        p_email: values.email,
        p_phone: values.phoneNumber,
        p_product_interest: values.productOfInterest,
        p_appointment_type: values.appointmentType,
        p_preferred_date: values.preferredDate,
        p_preferred_time: values.preferredTime,
        p_additional_notes: values.additionalNotes,
      });

      if (error) {
        setSubmitError(error.message);
        return;
      }

      const booking = Array.isArray(data) ? data[0] as { appointment_id?: string } | undefined : data as { appointment_id?: string } | null;
      const appointmentId = booking?.appointment_id;
      if (appointmentId) {
        const notificationPayload = {
          fullName: values.fullName,
          appointmentType: values.appointmentType,
          preferredDate: values.preferredDate,
          preferredTime: values.preferredTime,
          appointmentId,
        };
        const [whatsapp, email] = await Promise.allSettled([
          fetch("/api/notifications/whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...notificationPayload, phoneNumber: values.phoneNumber }),
            signal: AbortSignal.timeout(15000),
          }),
          fetch("/api/notifications/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...notificationPayload, email: values.email }),
            signal: AbortSignal.timeout(15000),
          }),
        ]);
        if (whatsapp.status === "rejected" || (whatsapp.status === "fulfilled" && !whatsapp.value.ok)) {
          console.warn("The booking was saved, but its WhatsApp notification was not sent.");
        }
        if (email.status === "rejected" || (email.status === "fulfilled" && !email.value.ok)) {
          console.warn("The booking was saved, but its email notification was not sent.");
        }
      }

      setValues(initialValues(products, types));
      setAvailableSlots([]);
      setSubmitted(true);
    } catch {
      setSubmitError("We could not verify whether your appointment was saved. Please check with DocuJet before submitting again.");
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-busy={isSubmitting}
      className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.35)] md:p-8"
    >
      <fieldset disabled={isSubmitting} className="min-w-0">
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Full Name"
            htmlFor="fullName"
            error={errors.fullName}
            input={
              <input
                id="fullName"
                name="fullName"
                value={values.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                className={inputClassName}
              />
            }
          />
          <Field
            label="Company Name"
            htmlFor="companyName"
            error={errors.companyName}
            input={
              <input
                id="companyName"
                name="companyName"
                value={values.companyName}
                onChange={(event) =>
                  updateField("companyName", event.target.value)
                }
                className={inputClassName}
              />
            }
          />
          <Field
            label="Email Address"
            htmlFor="email"
            error={errors.email}
            input={
              <input
                id="email"
                name="email"
                type="email"
                value={values.email}
                onChange={(event) => updateField("email", event.target.value)}
                className={inputClassName}
              />
            }
          />
          <Field
            label="Phone Number"
            htmlFor="phoneNumber"
            error={errors.phoneNumber}
            input={
              <div className="flex">
                <span className="inline-flex items-center rounded-l-2xl border border-r-0 border-slate-300 bg-slate-100 px-3 text-sm font-semibold text-slate-600">
                  +60
                </span>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  inputMode="numeric"
                  value={values.phoneNumber.replace(/^\+60/, "")}
                  onChange={(event) =>
                    updateField("phoneNumber", (() => {
                      const local = event.target.value.replace(/\D/g, "").replace(/^0+/, "");
                      return local ? `+60${local}` : "";
                    })())
                  }
                  placeholder="1123456789"
                  className={`${inputClassName} rounded-l-none`}
                />
              </div>
            }
          />
          <Field
            label="Product of Interest"
            htmlFor="productOfInterest"
            input={
              <select
                id="productOfInterest"
                name="productOfInterest"
                value={values.productOfInterest}
                onChange={(event) =>
                  updateField("productOfInterest", event.target.value)
                }
                className={inputClassName}
              >
                {products.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            }
          />
          <Field
            label="Appointment Type"
            htmlFor="appointmentType"
            input={
              <select
                id="appointmentType"
                name="appointmentType"
                value={values.appointmentType}
                onChange={(event) =>
                  updateField("appointmentType", event.target.value)
                }
                className={inputClassName}
              >
                {types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            }
          />
          <Field
            label="Preferred Date"
            htmlFor="preferredDate"
            error={errors.preferredDate}
            input={
              <input
                id="preferredDate"
                name="preferredDate"
                type="date"
                min={today}
                value={values.preferredDate}
                onChange={(event) =>
                  updateField("preferredDate", event.target.value)
                }
                className={inputClassName}
              />
            }
          />
        </div>

        <div className="mt-5">
          <Field
            label="Preferred Time"
            htmlFor="preferredTime"
            error={errors.preferredTime}
            input={
              <div className="space-y-4">
                <input
                  id="preferredTime"
                  name="preferredTime"
                  type="hidden"
                  value={values.preferredTime}
                  readOnly
                />
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  {values.preferredDate ? (
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-700">
                        Select a 30-minute slot
                      </p>
                      <p className="text-xs text-slate-500">
                        Malaysia time (UTC+8)
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Choose a date first to see available time slots.
                    </p>
                  )}

                  {values.preferredDate ? (
                    isLoadingSlots ? (
                      <p className="text-sm text-slate-500">Checking availability...</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {futureSlots.map((slot) => {
                          const isSelected = values.preferredTime === slot;

                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => updateField("preferredTime", slot)}
                              className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${isSelected ? "border-sky-800 bg-sky-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-sky-700 hover:text-sky-900"}`}
                              aria-pressed={isSelected}
                              title={`Select ${slot}`}
                            >
                              {slot}
                            </button>
                          );
                        })}
                        {!futureSlots.length ? <p className="col-span-full text-sm text-slate-500">No appointment times are available for this date.</p> : null}
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            }
          />
        </div>

        <div className="mt-5">
          <Field
            label="Additional Notes"
            htmlFor="additionalNotes"
            input={
              <textarea
                id="additionalNotes"
                name="additionalNotes"
                rows={5}
                value={values.additionalNotes}
                onChange={(event) =>
                  updateField("additionalNotes", event.target.value)
                }
                className={`${inputClassName} resize-y`}
              />
            }
          />
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm leading-6 text-slate-500">
            Your appointment will be confirmed when your booking is saved.
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-900 disabled:cursor-wait disabled:opacity-70"
          >
            {isSubmitting && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {isSubmitting ? "Processing appointment..." : "Book Appointment"}
          </button>
        </div>
      </fieldset>

      {isSubmitting && <p role="status" className="mt-4 text-sm text-sky-900">Please wait while we process your appointment.</p>}

      {submitError ? (
        <div role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {submitError}
        </div>
      ) : null}

      {submitted ? (
        <div role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Your appointment is confirmed. Thank you for booking with DocuJet.
        </div>
      ) : null}
    </form>
  );
}

type FieldProps = {
  label: string;
  htmlFor: string;
  input: React.ReactNode;
  error?: string;
};

function Field({ label, htmlFor, input, error }: FieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-medium text-slate-800"
      >
        {label}
      </label>
      {input}
      {error ? (
        <p className="mt-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClassName =
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-700 focus:ring-4 focus:ring-sky-100";
