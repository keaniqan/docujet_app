/**
 * The booking confirmation over WhatsApp.
 *
 * Sends the booking confirmation directly through Meta's WhatsApp Cloud API.
 * The template name and language are configurable because Meta owns the
 * approved template content; the parameter order remains a code contract.
 */

import { demandEnv, resolveEnvMany } from "@/lib/settings/resolve";

type BookingNotification = {
  fullName: string;
  phoneNumber: string;
  appointmentType: string;
  preferredDate: string;
  preferredTime: string;
  appointmentId: string;
};

function readableAppointmentId(id: string) {
  return id.length > 12 ? `APT-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}` : id;
}

function normalizePhone(phone: string) {
  const raw = phone.trim();
  const digits = raw.replace(/\D/g, "");
  const countryCode = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE?.trim() || "60").replace(/\D/g, "");
  const international = raw.startsWith("+")
    ? digits
    : digits.startsWith("0")
      ? `${countryCode}${digits.slice(1)}`
      : digits;

  if (!/^\d{8,15}$/.test(international)) {
    throw new Error("Enter a valid WhatsApp number, for example 01123456789 or +601123456789.");
  }
  return international;
}

export async function sendBookingWhatsApp(booking: BookingNotification) {
  // One settings read for all five, resolving database-first and falling back
  // to `.env` — see settings/env.ts.
  const config = await resolveEnvMany([
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_TEMPLATE_NAME",
    "WHATSAPP_TEMPLATE_LANGUAGE",
  ] as const);

  demandEnv(config, [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_TEMPLATE_NAME",
    "WHATSAPP_TEMPLATE_LANGUAGE",
  ]);

  const to = normalizePhone(booking.phoneNumber);
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v25.0";
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: config.WHATSAPP_TEMPLATE_NAME,
        language: { code: config.WHATSAPP_TEMPLATE_LANGUAGE },
        components: [{
          type: "body",
          // This matches the three variables in the supplied Meta template:
          // customer name, booking reference, and appointment date.
          parameters: [
            { type: "text", text: booking.fullName },
            { type: "text", text: readableAppointmentId(booking.appointmentId) },
            { type: "text", text: booking.preferredDate },
          ],
        }],
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Meta rejected the WhatsApp message (${response.status}): ${detail.slice(0, 300)}`);
  }
}
