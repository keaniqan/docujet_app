<<<<<<< HEAD
import { getContentSafe } from "@/lib/content/store";
import { demandEnv, resolveEnvMany } from "@/lib/settings/resolve";

type BookingEmail = {
  fullName: string;
  email: string;
  appointmentType: string;
  preferredDate: string;
  preferredTime: string;
  appointmentId: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

/**
 * Fills the stored template's `{name}` tokens.
 *
 * Every substituted value is escaped first; the markup around it is not,
 * because the template is written by a superadmin on the Content Management
 * page and is the same kind of trusted input the hardcoded literal was. An
 * unknown token becomes empty rather than staying visible — a stray `{price}`
 * in a customer's inbox is worse than a gap.
 */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    escapeHtml(values[key] ?? ""),
  );
}

/** "APT-4F2A91C0" from a uuid, or the id unchanged when it is already short. */
function readableAppointmentId(id: string) {
  return id.length > 12 ? `APT-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}` : id;
}

export async function sendBookingEmail(booking: BookingEmail) {
  // Credentials resolve database-first and fall back to `.env`, so rotating a
  // key is a form submission rather than a redeploy — see settings/env.ts. All
  // three are read together: they come from one settings row set, and asking
  // for them separately would be three reads of the same table.
  const [config, content] = await Promise.all([
    resolveEnvMany([
      "BREVO_API_KEY",
      "BREVO_SENDER_EMAIL",
      "BREVO_SENDER_NAME",
    ] as const),
    getContentSafe(),
  ]);

  demandEnv(config, ["BREVO_API_KEY", "BREVO_SENDER_EMAIL"]);

  // The one with a shipped fallback: an unset sender name is a cosmetic gap,
  // not a reason to refuse to send somebody their confirmation.
  const senderName = config.BREVO_SENDER_NAME || "DocuJet";

  const values = {
    name: booking.fullName,
    type: booking.appointmentType,
    date: booking.preferredDate,
    time: booking.preferredTime,
    bookingId: readableAppointmentId(booking.appointmentId),
    sender: senderName,
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": config.BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: config.BREVO_SENDER_EMAIL },
      to: [{ email: booking.email, name: booking.fullName }],
      subject: fill(content.bookingEmail.subject, values),
      htmlContent: fill(content.bookingEmail.html, values),
    }),
    cache: "no-store",
=======
import nodemailer from "nodemailer";

import { buildBookingEmail, type BookingEmail } from "./booking-email";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

export async function sendBookingEmail(booking: BookingEmail) {
  const senderEmail = requiredEnv("GMAIL_USER");
  const appPassword = requiredEnv("GMAIL_APP_PASSWORD").replace(/\s/g, "");
  const senderName = process.env.GMAIL_SENDER_NAME?.trim() || "DocuJet";
  const message = buildBookingEmail(booking, senderEmail, senderName);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: senderEmail, pass: appPassword },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
>>>>>>> b949294 (Add Gmail booking confirmations with calendar invite)
  });

  await transporter.sendMail({
    from: { name: senderName, address: senderEmail },
    to: [{ address: booking.email, name: booking.fullName }],
    ...message,
  });
}
