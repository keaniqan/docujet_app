import assert from "node:assert/strict";
import test from "node:test";
import { bookingDate, isFutureBooking } from "./booking-time";

test("at 10am Malaysia time, reject 8am and the current slot but allow 10:30am", () => {
  const now = new Date("2026-09-10T02:00:00Z");
  assert.equal(isFutureBooking("2026-09-10", "08:00", now), false);
  assert.equal(isFutureBooking("2026-09-10", "10:00", now), false);
  assert.equal(isFutureBooking("2026-09-10", "10:30", now), true);
  assert.equal(isFutureBooking("2026-09-09", "17:00", now), false);
  assert.equal(isFutureBooking("2026-09-11", "08:00", now), true);
});

test("a selected slot expires while the form stays open", () => {
  assert.equal(isFutureBooking("2026-09-10", "10:30", new Date("2026-09-10T02:29:59Z")), true);
  assert.equal(isFutureBooking("2026-09-10", "10:30", new Date("2026-09-10T02:30:00Z")), false);
});

test("booking dates roll over at Malaysian midnight, not UTC midnight", () => {
  const now = new Date("2026-09-09T16:15:00Z");
  assert.equal(bookingDate(now), "2026-09-10");
  assert.equal(isFutureBooking("2026-09-09", "23:30", now), false);
  assert.equal(isFutureBooking("2026-09-10", "08:00:00", now), true);
});

test("missing or malformed appointment times cannot pass validation", () => {
  const now = new Date("2026-09-10T02:00:00Z");
  for (const [date, time] of [["", "08:00"], ["2026-09-11", ""], ["2026-09-11", "25:00"], ["invalid", "12:00"]]) {
    assert.equal(isFutureBooking(date, time, now), false);
  }
});
