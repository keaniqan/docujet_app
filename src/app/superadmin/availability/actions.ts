"use server";

import { revalidatePath } from "next/cache";
import { assertSuperadmin } from "@/lib/supabase/authorization";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/service";

export type AvailabilityActionState = { error: string | null; success: string | null };
const initialState: AvailabilityActionState = { error: null, success: null };
async function requireManager() {
  return assertSuperadmin("You are not authorized to manage appointment availability.");
}
function validateTime(start: string, end: string) {
  const parse = (value: string) => { const match = /^(\d{2}):(\d{2})$/.exec(value); if (!match || Number(match[2]) % 30) return null; return Number(match[1]) * 60 + Number(match[2]); };
  const first = parse(start); const last = parse(end);
  if (first === null || last === null) return "Times must use 30-minute increments.";
  if (first >= last) return "Start time must be before end time.";
  return null;
}
function refresh() { revalidatePath("/superadmin/availability"); revalidatePath("/booking"); }

export async function createAvailability(_state: AvailabilityActionState = initialState, formData: FormData): Promise<AvailabilityActionState> {
  void _state;
  try {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured on the server.");
    const actor = await requireManager(); const day = Number(formData.get("day_of_week"));
    const start = String(formData.get("start_time") ?? ""); const end = String(formData.get("end_time") ?? "");
    if (!Number.isInteger(day) || day < 0 || day > 6) return { error: "Choose a valid day.", success: null };
    const validation = validateTime(start, end); if (validation) return { error: validation, success: null };
    const { error } = await supabase().from("appointment_weekly_availability").insert({ day_of_week: day, start_time: start, end_time: end, created_by: actor.id });
    if (error) throw error; refresh(); return { error: null, success: "Weekly availability added." };
  } catch (cause) { return { error: cause instanceof Error ? cause.message : "Could not add availability.", success: null }; }
}
export async function updateAvailabilityFromForm(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured on the server."); await requireManager();
  const id = String(formData.get("id") ?? ""); const day = Number(formData.get("day_of_week")); const start = String(formData.get("start_time") ?? ""); const end = String(formData.get("end_time") ?? "");
  if (!id || !Number.isInteger(day) || day < 0 || day > 6) throw new Error("Invalid availability details."); const validation = validateTime(start, end); if (validation) throw new Error(validation);
  const { error } = await supabase().from("appointment_weekly_availability").update({ day_of_week: day, start_time: start, end_time: end }).eq("id", id); if (error) throw error; refresh();
}
export async function setAvailabilityActive(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured on the server."); await requireManager(); const id = String(formData.get("id") ?? ""); const active = String(formData.get("is_active")) === "true";
  const { error } = await supabase().from("appointment_weekly_availability").update({ is_active: active }).eq("id", id); if (error) throw error; refresh();
}
export async function deleteAvailability(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured on the server."); await requireManager(); const { error } = await supabase().from("appointment_weekly_availability").delete().eq("id", String(formData.get("id") ?? "")); if (error) throw error; refresh();
}
export async function createClosure(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured on the server."); const actor = await requireManager(); const date = String(formData.get("closed_date") ?? ""); const today = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) throw new Error("Choose today or a future date."); const { error } = await supabase().from("appointment_booking_closures").insert({ closed_date: date, reason: String(formData.get("reason") ?? "").trim(), created_by: actor.id }); if (error) throw error; refresh();
}
export async function deleteClosure(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured on the server."); await requireManager(); const { error } = await supabase().from("appointment_booking_closures").delete().eq("id", String(formData.get("id") ?? "")); if (error) throw error; refresh();
}

export async function createWeeklyBlock(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured on the server."); const actor = await requireManager(); const day = Number(formData.get("day_of_week")); const start = String(formData.get("start_time") ?? ""); const end = String(formData.get("end_time") ?? ""); const validation = validateTime(start, end);
  if (!Number.isInteger(day) || day < 0 || day > 6) throw new Error("Choose a valid day."); if (validation) throw new Error(validation);
  const { error } = await supabase().from("appointment_weekly_blocks").insert({ day_of_week: day, start_time: start, end_time: end, label: String(formData.get("label") ?? "Break").trim() || "Break", created_by: actor.id }); if (error) throw error; refresh();
}
export async function deleteWeeklyBlock(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured on the server."); await requireManager(); const { error } = await supabase().from("appointment_weekly_blocks").delete().eq("id", String(formData.get("id") ?? "")); if (error) throw error; refresh();
}
export async function createDateBlock(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured on the server."); const actor = await requireManager(); const date = String(formData.get("blocked_date") ?? ""); const time = String(formData.get("blocked_time") ?? ""); const today = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) throw new Error("Choose today or a future date."); if (!/^([01]\d|2[0-3]):[03]0$/.test(time)) throw new Error("Choose a 30-minute time slot.");
  const { error } = await supabase().from("appointment_date_blocks").insert({ blocked_date: date, blocked_time: time, label: String(formData.get("label") ?? "Blocked slot").trim() || "Blocked slot", created_by: actor.id }); if (error) throw error; refresh();
}
export async function deleteDateBlock(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured on the server."); await requireManager(); const { error } = await supabase().from("appointment_date_blocks").delete().eq("id", String(formData.get("id") ?? "")); if (error) throw error; refresh();
}
