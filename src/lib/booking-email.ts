import ical, { ICalCalendarMethod } from "ical-generator";

export type BookingEmail = {
  fullName: string;
  email: string;
  appointmentType: string;
  preferredDate: string;
  preferredTime: string;
  appointmentId: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export function buildBookingEmail(booking: BookingEmail, senderEmail: string, senderName: string, durationMinutes = 60) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.preferredDate) || !/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(booking.preferredTime)) {
    throw new Error("Invalid appointment date or time.");
  }
  // Public booking slots are local Malaysia time (UTC+8, without daylight saving).
  const localTime = booking.preferredTime.slice(0, 5);
  const start = new Date(`${booking.preferredDate}T${localTime}:00+08:00`);
  if (!Number.isFinite(start.getTime()) || new Date(start.getTime() + 8 * 60 * 60_000).toISOString().slice(0, 10) !== booking.preferredDate) {
    throw new Error("Invalid appointment date.");
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
    throw new Error("Invalid appointment duration.");
  }
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const id = booking.appointmentId.length > 12
    ? `APT-${booking.appointmentId.replaceAll("-", "").slice(0, 8).toUpperCase()}`
    : booking.appointmentId;
  const title = `${senderName} — ${booking.appointmentType}`;
  const description = `Booking ID: ${id}\nAppointment for ${booking.fullName}.\nContact ${senderEmail} if you need to reschedule.`;
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const google = new URL("https://calendar.google.com/calendar/render");
  google.search = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${stamp(start)}/${stamp(end)}`, details: description, ctz: "Asia/Kuala_Lumpur" }).toString();
  const reply = `mailto:${senderEmail}?${new URLSearchParams({ subject: `Reschedule booking ${id}`, body: `Hello ${senderName},\nI would like to reschedule my appointment on ${booking.preferredDate} at ${localTime} (Malaysia time).\nBooking ID: ${id}\n\nMy preferred alternative is: ` }).toString().replace(/\+/g, "%20")}`;
  const calendar = ical({ name: `${senderName} appointments`, method: ICalCalendarMethod.REQUEST });
  calendar.createEvent({
    id: `${encodeURIComponent(booking.appointmentId)}@docujet.booking`,
    start, end, summary: title, description,
    organizer: { name: senderName, email: senderEmail },
    attendees: [{ name: booking.fullName, email: booking.email, rsvp: true }],
  });
  const dateLabel = new Intl.DateTimeFormat("en-MY", { dateStyle: "full", timeZone: "Asia/Kuala_Lumpur" }).format(start);
  const timeFormat = new Intl.DateTimeFormat("en-MY", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });
  const timeLabel = `${timeFormat.format(start)} – ${timeFormat.format(end)}`;
  const h = escapeHtml;
  const rows = [["Appointment", booking.appointmentType], ["Date", dateLabel], ["Time", `${timeLabel} · Malaysia / Singapore (UTC+8)`], ["Booking reference", id]];
  return {
    subject: `Appointment confirmed - ${booking.preferredDate}`,
    text: `Hello ${booking.fullName},\n\nYour appointment is confirmed.\n${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\nAdd to Google Calendar: ${google}\nOr open the attached appointment.ics in your calendar app.\n\nNeed a different time? Reply to this email to request a change. Your booking stays unchanged until we confirm it.\n\nRegards,\n${senderName}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">Your appointment is confirmed. Save the date in your calendar.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px;background:#0f172a;color:#ffffff;"><p style="margin:0 0 24px;font-size:18px;font-weight:bold;">${h(senderName)}</p><p style="margin:0 0 12px;color:#7dd3fc;font-size:12px;letter-spacing:2px;">BOOKING CONFIRMED</p><h1 style="margin:0;font-size:30px;line-height:1.2;">You're all set.</h1><p style="margin:14px 0 0;color:#cbd5e1;line-height:1.6;">Your next step starts with a conversation.</p></td></tr>
<tr><td style="padding:32px;"><p style="margin:0 0 12px;font-size:17px;">Hello ${h(booking.fullName)},</p><p style="margin:0 0 24px;color:#475569;line-height:1.6;">We look forward to meeting you. Here are your appointment details:</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0;">${rows.map(([label, value]) => `<tr><td style="padding:14px 0;border-bottom:1px solid #e2e8f0;"><p style="margin:0 0 6px;color:#64748b;font-size:12px;">${h(label)}</p><p style="margin:0;font-size:16px;line-height:1.5;font-weight:bold;">${h(value)}</p></td></tr>`).join("")}</table>
<p style="margin:28px 0 16px;"><a href="${h(google.toString())}" style="display:inline-block;background:#0369a1;color:#ffffff;padding:15px 22px;border-radius:8px;text-decoration:none;font-weight:bold;">Add to Google Calendar</a></p>
<p style="margin:0 0 28px;color:#64748b;font-size:13px;line-height:1.6;">Using Outlook, Apple Calendar, or another calendar? Open the attached <strong>appointment.ics</strong> file to save this appointment.</p>
<h2 style="font-size:18px;margin:0 0 10px;">Need a different time?</h2><p style="margin:0 0 16px;color:#475569;line-height:1.6;">Reply to this email or use the button below. Your appointment stays unchanged until we confirm your request.</p><a href="${h(reply)}" style="display:inline-block;border:1px solid #cbd5e1;border-radius:8px;padding:12px 18px;color:#0f172a;text-decoration:none;font-weight:bold;">Request a reschedule</a>
</td></tr><tr><td style="padding:24px 32px;background:#f8fafc;color:#64748b;font-size:13px;line-height:1.6;">See you soon,<br><strong>${h(senderName)}</strong></td></tr>
</table></td></tr></table></body></html>`,
    icalEvent: { method: "REQUEST", filename: "appointment.ics", content: calendar.toString() },
  };
}
