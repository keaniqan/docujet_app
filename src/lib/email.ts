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
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Brevo rejected the email (${response.status}): ${detail.slice(0, 300)}`);
  }
}
