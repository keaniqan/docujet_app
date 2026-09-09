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
  });

  await transporter.sendMail({
    from: { name: senderName, address: senderEmail },
    to: [{ address: booking.email, name: booking.fullName }],
    ...message,
  });
}
