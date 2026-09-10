/** Appointments are scheduled in Malaysia time, regardless of the visitor's timezone. */
export function bookingDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function isFutureBooking(date: string, time: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return false;
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}+08:00`).getTime() > now.getTime();
}
