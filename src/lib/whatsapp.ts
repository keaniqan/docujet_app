/**
 * The booking confirmation over WhatsApp.
 *
 * Unlike the email, the message text is not in this repository and cannot be
 * moved into the Content Management page: Twilio requires a pre-approved
 * Content Template, referenced by `TWILIO_CONTENT_SID`, and the words live in
 * the Twilio console. What this file owns is which value lands in which numbered
 * placeholder — and that mapping is a contract with whoever wrote the template,
 * so it stays code rather than becoming an editable field that could silently
 * put the appointment time where the customer's name belongs.
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
  const normalized = phone.trim().replace(/[\s().-]/g, "");
  if (!normalized.startsWith("+")) {
    throw new Error("Use the customer's international WhatsApp number, including the + country code.");
  }
  const digits = normalized.slice(1);
  if (!/^\d{8,15}$/.test(digits)) {
    throw new Error("Use the customer's international WhatsApp number, including the + country code.");
  }
  return normalized;
}

export async function sendBookingWhatsApp(booking: BookingNotification) {
  // One settings read for all four, resolving database-first and falling back
  // to `.env` — see settings/env.ts.
  const config = await resolveEnvMany([
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_FROM",
    "TWILIO_CONTENT_SID",
  ] as const);

  demandEnv(config, [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_FROM",
    "TWILIO_CONTENT_SID",
  ]);

  const accountSid = config.TWILIO_ACCOUNT_SID;
  const from = config.TWILIO_WHATSAPP_FROM;
  const to = normalizePhone(booking.phoneNumber);
  const form = new URLSearchParams({
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    To: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
    ContentSid: config.TWILIO_CONTENT_SID,
    ContentVariables: JSON.stringify({
      1: booking.fullName,
      2: booking.appointmentType,
      3: booking.preferredDate,
      4: booking.preferredTime,
      5: readableAppointmentId(booking.appointmentId),
    }),
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${config.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Twilio rejected the WhatsApp message (${response.status}): ${detail.slice(0, 300)}`);
  }
}
