import assert from "node:assert/strict";
import test from "node:test";
import nodemailer from "nodemailer";
import { buildBookingEmail } from "./booking-email";

const booking = {
  fullName: 'Alex <script>alert("x")</script>',
  email: "customer@example.com", appointmentType: "Demo, discussion",
  preferredDate: "2026-12-31", preferredTime: "23:30", appointmentId: "test-booking-id-123",
};

test("calendar and Google link use the same UTC+8 start and 60-minute end", () => {
  const message = buildBookingEmail(booking, "sender@example.com", "DocuJet");
  assert.match(message.icalEvent.content, /DTSTART:20261231T153000Z/);
  assert.match(message.icalEvent.content, /DTEND:20261231T163000Z/);
  const link = message.text.match(/https:\/\/calendar.google.com\/calendar\/render\?\S+/)![0];
  assert.equal(new URL(link).searchParams.get("dates"), "20261231T153000Z/20261231T163000Z");
  assert.equal(new URL(link).searchParams.get("ctz"), "Asia/Kuala_Lumpur");
  assert.match(message.icalEvent.content, /METHOD:REQUEST/);
  assert.match(message.icalEvent.content, /mailto:customer@example.com/i);
  assert.match(message.icalEvent.content, /mailto:sender@example.com/i);
  assert.doesNotMatch(message.html, /<script>/);
  assert.match(message.html, /&lt;script&gt;/);
  assert.match(message.html, /mailto:sender@example.com/);
  assert.equal(message.icalEvent.content.match(/UID:.+/)![0], buildBookingEmail(booking, "sender@example.com", "DocuJet").icalEvent.content.match(/UID:.+/)![0]);
});

test("invalid dates and times cannot silently create the wrong calendar event", () => {
  for (const override of [{ preferredDate: "2026-02-30" }, { preferredTime: "24:30" }, { preferredDate: "invalid" }]) {
    assert.throws(() => buildBookingEmail({ ...booking, ...override }, "sender@example.com", "DocuJet"));
  }
});

test("SMTP message contains HTML, plain text, and calendar invitation without sending", async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const result = await transport.sendMail({
    from: "sender@example.com", to: booking.email,
    ...buildBookingEmail(booking, "sender@example.com", "DocuJet"),
  });
  const mime = result.message.toString();
  assert.match(mime, /Content-Type: text\/plain/);
  assert.match(mime, /Content-Type: text\/html/);
  assert.match(mime, /Content-Type: text\/calendar;[^\r\n]*method=REQUEST/i);
  assert.match(mime, /filename=appointment.ics/);
});
